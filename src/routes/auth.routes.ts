import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new AuthController();

router.post('/signup', (req, res) => controller.signup(req, res));
router.post('/login', (req, res) => controller.login(req, res));
router.post('/connect-todoist', authMiddleware, (req, res) => controller.connectTodoist(req, res));
router.get('/profile', authMiddleware, (req, res) => controller.getProfile(req, res));

export { router as authRoutes };