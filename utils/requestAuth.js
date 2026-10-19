import jwt from 'jsonwebtoken';
import { decodeJwt } from 'jose';
import { log } from './Logger.js';
import { verifySessionToken } from './auth.js';
import db from '../models/index.js';

const { JsonWebTokenError, TokenExpiredError } = jwt;
const { user: User, revokedSession: RevokedSession } = db;

/**
 * The session JWT a request carries: `x-access-token` first, the shared
 * UI's header, then `Authorization: Bearer`.
 * @param {import('express').Request} req - The request
 * @returns {string|null} The token, or null
 */
const sessionTokenOf = req => {
  const header = req.headers['x-access-token'];
  if (typeof header === 'string' && header !== '') {
    return header;
  }
  const [scheme, ...rest] = (req.headers.authorization || '').split(' ');
  const token = rest.join(' ').trim();
  return scheme === 'Bearer' && token ? token : null;
};

const providerSessionOf = oidc => {
  if (typeof oidc?.id_token !== 'string') {
    return null;
  }
  try {
    const { iss, sid } = decodeJwt(oidc.id_token);
    return iss && sid ? { issuer: iss, sid: String(sid) } : null;
  } catch {
    return null;
  }
};

const isSessionRevoked = async oidc => {
  const named = providerSessionOf(oidc);
  if (!named) {
    return false;
  }
  return Boolean(await RevokedSession.findOne({ where: named }));
};

const isTokenRevoked = (claims, sessionsInvalidAfter) =>
  Boolean(
    claims.iat &&
    sessionsInvalidAfter &&
    claims.iat * 1000 < new Date(sessionsInvalidAfter).getTime()
  );

/**
 * The OIDC token stash of the request's server-side session, when it
 * belongs to the signed-in user named by the JWT.
 * @param {import('express').Request} req - The request
 * @param {number} userId - The JWT's user
 * @returns {Object|null} `req.session.oidc`, or null
 */
const oidcStashOf = (req, userId) => {
  const oidc = req.session?.oidc;
  return oidc && oidc.userId === userId ? oidc : null;
};

/**
 * Resolve the caller behind a request's session JWT: the signature, issuer
 * and audience verified, the user active, the token issued after the
 * user's revocation cutoff, and for a federated session the identity
 * provider's `sid` not revoked by a back-channel logout. With
 * `allowLapsed`, a JWT that failed only on `exp` resolves with `lapsed`
 * true when its session holds a refresh token, for the refresh route
 * alone.
 * @param {import('express').Request} req - The request
 * @param {{allowLapsed?: boolean}} [options] - Whether a lapsed federated session resolves
 * @returns {Promise<{userId: number, username: string, email: string, role: string, provider: string, claims: Object, lapsed: boolean, oidc: Object|null}|null>} The caller, or null
 */
const resolveRequestAuth = async (req, { allowLapsed = false } = {}) => {
  const token = sessionTokenOf(req);
  if (!token) {
    return null;
  }
  let claims;
  let lapsed = false;
  try {
    claims = await verifySessionToken(token);
  } catch (err) {
    if (!(err instanceof JsonWebTokenError)) {
      throw err;
    }
    if (!allowLapsed || !(err instanceof TokenExpiredError)) {
      log.auth.debug('Session token rejected', { error: err.message });
      return null;
    }
    claims = await verifySessionToken(token, { ignoreExpiration: true });
    lapsed = true;
  }
  const user = await User.findByPk(claims.userId);
  if (!user || user.is_active === false) {
    return null;
  }
  if (isTokenRevoked(claims, user.sessions_invalid_after)) {
    return null;
  }
  const oidc = oidcStashOf(req, user.id);
  if (lapsed && !oidc?.refresh_token) {
    return null;
  }
  if (oidc && (await isSessionRevoked(oidc))) {
    log.auth.info('Session token refused: the identity provider ended its session', {
      userId: user.id,
    });
    return null;
  }
  return {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    provider: claims.auth_provider || user.auth_provider || 'local',
    claims,
    lapsed,
    oidc,
  };
};

export { sessionTokenOf, resolveRequestAuth };
