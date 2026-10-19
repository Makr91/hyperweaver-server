import { Router } from 'express';
import { authenticate, requireAdmin, requireSuperAdmin } from '../auth/auth.js';
import UserManagementController from '../controllers/UserManagementController.js';
import MailController from '../controllers/MailController.js';
import { adminLimiter } from './limiters.js';

const router = Router();

router.get(
  '/admin/users',
  adminLimiter,
  authenticate,
  requireAdmin,
  UserManagementController.getAllUsers
);
router.put(
  '/admin/users/role',
  adminLimiter,
  authenticate,
  requireAdmin,
  UserManagementController.updateUserRole
);
router.delete(
  '/admin/users/:userId',
  adminLimiter,
  authenticate,
  requireAdmin,
  UserManagementController.deactivateUser
);
router.put(
  '/admin/users/:userId/reactivate',
  adminLimiter,
  authenticate,
  requireAdmin,
  UserManagementController.reactivateUser
);
router.delete(
  '/admin/users/:userId/delete',
  adminLimiter,
  authenticate,
  requireSuperAdmin,
  UserManagementController.deleteUser
);

router.post('/mail/test', adminLimiter, authenticate, requireSuperAdmin, MailController.testMail);

export default router;
