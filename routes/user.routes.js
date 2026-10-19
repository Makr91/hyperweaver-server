import { Router } from 'express';
import { authenticate } from '../auth/auth.js';
import { oidcTokenRefresh } from '../auth/oidcTokenRefresh.js';
import { getUserProfile } from '../controllers/user/getuserprofile.js';
import { updatePreferences } from '../controllers/user/preferences.js';
import { standardLimiter } from './limiters.js';

const router = Router();

router.get('/user', standardLimiter, authenticate, oidcTokenRefresh, getUserProfile);
router.patch(
  '/user/preferences',
  standardLimiter,
  authenticate,
  oidcTokenRefresh,
  updatePreferences
);

export default router;
