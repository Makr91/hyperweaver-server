import db from '../models/index.js';
import { loadConfig } from '../utils/config-loader.js';
import { getSupportedLocales, getDefaultLocale } from '../config/i18n.js';
import { notifyHealth } from '../utils/events.js';
import { log } from '../utils/Logger.js';

const STALE_AFTER_MS = 5 * 60 * 1000;

let lastHealth = null;

const databaseHealth = async () => {
  try {
    await db.sequelize.authenticate();
    return 'ok';
  } catch {
    return 'error';
  }
};

/**
 * The worst state of the registered agents: `ok` while every agent answered
 * its status within five minutes or none is registered, `warning` while some
 * did not, `error` while none did.
 * @returns {Promise<string>} ok, warning or error
 */
const agentsHealth = async () => {
  if (!db.server) {
    return 'ok';
  }
  const servers = await db.server.getAllServers();
  if (servers.length === 0) {
    return 'ok';
  }
  const cutoff = Date.now() - STALE_AFTER_MS;
  const fresh = servers.filter(
    server => server.last_seen && new Date(server.last_seen).getTime() >= cutoff
  ).length;
  if (fresh === servers.length) {
    return 'ok';
  }
  return fresh === 0 ? 'error' : 'warning';
};

const worstOf = services => {
  const states = Object.values(services);
  if (states.includes('error')) {
    return 'error';
  }
  return states.includes('warning') ? 'warning' : 'ok';
};

/**
 * The health report `GET /api/health` answers and the `health` topic carries.
 * @returns {Promise<Object>} The report
 */
const getHealthReport = async () => {
  const { frontend_logging: frontendLogging } = loadConfig('app');
  const services = {
    database: await databaseHealth(),
    agents: await agentsHealth(),
  };
  return {
    status: worstOf(services),
    timestamp: new Date().toISOString(),
    services,
    supported_languages: getSupportedLocales(),
    default_language: getDefaultLocale(),
    frontend_logging: frontendLogging,
  };
};

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health of the server and its services (public)
 *     description: The one health shape every UI backend answers. status is ok, warning or error, the worst of the services; services carries one word each for database, the connection answering a ping, and agents, every registered agent having answered its status within five minutes. supported_languages and default_language are the locales the backend ships; frontend_logging is the browser logger's configuration. The same report is sent as the health event on the health topic of GET /api/events whenever the status or a service state changes.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: The health report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, timestamp, services]
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, warning, error]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database: { type: string }
 *                     agents: { type: string }
 *                 supported_languages:
 *                   type: array
 *                   items: { type: string }
 *                 default_language:
 *                   type: string
 *                 frontend_logging:
 *                   type: object
 */
const getHealth = async (req, res) => {
  void req;
  try {
    return res.json(await getHealthReport());
  } catch (error) {
    log.app.error('Health check failed', { error: error.message });
    return res.status(500).json({ status: 'error', timestamp: new Date().toISOString() });
  }
};

const healthChanged = (previous, next) =>
  previous === null ||
  previous.status !== next.status ||
  JSON.stringify(previous.services) !== JSON.stringify(next.services);

/**
 * Evaluate the health state and push it on the health topic when the status
 * or any service state differs from the last one sent; called after every
 * registry change and every agent status refresh.
 * @returns {Promise<void>}
 */
const publishHealthChange = async () => {
  try {
    const { status, timestamp, services } = await getHealthReport();
    const health = { status, timestamp, services };
    if (healthChanged(lastHealth, health)) {
      lastHealth = health;
      notifyHealth(health);
    }
  } catch (error) {
    log.app.error('Health publish failed', { error: error.message });
  }
};

export { getHealth, getHealthReport, publishHealthChange };
