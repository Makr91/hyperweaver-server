import { Router } from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../auth/auth.js';
import OrganizationController from '../controllers/OrganizationController.js';
import InvitationController from '../controllers/InvitationController.js';
import { adminLimiter, standardLimiter } from './limiters.js';

const router = Router();

router.get(
  '/organizations',
  adminLimiter,
  authenticate,
  requireSuperAdmin,
  OrganizationController.getAllOrganizations
);
router.get(
  '/organizations/:id',
  adminLimiter,
  authenticate,
  requireAdmin,
  OrganizationController.getOrganization
);
router.put(
  '/organizations/:id',
  adminLimiter,
  authenticate,
  requireAdmin,
  OrganizationController.updateOrganization
);
router.get(
  '/organizations/:id/users',
  adminLimiter,
  authenticate,
  requireAdmin,
  OrganizationController.getOrganizationUsers
);
router.get(
  '/organizations/:id/stats',
  adminLimiter,
  authenticate,
  requireAdmin,
  OrganizationController.getOrganizationStats
);
router.get(
  '/organizations/check/:name',
  standardLimiter,
  OrganizationController.checkOrganizationExists
);
router.put(
  '/organizations/:orgId/deactivate',
  adminLimiter,
  authenticate,
  requireSuperAdmin,
  OrganizationController.deactivateOrganization
);
router.delete(
  '/organizations/:orgId',
  adminLimiter,
  authenticate,
  requireSuperAdmin,
  OrganizationController.deleteOrganization
);

router.post(
  '/invitations/send',
  adminLimiter,
  authenticate,
  requireAdmin,
  InvitationController.sendInvitation
);
router.post(
  '/invitations',
  adminLimiter,
  authenticate,
  requireAdmin,
  InvitationController.createInvitation
);
router.get(
  '/invitations',
  adminLimiter,
  authenticate,
  requireAdmin,
  InvitationController.getInvitations
);
router.post(
  '/invitations/:id/resend',
  adminLimiter,
  authenticate,
  requireAdmin,
  InvitationController.resendInvitation
);
router.delete(
  '/invitations/:id',
  adminLimiter,
  authenticate,
  requireAdmin,
  InvitationController.revokeInvitation
);
router.get('/invitations/validate/:code', standardLimiter, InvitationController.validateInvitation);

export default router;
