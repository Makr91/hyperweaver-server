import { Agent } from 'undici';
import db from '../models/index.js';
import { log } from './Logger.js';
import { broadcast, onTopicSubscribers, subscriberCount, TOPICS } from './events.js';

const { server: ServerModel } = db;

const AGENT_TOPICS = ['tasks', 'hosts', 'monitoring', 'sessions', 'health'];
const RETRY_MS = 3000;
const RETRY_CAP_MS = 30000;
const STREAM_TYPE = 'text/event-stream';

const relays = new Map();
const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

const wanted = () => AGENT_TOPICS.some(topic => subscriberCount(topic) > 0);

const topicOfEvent = event => {
  if (event === 'task-updated') {
    return 'tasks';
  }
  if (event === 'stats-updated') {
    return 'hosts';
  }
  if (event === 'health') {
    return 'health';
  }
  if (event.startsWith('session-')) {
    return 'sessions';
  }
  if (event.endsWith('-sample')) {
    return 'monitoring';
  }
  return null;
};

const dispatch = (relay, upstream) => {
  const { frame } = upstream;
  upstream.frame = {};
  if (frame.id !== undefined) {
    relay.lastEventId = frame.id;
  }
  if (frame.data === undefined || !frame.event || frame.event === 'ready') {
    return;
  }
  if (frame.event === 'reset') {
    broadcast('hosts', 'servers-updated', {});
    return;
  }
  const topic = topicOfEvent(frame.event);
  if (!topic || !TOPICS.includes(topic)) {
    return;
  }
  try {
    broadcast(topic, frame.event, { ...JSON.parse(frame.data), agent_id: relay.id });
  } catch (error) {
    log.proxy.warn('Agent relay frame unreadable', {
      id: relay.id,
      event: frame.event,
      error: error.message,
    });
  }
};

const readLine = (relay, upstream, line) => {
  if (line === '') {
    dispatch(relay, upstream);
    return;
  }
  if (line.startsWith(':')) {
    return;
  }
  const colon = line.indexOf(':');
  const field = colon === -1 ? line : line.slice(0, colon);
  const raw = colon === -1 ? '' : line.slice(colon + 1);
  const value = raw.startsWith(' ') ? raw.slice(1) : raw;
  const { frame } = upstream;
  if (field === 'data') {
    frame.data = frame.data === undefined ? value : `${frame.data}\n${value}`;
  } else if (field === 'event') {
    frame.event = value;
  } else if (field === 'id' && !value.includes('\0')) {
    frame.id = value;
  } else if (field === 'retry' && /^\d+$/u.test(value)) {
    relay.retryMs = Number(value);
  }
};

const parse = (relay, upstream, text) => {
  const lines = `${upstream.buffer}${text}`.split('\n');
  upstream.buffer = lines.pop();
  lines.forEach(line => readLine(relay, upstream, line.endsWith('\r') ? line.slice(0, -1) : line));
};

const readStream = (relay, upstream, response) =>
  new Promise(resolve => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const next = () => {
      reader.read().then(
        ({ value, done }) => {
          if (relay.upstream !== upstream) {
            resolve('closed');
            return;
          }
          if (done) {
            resolve('dropped');
            return;
          }
          parse(relay, upstream, decoder.decode(value, { stream: true }));
          next();
        },
        () => resolve(relay.upstream === upstream ? 'dropped' : 'closed')
      );
    };
    next();
  });

const connect = async (relay, upstream) => {
  const { server } = relay;
  const headers = { Accept: STREAM_TYPE, Authorization: `Bearer ${server.api_key}` };
  if (relay.lastEventId) {
    headers['Last-Event-ID'] = relay.lastEventId;
  }
  const topics = AGENT_TOPICS.join(',');
  const url = `${server.protocol}://${server.hostname}:${server.port}/api/events?topics=${topics}`;
  let response;
  try {
    response = await fetch(url, {
      headers,
      signal: upstream.controller.signal,
      ...(server.allow_insecure ? { dispatcher: insecureDispatcher } : {}),
    });
  } catch (error) {
    if (relay.upstream !== upstream) {
      return 'closed';
    }
    log.proxy.warn('Agent relay could not reach the agent', { id: relay.id, error: error.message });
    return 'dropped';
  }
  if (relay.upstream !== upstream) {
    response.body?.cancel().catch(() => {});
    return 'closed';
  }
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200 || !contentType.startsWith(STREAM_TYPE)) {
    response.body?.cancel().catch(() => {});
    log.proxy.warn('Agent relay answered without an event stream', {
      id: relay.id,
      status: response.status,
    });
    return response.status === 401 || response.status === 403 ? 'stopped' : 'dropped';
  }
  relay.attempt = 0;
  server.refreshStatus().catch(() => {});
  log.proxy.info('Agent relay opened', { id: relay.id, resumed: Boolean(relay.lastEventId) });
  return readStream(relay, upstream, response);
};

const run = relay => {
  const upstream = { controller: new AbortController(), buffer: '', frame: {} };
  relay.upstream = upstream;
  connect(relay, upstream).then(outcome => {
    if (relay.upstream !== upstream) {
      return;
    }
    relay.upstream = null;
    upstream.controller.abort();
    if (outcome === 'stopped' || !wanted()) {
      relays.delete(relay.id);
      return;
    }
    const delay = Math.min(relay.retryMs * 2 ** relay.attempt, RETRY_CAP_MS);
    relay.attempt += 1;
    relay.timer = setTimeout(() => {
      relay.timer = null;
      if (wanted()) {
        run(relay);
      } else {
        relays.delete(relay.id);
      }
    }, delay);
    relay.timer.unref();
  });
};

const close = relay => {
  clearTimeout(relay.timer);
  relay.timer = null;
  if (relay.upstream) {
    const { controller } = relay.upstream;
    relay.upstream = null;
    controller.abort();
  }
  relays.delete(relay.id);
};

/**
 * Open one upstream stream to every registered agent while a browser
 * subscribes to a family topic on this server's stream, re-broadcasting
 * each agent frame with its registry id as `agent_id`; a dropped upstream
 * reconnects with its last id on exponential backoff, and every upstream
 * closes once no browser subscribes.
 * @returns {Promise<void>}
 */
const ensureAgentRelays = async () => {
  if (!wanted()) {
    for (const relay of relays.values()) {
      close(relay);
    }
    return;
  }
  const servers = await ServerModel.withScope('withApiKey').findAll();
  const live = new Set(servers.map(server => server.id));
  for (const relay of relays.values()) {
    if (!live.has(relay.id)) {
      close(relay);
    }
  }
  for (const server of servers) {
    if (!relays.has(server.id)) {
      const relay = {
        id: server.id,
        server,
        upstream: null,
        timer: null,
        attempt: 0,
        retryMs: RETRY_MS,
        lastEventId: null,
      };
      relays.set(server.id, relay);
      run(relay);
    }
  }
};

const sweep = () =>
  ensureAgentRelays().catch(error =>
    log.proxy.warn('Agent relay sweep failed', { error: error.message })
  );

onTopicSubscribers((topic, count) => {
  if (AGENT_TOPICS.includes(topic) && count === 0) {
    sweep();
  }
});

/**
 * Tell every open stream the registry changed, `servers-updated` on the
 * `hosts` topic, and reconcile the upstream relays with it.
 */
const notifyServersUpdated = () => {
  broadcast('hosts', 'servers-updated', {});
  sweep();
};

export { ensureAgentRelays, notifyServersUpdated };
