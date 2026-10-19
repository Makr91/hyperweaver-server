import { Router } from 'express';
import { authenticate } from '../auth/auth.js';
import { oidcTokenRefresh } from '../auth/oidcTokenRefresh.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { getUserInfoClaims } from '../controllers/favorites/claims.js';
import { getUserFavorites, saveUserFavorites } from '../controllers/favorites/user.js';

const router = Router();

router.use((req, res, next) => {
  void req;
  res.header('Access-Control-Allow-Headers', 'x-access-token, Origin, Content-Type, Accept');
  next();
});

router.get('/user/favorites', apiLimiter, authenticate, oidcTokenRefresh, getUserFavorites);

router.put('/user/favorites', apiLimiter, authenticate, oidcTokenRefresh, saveUserFavorites);

router.get('/userinfo/claims', apiLimiter, authenticate, oidcTokenRefresh, getUserInfoClaims);

export default router;
