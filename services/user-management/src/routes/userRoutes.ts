iximport express from 'express';
import { register, login, getProfile, updateProfile } from '../controllers/userController';
import { authenticateToken } from '../utils/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);

export default router;