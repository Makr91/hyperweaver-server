import { Router } from 'express';
import { authenticate } from '../auth/auth.js';
import { oidcTokenRefresh } from '../auth/oidcTokenRefresh.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import {
  pushNotOffered,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notification.controller.js';

const router = Router();

router.use((req, res, next) => {
  void req;
  res.header('Access-Control-Allow-Headers', 'x-access-token, Origin, Content-Type, Accept');
  next();
});

const notificationAuth = [authenticate, oidcTokenRefresh];

router.get('/notifications/vapid-key', apiLimiter, pushNotOffered);

router.post('/notifications/subscriptions', apiLimiter, authenticate, pushNotOffered);

router.delete('/notifications/subscriptions', apiLimiter, authenticate, pushNotOffered);

router.post('/notifications/test/toast', apiLimiter, authenticate, pushNotOffered);

router.post('/notifications/test/channel', apiLimiter, authenticate, pushNotOffered);

router.get('/notifications', apiLimiter, notificationAuth, listNotifications);

router.get('/notifications/unread-count', apiLimiter, notificationAuth, getUnreadCount);

router.post('/notifications/read-all', apiLimiter, notificationAuth, markAllNotificationsRead);

router.delete('/notifications', apiLimiter, notificationAuth, deleteAllNotifications);

router.post('/notifications/:id/read', apiLimiter, notificationAuth, markNotificationRead);

router.delete('/notifications/:id', apiLimiter, notificationAuth, deleteNotification);

export default router;
