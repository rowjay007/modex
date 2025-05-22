import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../config/database';
import { users } from '../models/schema';
import { AppError } from '../middleware/error';
import { CreateUserDTO, UpdateUserDTO, User } from '../models/User';
import { emailService } from './EmailService';
import { sessionService } from './SessionService';
import { auditService } from './AuditService';
import crypto from 'crypto';

export class UserService {
  async verifyEmail(token: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, token)
    });

    if (!user) {
      throw new AppError(400, 'Invalid verification token');
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new AppError(400, 'Verification token has expired');
    }

    await db.update(users)
      .set({
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    await auditService.log({
      userId: user.id,
      action: 'EMAIL_VERIFIED',
      details: { email: user.email }
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user) {
      // Don't reveal whether the email exists
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    await emailService.sendPasswordResetEmail(email, resetToken);

    await auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      details: { email: user.email }
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.passwordResetToken, token)
    });

    if (!user) {
      throw new AppError(400, 'Invalid reset token');
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new AppError(400, 'Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptSaltRounds);

    await db.update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    // Invalidate all sessions
    await sessionService.invalidateAllUserSessions(user.id);

    await auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      details: { email: user.email }
    });
  }
  async createUser(data: CreateUserDTO): Promise<User> {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, data.email)
    });

    if (existingUser) {
      throw new AppError(400, 'Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, config.bcryptSaltRounds);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const newUser = await db.insert(users).values({
      ...data,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    }).returning();

    const user = newUser[0];

    // Send verification email
    await emailService.sendVerificationEmail(user.email, verificationToken);
    
    // Log the action
    await auditService.log({
      userId: user.id,
      action: 'USER_CREATED',
      details: { email: user.email }
    });

    return user;
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new AppError(403, 'Please verify your email address');
    }

    // Update last login time
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Log the action
    await auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      details: { email: user.email }
    });

    return user;
  }

  async getUserById(id: number): Promise<User> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return user;
  }

  async updateUser(id: number, data: UpdateUserDTO): Promise<User> {
    const updatedUser = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser.length) {
      throw new AppError(404, 'User not found');
    }

    return updatedUser[0];
  }

  async getAllUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result as unknown as User[];
  }
}

export const userService = new UserService();
