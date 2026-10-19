import { Router } from 'express';
import { getRules } from '../controllers/rules.controller.js';
import { standardLimiter } from './limiters.js';

const router = Router();

router.get('/rules', standardLimiter, getRules);

export default router;
