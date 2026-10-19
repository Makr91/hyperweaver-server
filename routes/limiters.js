/**
 * @fileoverview Rate limiting configuration (CodeQL security fix). Configurable tiered
 * approach based on endpoint sensitivity and resource usage; limits load from config.yaml.
 */

import { apiLimiter, authLimiter, proxyLimiter, spaLimiter } from '../middleware/rateLimiter.js';

export { authLimiter };

export const adminLimiter = apiLimiter;

export const apiProxyLimiter = proxyLimiter;

export const standardLimiter = apiLimiter;

export const staticFileLimiter = spaLimiter;
