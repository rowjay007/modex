import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { userController } from '../controllers/UserController';

export const authRoutes = Router();

// Register new user
authRoutes.post('/register', asyncHandler(userController.register.bind(userController)));

// Login user
authRoutes.post('/login', asyncHandler(userController.login.bind(userController)));