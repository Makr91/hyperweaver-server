import { Router, urlencoded } from 'express';
import { authenticate, optionalAuth, requireSuperAdmin } from '../auth/auth.js';
import { oidcTokenRefresh } from '../auth/oidcTokenRefresh.js';
import AuthController from '../controllers/AuthController.js';
import RegistrationController from '../controllers/RegistrationController.js';
import AccountController from '../controllers/AccountController.js';
import LdapController from '../controllers/LdapController.js';
import OidcController from '../controllers/OidcController.js';
import UserManagementController from '../controllers/UserManagementController.js';
import { signin, exchange, refreshToken, oidcLogout } from '../controllers/auth/signin.js';
import { authLimiter, adminLimiter, standardLimiter } from './limiters.js';

const router = Router();

router.post('/auth/register', authLimiter, RegistrationController.register);
router.post('/auth/signin', authLimiter, signin);
router.post('/auth/oidc/exchange', authLimiter, exchange);
router.post('/auth/refresh-token', authLimiter, authenticate, oidcTokenRefresh, refreshToken);
router.post('/auth/oidc/logout', standardLimiter, optionalAuth, oidcLogout);
router.post('/auth/ldap', authLimiter, LdapController.ldapLogin);
router.get('/auth/oidc/callback', standardLimiter, OidcController.handleOidcCallback);
router.post(
  '/auth/oidc/backchannel-logout',
  standardLimiter,
  urlencoded({ extended: false }),
  OidcController.handleBackchannelLogout
);
router.get('/auth/oidc/issuers', standardLimiter, OidcController.getOidcIssuers);
router.get('/auth/oidc/:provider', standardLimiter, OidcController.startOidcLogin);
router.post('/auth/change-password', authLimiter, authenticate, AccountController.changePassword);
router.delete(
  '/auth/delete-account',
  authLimiter,
  authenticate,
  UserManagementController.deleteSelfAccount
);
router.get('/auth/setup-status', standardLimiter, RegistrationController.checkSetupStatus);
router.get('/auth/methods', standardLimiter, AuthController.getAuthMethods);
router.post(
  '/auth/ldap/test',
  adminLimiter,
  authenticate,
  requireSuperAdmin,
  LdapController.testLdap
);

export default router;
