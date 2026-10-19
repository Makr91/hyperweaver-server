import { Router } from 'express';
import { reportClientErrors } from '../controllers/client_errors/report.js';
import { standardLimiter } from './limiters.js';

const router = Router();

router.post('/client-errors', standardLimiter, reportClientErrors);

export default router;
