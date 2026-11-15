import { Router } from 'express';
import { authJwt, verifyOrgAccess } from '../middleware/index.js';
import { apiLimiter, authLimiter } from '../middleware/rateLimiter.js';
import { changeOwnPassword } from '../controllers/account/password.js';
import { deleteOwnAccount } from '../controllers/account/remove.js';
import { resendInvitation } from '../controllers/auth/invitation/resend.js';
import {
  getOrganizationStats,
  checkOrganizationExists,
  listOrganizations,
} from '../controllers/organization/stats.js';

const router = Router();

router.use((req, res, next) => {
  void req;
  res.header('Access-Control-Allow-Headers', 'x-access-token, Origin, Content-Type, Accept');
  next();
});

router.post(
  '/auth/change-password',
  authLimiter,
  authJwt.verifyToken,
  authJwt.isUser,
  changeOwnPassword
);

router.delete(
  '/auth/delete-account',
  authLimiter,
  authJwt.verifyToken,
  authJwt.isUser,
  deleteOwnAccount
);

router.post(
  '/invitations/:id/resend',
  apiLimiter,
  authJwt.verifyToken,
  authJwt.isUser,
  resendInvitation
);

router.get(
  '/organization/:organization/stats',
  apiLimiter,
  authJwt.verifyToken,
  authJwt.isUser,
  verifyOrgAccess.isOrgAdminOrOwner,
  getOrganizationStats
);

router.get('/organizations/check/:name', apiLimiter, checkOrganizationExists);

router.get(
  '/organizations',
  apiLimiter,
  authJwt.verifyToken,
  authJwt.isUser,
  authJwt.isAdmin,
  listOrganizations
);

export default router;
