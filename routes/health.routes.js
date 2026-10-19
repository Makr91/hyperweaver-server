import { Router } from 'express';
import { getHealth } from '../controllers/HealthController.js';
import { standardLimiter } from './limiters.js';

const router = Router();

router.get('/health', standardLimiter, getHealth);

export default router;
