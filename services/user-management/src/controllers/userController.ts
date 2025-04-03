import { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/userService';
import { AuthRequest } from '../utils/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  role: z.enum(['student', 'instructor', 'admin']).default('student'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export class UserController {
  constructor(private readonly userService: UserService) {}

  register = async (req: Request, res: Response) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      const user = await this.userService.createUser(validatedData);
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      if (error.message === 'User already exists') {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const user = await this.userService.authenticateUser(
        validatedData.email,
        validatedData.password
      );

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        message: 'Login successful',
        token,
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  getProfile = async (req: AuthRequest, res: Response) => {
    try {
      const user = await this.userService.getUserById(req.user?.userId!);
      res.json({ user });
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  updateProfile = async (req: AuthRequest, res: Response) => {
    try {
      const updateSchema = z.object({
        firstName: z.string().min(2).optional(),
        lastName: z.string().min(2).optional(),
        password: z.string().min(8).optional(),
      });

      const validatedData = updateSchema.parse(req.body);
      const user = await this.userService.updateUser(req.user?.userId!, validatedData);

      res.json({
        message: 'Profile updated successfully',
        user,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      if (error.message === 'User not found') {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}