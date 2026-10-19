import { randomBytes } from 'crypto';
import db from '../../models/index.js';
import { log } from '../../utils/Logger.js';
import { problem } from '../../utils/problem.js';
import { signSessionToken } from '../../utils/auth.js';
import { loadConfig } from '../../utils/config-loader.js';
import { profileOf } from '../user/getuserprofile.js';
import { buildRpLogoutUrl, revokeOidcGrant } from '../../auth/oidcLogout.js';
import { notifySessionTerminated } from '../../utils/events.js';

const { user: UserModel } = db;

const CODE_TTL_MS = 60 * 1000;
const codes = new Map();

const purgeCodes = () => {
  const now = Date.now();
  for (const [code, entry] of codes) {
    if (entry.expiresAt <= now) {
      codes.delete(code);
    }
  }
};

const unauthenticated = (req, res, key) =>
  problem(res, req, { status: 401, type: 'authentication', title: req.__(key) });

const forbidden = (req, res, key) =>
  problem(res, req, { status: 403, type: 'forbidden', title: req.__(key) });

/**
 * Mint the session JWT of a user: the claims every reader of the token
 * expects and the provider tag the UI reads as `provider`.
 * @param {Object} user - The user row
 * @param {string} provider - `local`, `ldap` or `oidc-<name>`
 * @param {boolean} stayLoggedIn - Whether the UI keeps the session across restarts
 * @returns {string} The JWT
 */
export const mintSession = (user, provider, stayLoggedIn) =>
  signSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    auth_provider: provider,
    provider,
    stay_logged_in: Boolean(stayLoggedIn),
  });

/**
 * The sign-in answer: the profile of `GET /api/user` with the JWT as
 * `access_token`, `provider` and `stay_logged_in` beside it.
 * @param {Object} user - The user row, its organization association loaded
 * @param {import('express').Request} req - The request
 * @param {string} provider - The provider tag
 * @param {boolean} stayLoggedIn - Whether the session is kept
 * @returns {Promise<Object>} The answer body
 */
export const signinAnswer = async (user, req, provider, stayLoggedIn) => ({
  ...(await profileOf(user, req)),
  access_token: mintSession(user, provider, stayLoggedIn),
  is_service_account: false,
  provider,
  stay_logged_in: Boolean(stayLoggedIn),
});

/**
 * Park a signed-in user behind a single-use code the OIDC callback lands the
 * browser with, redeemed once by `POST /api/auth/oidc/exchange`.
 * @param {number} userId - The user
 * @param {string} provider - The provider tag
 * @returns {string} The code
 */
export const issueLoginCode = (userId, provider) => {
  purgeCodes();
  const code = randomBytes(32).toString('hex');
  codes.set(code, { userId, provider, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
};

const loadUser = id =>
  UserModel.findByPk(id, {
    include: [{ association: 'organization', attributes: ['id', 'name', 'org_uuid'] }],
  });

const regenerate = req =>
  new Promise((resolve, reject) => {
    req.session.regenerate(err => (err ? reject(err) : resolve()));
  });

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Sign in with a local account
 *     description: Username or email and password. Answers the profile of GET /api/user with the session JWT as access_token, the shared UI's backend session shape. Refused 403 while local accounts are off.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: The username or the email address
 *               password:
 *                 type: string
 *               stay_logged_in:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Signed in
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 *       403:
 *         description: Local accounts are off
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const signin = async (req, res) => {
  try {
    const { authentication } = loadConfig('auth');
    if (authentication.local_enabled === false) {
      return forbidden(req, res, 'auth.localAuthDisabled');
    }
    const { username, password, stay_logged_in: stayLoggedIn } = req.body || {};
    if (!username || !password) {
      return unauthenticated(req, res, 'auth.invalidCredentials');
    }
    const found = await UserModel.withScope('withPassword').findByIdentifier(username);
    if (!found) {
      return unauthenticated(req, res, 'auth.invalidCredentials');
    }
    const bcrypt = (await import('bcrypt')).default;
    if (!(await bcrypt.compare(password, found.password_hash))) {
      return unauthenticated(req, res, 'auth.invalidCredentials');
    }
    await found.update({ last_login: new Date() });
    if (req.session) {
      await regenerate(req);
      req.session.userId = found.id;
    }
    const user = await loadUser(found.id);
    return res.json(await signinAnswer(user, req, 'local', stayLoggedIn));
  } catch (error) {
    log.auth.error('Sign-in error', { error: error.message });
    return problem(res, req, { status: 500, type: 'internal' });
  }
};

/**
 * @swagger
 * /api/auth/oidc/exchange:
 *   post:
 *     summary: Redeem the single-use code of an OIDC callback for the session JWT
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: The session JWT as token
 *       401:
 *         description: Unknown, spent or expired code
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const exchange = async (req, res) => {
  purgeCodes();
  const entry = codes.get(req.body?.code);
  if (!entry) {
    return unauthenticated(req, res, 'auth.unauthorized');
  }
  codes.delete(req.body.code);
  const user = await loadUser(entry.userId);
  if (!user || user.is_active === false) {
    return unauthenticated(req, res, 'auth.unauthorized');
  }
  return res.json({ token: mintSession(user, entry.provider, true) });
};

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh the session JWT
 *     description: Answers the sign-in shape with a new access_token; the identity provider tokens of a federated session are refreshed by the OIDC refresh middleware before this answers.
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Refreshed
 *       401:
 *         description: No session
 *         content:
 *           application/problem+json:
 *             schema:
 *               $ref: '#/components/schemas/Problem'
 */
export const refreshToken = async (req, res) => {
  try {
    const user = await loadUser(req.userId);
    if (!user) {
      return unauthenticated(req, res, 'auth.unauthorized');
    }
    const stayLoggedIn = req.body?.stay_logged_in ?? req.tokenClaims?.stay_logged_in;
    return res.json(await signinAnswer(user, req, req.authProvider, stayLoggedIn));
  } catch (error) {
    log.auth.error('Refresh error', { error: error.message });
    return problem(res, req, { status: 500, type: 'internal' });
  }
};

/**
 * @swagger
 * /api/auth/oidc/logout:
 *   post:
 *     summary: Sign out everywhere
 *     description: Revokes every session JWT of the user, revokes the identity provider grant of a federated session, destroys the server-side session and answers the identity provider's end-session URL as redirect_url when it offers one.
 *     tags: [Authentication]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Signed out
 */
export const oidcLogout = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const sessionOidc = req.session?.oidc;
    if (userId) {
      await UserModel.update({ sessions_invalid_after: new Date() }, { where: { id: userId } });
      notifySessionTerminated(userId);
    }
    let redirectUrl = null;
    if (sessionOidc?.provider && sessionOidc.userId === userId) {
      await revokeOidcGrant(sessionOidc);
      redirectUrl = buildRpLogoutUrl(sessionOidc);
    }
    if (req.session) {
      await new Promise(resolve => {
        req.session.destroy(() => resolve());
      });
    }
    return res.json({ success: true, redirect_url: redirectUrl });
  } catch (error) {
    log.auth.error('Logout error', { error: error.message });
    return res.json({ success: true, redirect_url: null });
  }
};
