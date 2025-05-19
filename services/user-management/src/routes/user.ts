import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { userController } from '../controllers/UserController';
import { authenticate, authorize } from '../middleware/auth';

export const userRoutes = Router();

// Get user profile
userRoutes.get('/profile', authenticate, asyncHandler(userController.getProfile.bind(userController)));

// Update user profile
userRoutes.patch('/profile', authenticate, asyncHandler(userController.updateProfile.bind(userController)));

// Admin: Get all users
userRoutes.get('/', authenticate, authorize('admin'), asyncHandler(userController.getAllUsers.bind(userController)));

// Admin: Get user by ID
userRoutes.get('/:id', authenticate, authorize('admin'), asyncHandler(userController.getUserById.bind(userController)));