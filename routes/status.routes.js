import { Router } from 'express';
import StatusController from '../controllers/StatusController.js';
import { standardLimiter } from './limiters.js';

const router = Router();

router.get('/status', standardLimiter, StatusController.getServerStatus);

export default router;
