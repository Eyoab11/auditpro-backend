// src/routes/authRoutes.ts
import { Router } from 'express';
import {
  register,
  login,
  getMe
} from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

// @route    POST /api/auth/register
// @desc     Register a new user
// @access   Public
router.post('/register', register);

// @route    POST /api/auth/login
// @desc     Login user
// @access   Public
router.post('/login', login);

// @route    GET /api/auth/me
// @desc     Get current logged in user
// @access   Private
router.get('/me', protect, getMe);

export default router;
