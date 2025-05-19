import { Request, Response } from 'express';
import { config } from '../config';
import { AuthRequest } from '../middleware/auth';
import { CreateUserDTO, UpdateUserDTO } from '../models/User';
import { userService } from '../services/UserService';
import { sessionService } from '../services/SessionService';
import { signToken } from '../utils/jwt';
import { z } from 'zod';

const PasswordResetDTO = z.object({
  password: z.string().min(8)
});

export class UserController {
  async register(req: Request, res: Response) {
    const userData = CreateUserDTO.parse(req.body);
    const user = await userService.createUser(userData);

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        status: 'error',
        message: 'Verification token is required'
      });
      return;
    }

    try {
      await userService.verifyEmail(token);
      res.json({
        status: 'success',
        message: 'Email verified successfully'
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          status: 'error',
          message: error.message
        });
      } else {
        res.status(500).json({
          status: 'error',
          message: 'An unexpected error occurred'
        });
      }
    }
  }

  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
      return;
    }

    try {
      await userService.requestPasswordReset(email);
      res.json({
        status: 'success',
        message: 'If an account exists with this email, you will receive password reset instructions'
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'An unexpected error occurred'
      });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token } = req.query;
    const result = PasswordResetDTO.safeParse(req.body);

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        status: 'error',
        message: 'Reset token is required'
      });
      return;
    }

    if (!result.success) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid password format',
        errors: result.error.errors
      });
      return;
    }

    try {
      await userService.resetPassword(token, result.data.password);
      res.json({
        status: 'success',
        message: 'Password reset successfully'
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          status: 'error',
          message: error.message
        });
      } else {
        res.status(500).json({
          status: 'error',
          message: 'An unexpected error occurred'
        });
      }
    }
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const user = await userService.validateUser(email, password);

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Create a session
    await sessionService.createSession(user.id, token);

    res.json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  }

  async getProfile(req: AuthRequest, res: Response) {
    const user = await userService.getUserById(req.user!.id);

    res.json({
      status: 'success',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  }

  async updateProfile(req: AuthRequest, res: Response) {
    const updateData = UpdateUserDTO.parse(req.body);
    const user = await userService.updateUser(req.user!.id, updateData);

    res.json({
      status: 'success',
      data: user
    });
  }

  async getAllUsers(_req: Request, res: Response) {
    const users = await userService.getAllUsers();
    
    res.json({
      status: 'success',
      data: users
    });
  }

  async getUserById(req: Request, res: Response) {
    const user = await userService.getUserById(parseInt(req.params.id));

    res.json({
      status: 'success',
      data: user
    });
  }
}

export const userController = new UserController();