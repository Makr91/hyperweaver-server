import { log } from '../utils/Logger.js';
import { problem } from '../utils/problem.js';
import { resolveRequestAuth, sessionTokenOf } from '../utils/requestAuth.js';

const unauthenticated = (req, res) =>
  problem(res, req, { status: 401, type: 'authentication', title: req.__('auth.unauthorized') });

const adopt = (req, auth) => {
  req.user = {
    userId: auth.userId,
    username: auth.username,
    email: auth.email,
    role: auth.role,
    auth_provider: auth.provider,
  };
  req.userId = auth.userId;
  req.authProvider = auth.provider;
  req.tokenClaims = auth.claims;
  req.lapsedSession = auth.lapsed;
};

/**
 * Require a session: the JWT on `x-access-token` or `Authorization: Bearer`,
 * resolved through `resolveRequestAuth`; a refused credential answers 401.
 * The refresh route alone admits a lapsed federated session.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticate = async (req, res, next) => {
  try {
    const refreshRoute = req.path.endsWith('/auth/refresh-token');
    const auth = await resolveRequestAuth(req, { allowLapsed: refreshRoute });
    if (!auth) {
      return unauthenticated(req, res);
    }
    adopt(req, auth);
    return next();
  } catch (error) {
    log.auth.error('Token authentication error', { error: error.message });
    return problem(res, req, { status: 500, type: 'internal' });
  }
};

export const authenticateToken = authenticate;

/**
 * Role-based authorization middleware
 * @param {string|Array} allowedRoles - Single role or array of allowed roles
 * @returns {Function} Express middleware function
 */
export const authorize = allowedRoles => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const userRole = req.user.role;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
    });
  }

  return next();
};

/**
 * Admin-only authorization middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges required',
    });
  }

  return next();
};

/**
 * Super-admin-only authorization middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (req.user.role !== 'super-admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin privileges required',
    });
  }

  return next();
};

/**
 * Optional JWT authentication middleware - doesn't fail if no auth provided (CSRF-safe)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const optionalAuth = async (req, res, next) => {
  void res;
  if (!sessionTokenOf(req)) {
    return next();
  }
  try {
    const auth = await resolveRequestAuth(req);
    if (auth) {
      adopt(req, auth);
    }
  } catch (error) {
    log.auth.warn('Optional auth error', { error: error.message });
  }
  return next();
};
