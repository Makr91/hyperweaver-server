import axios from 'axios';
import { log } from '../utils/Logger.js';
import { problem } from '../utils/problem.js';
import { getAuthServerUrl, extractOidcAccessToken } from './favorites/helpers.js';

const buildNotificationsUrl = (req, path = '') =>
  `${getAuthServerUrl(req)}/api/notifications${path}`;

const buildAuthHeaders = oidcAccessToken => ({
  Authorization: `Bearer ${oidcAccessToken}`,
  'Content-Type': 'application/json',
});

const pushNotConfigured = (req, res) =>
  problem(res, req, {
    status: 503,
    type: 'send-failed',
    title: req.__('notifications.pushNotConfigured'),
  });

const respondAuthServerError = (req, res, error) => {
  const { response } = error;

  log.error.error('Notification request to auth server failed', {
    error: error.message,
    status: response?.status,
    data: response?.data,
  });

  if (!response) {
    return problem(res, req, { status: 502, type: 'bad-gateway' });
  }
  if (response.status === 401) {
    return problem(res, req, {
      status: 401,
      type: 'authentication',
      title: req.__('auth.unauthorized'),
    });
  }
  return res
    .status(response.status)
    .type(response.headers?.['content-type'] || 'application/json')
    .send(response.data ?? {});
};

/**
 * Send one request to the identity provider with the session's OIDC access
 * token, kept fresh by `oidcTokenRefresh` ahead of the route. Answers the
 * caller's problem itself and resolves null when the request could not be
 * served: 401 without a token or when the provider refused it, the
 * provider's 403 as forbidden, 502 when it cannot be reached.
 * @param {import('express').Request} req - The request, with the session resolved
 * @param {import('express').Response} res - The response
 * @param {function(Object): Promise<{status: number, data: *}>} sendRequest - Sends the upstream request with the bearer headers
 * @returns {Promise<{headers: Object, response: {status: number, data: *}}|null>} The headers used and the provider's answer, or null once a problem was sent
 */
export const forwardToProvider = async (req, res, sendRequest) => {
  const oidcAccessToken = extractOidcAccessToken(req);

  if (!oidcAccessToken) {
    problem(res, req, {
      status: 401,
      type: 'authentication',
      title: req.__('auth.unauthorized'),
    });
    return null;
  }

  const headers = buildAuthHeaders(oidcAccessToken);
  try {
    return { headers, response: await sendRequest(headers) };
  } catch (error) {
    respondAuthServerError(req, res, error);
    return null;
  }
};

/**
 * Forward one request to the identity provider through `forwardToProvider`
 * and answer its status and body unmapped.
 * @param {import('express').Request} req - The request, with the session resolved
 * @param {import('express').Response} res - The response
 * @param {function(Object): Promise<{status: number, data: *}>} sendRequest - Sends the upstream request with the bearer headers
 * @returns {Promise<void>}
 */
export const proxyNotificationRequest = async (req, res, sendRequest) => {
  const forwarded = await forwardToProvider(req, res, sendRequest);
  if (!forwarded) {
    return;
  }
  res.status(forwarded.response.status).json(forwarded.response.data || {});
};

const buildListQuery = query => {
  const params = new URLSearchParams();
  for (const key of ['page', 'size', 'unread_only']) {
    if (typeof query[key] !== 'undefined') {
      params.set(key, query[key]);
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
};

/**
 * @swagger
 * /api/notifications/vapid-key:
 *   get:
 *     summary: Browser push is not offered
 *     description: This server signs no browser push of its own; the identity provider's push reaches the person on every host, so the VAPID key, the subscription routes and the test routes answer 503 not-configured and the shared UI's notifications switch stays off here.
 *     tags: [Notifications]
 *     responses:
 *       503:
 *         description: Push is not offered by this server
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const pushNotOffered = (req, res) => pushNotConfigured(req, res);

export const listNotifications = (req, res) =>
  proxyNotificationRequest(req, res, headers =>
    axios.get(`${buildNotificationsUrl(req)}${buildListQuery(req.query)}`, { headers })
  );

export const getUnreadCount = (req, res) =>
  proxyNotificationRequest(req, res, headers =>
    axios.get(buildNotificationsUrl(req, '/unread-count'), { headers })
  );

export const markNotificationRead = (req, res) =>
  proxyNotificationRequest(req, res, headers =>
    axios.post(buildNotificationsUrl(req, `/${encodeURIComponent(req.params.id)}/read`), null, {
      headers,
    })
  );

export const markAllNotificationsRead = (req, res) =>
  proxyNotificationRequest(req, res, headers =>
    axios.post(buildNotificationsUrl(req, '/read-all'), null, { headers })
  );

export const deleteNotification = (req, res) =>
  proxyNotificationRequest(req, res, headers =>
    axios.delete(buildNotificationsUrl(req, `/${encodeURIComponent(req.params.id)}`), {
      headers,
    })
  );

/**
 * @swagger
 * /api/notifications:
 *   delete:
 *     summary: Clear the caller's inbox
 *     description: Forwards to the notification hub's DELETE /api/notifications with the session's OIDC access token and answers the hub's status and body unmapped; the hub's inbox-cleared and unread-count reach the person's open tabs through the event stream's notifications topic.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: The inbox is empty
 *       401:
 *         description: No OIDC access token on the session, or the hub refused the token
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       403:
 *         description: The hub refused the request
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       502:
 *         description: The hub is unreachable
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const deleteAllNotifications = (req, res) =>
  proxyNotificationRequest(req, res, headers =>
    axios.delete(buildNotificationsUrl(req), { headers })
  );
