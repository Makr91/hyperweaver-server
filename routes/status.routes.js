import { Router } from 'express';
import cors from 'cors';
import StatusController from '../controllers/StatusController.js';
import { standardLimiter } from './limiters.js';

const router = Router();

router.get(
  '/status',
  cors({ origin: true, methods: ['GET'] }),
  standardLimiter,
  StatusController.getServerStatus
);

export default router;
