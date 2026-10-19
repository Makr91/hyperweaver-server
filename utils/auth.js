import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { loadConfig, saveConfig } from './config-loader.js';
import { log } from './Logger.js';

const { verify, sign } = jwt;

/**
 * Write a random 64-character JWT secret into auth.config.yaml when none is
 * configured, as the service user, through the engine.
 * @returns {Promise<boolean>} True when a secret was written
 */
const ensureJwtSecret = async () => {
  const current = loadConfig('auth').authentication.jwt_secret;
  if (typeof current === 'string' && current.trim() !== '') {
    return false;
  }
  await saveConfig(
    'auth',
    { authentication: { jwt_secret: randomBytes(32).toString('hex') } },
    'hyperweaver-server'
  );
  log.app.info('Generated authentication.jwt_secret');
  return true;
};

/**
 * The issuer and audience claims stamped on every session JWT and enforced
 * on every verification of one.
 * @returns {{issuer: string, audience: string}} The claim options
 */
const getJwtClaimOptions = () => {
  const { authentication } = loadConfig('auth');
  return {
    issuer: authentication.jwt_issuer || 'hyperweaver-server',
    audience: authentication.jwt_audience || 'hyperweaver-ui',
  };
};

/**
 * Verify a session JWT: the signature, the issuer and the audience.
 * @param {string} token - The JWT
 * @param {Object} [options] - Extra verify options
 * @returns {Promise<Object>} The decoded claims
 */
const verifySessionToken = (token, options = {}) => {
  const { authentication } = loadConfig('auth');
  return new Promise((resolve, reject) => {
    verify(
      token,
      authentication.jwt_secret,
      { ...getJwtClaimOptions(), ...options },
      (err, decodedToken) => {
        if (err) {
          reject(err);
        } else {
          resolve(decodedToken);
        }
      }
    );
  });
};

/**
 * Sign a session JWT with the configured secret, issuer, audience and expiry.
 * @param {Object} payload - The claims
 * @returns {string} The JWT
 */
const signSessionToken = payload => {
  const { authentication } = loadConfig('auth');
  return sign(payload, authentication.jwt_secret, {
    algorithm: 'HS256',
    expiresIn: authentication.jwt_expiration,
    ...getJwtClaimOptions(),
  });
};

export { ensureJwtSecret, verifySessionToken, signSessionToken, getJwtClaimOptions };
