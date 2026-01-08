import { Router } from 'express';
import { SyncController } from '../controllers/sync.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new SyncController();

router.use(authMiddleware);

router.post('/trigger', (req, res) => controller.triggerSync(req, res));
router.post('/retry', (req, res) => controller.retryFailed(req, res));
router.get('/status', (req, res) => controller.getSyncStatus(req, res));

export { router as syncRoutes };