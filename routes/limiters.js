/**
 * @fileoverview Rate limiting configuration (CodeQL security fix). Configurable tiered
 * approach based on endpoint sensitivity and resource usage; limits load from config.yaml.
 */

import rateLimit from 'express-rate-limit';
import { getRateLimitConfig } from '../utils/config-loader.js';

const rateLimitConfig = getRateLimitConfig();
const windowMs = rateLimitConfig.window_minutes * 60 * 1000;

const limiter = limit =>
  rateLimit({
    windowMs,
    limit,
    message: { error: rateLimitConfig.message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: rateLimitConfig.skip_successful_requests,
    skipFailedRequests: rateLimitConfig.skip_failed_requests,
  });

export const authLimiter = limiter(rateLimitConfig.auth_max_requests);

export const adminLimiter = limiter(rateLimitConfig.max_requests);

export const apiProxyLimiter = limiter(rateLimitConfig.proxy_max_requests);

export const standardLimiter = limiter(rateLimitConfig.max_requests);

export const staticFileLimiter = limiter(rateLimitConfig.file_operations_max_requests);
