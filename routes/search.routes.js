import { Router } from 'express';
import { authenticate } from '../auth/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { search } from '../controllers/search/search.js';

const router = Router();

router.use((req, res, next) => {
  void req;
  res.header('Access-Control-Allow-Headers', 'x-access-token, Origin, Content-Type, Accept');
  next();
});

router.get('/search', apiLimiter, authenticate, search);

export default router;
