import { Router } from 'express';
import ConfigController from '../controllers/ConfigController.js';
import gravatarRouter from './gravatar.js';
import { standardLimiter } from './limiters.js';

const router = Router();

router.use((req, res, next) => {
  void req;
  res.header('Access-Control-Allow-Headers', 'x-access-token, Origin, Content-Type, Accept');
  next();
});

router.use(gravatarRouter);
router.get('/config/ticket', standardLimiter, ConfigController.getTicketConfig);

export default router;
