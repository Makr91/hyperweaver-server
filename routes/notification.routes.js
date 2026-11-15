import { Router } from 'express';
import { authJwt, oidcTokenRefresh } from '../middleware/index.js';
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

const notificationAuth = [oidcTokenRefresh, authJwt.verifyToken, authJwt.isUser];
const subscriptionAuth = [authJwt.verifyToken, authJwt.isUser];

router.get('/notifications/vapid-key', apiLimiter, pushNotOffered);

router.post('/notifications/subscriptions', apiLimiter, subscriptionAuth, pushNotOffered);

router.delete('/notifications/subscriptions', apiLimiter, subscriptionAuth, pushNotOffered);

router.post('/notifications/test/toast', apiLimiter, subscriptionAuth, pushNotOffered);

router.post('/notifications/test/channel', apiLimiter, subscriptionAuth, pushNotOffered);

router.get('/notifications', apiLimiter, notificationAuth, listNotifications);

router.get('/notifications/unread-count', apiLimiter, notificationAuth, getUnreadCount);

router.post('/notifications/read-all', apiLimiter, notificationAuth, markAllNotificationsRead);

router.delete('/notifications', apiLimiter, notificationAuth, deleteAllNotifications);

router.post('/notifications/:id/read', apiLimiter, notificationAuth, markNotificationRead);

router.delete('/notifications/:id', apiLimiter, notificationAuth, deleteNotification);

export default router;
