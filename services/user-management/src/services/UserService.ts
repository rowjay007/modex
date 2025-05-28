import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../config/database';
import { users } from '../models/schema';
import { AppError } from '../utils/AppError';
import { CreateUserDTO, UpdateUserDTO, User } from '../models/User';
import { emailService } from './EmailService';
import { sessionService } from './SessionService';
import { auditService } from './AuditService';
import crypto from 'crypto';

/**
 * Verify a user's email using the verification token
 */
export async function verifyEmail(token: string): Promise<void> {
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

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  });

  if (!user) {
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

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

export async function resetPassword(token: string, newPassword: string): Promise<void> {
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

  await sessionService.invalidateAllUserSessions(user.id);

  await auditService.log({
    userId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    details: { email: user.email }
  });
}

export async function createUser(data: CreateUserDTO): Promise<User> {
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

  await emailService.sendVerificationEmail(user.email, verificationToken);
  
  await auditService.log({
    userId: user.id,
    action: 'USER_CREATED',
    details: { email: user.email }
  });

  return user;
}

export async function validateUser(email: string, password: string): Promise<User> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError(401, 'Invalid credentials');
  }

  if (!user.isEmailVerified) {
    throw new AppError(403, 'Please verify your email address');
  }

  await db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await auditService.log({
    userId: user.id,
    action: 'USER_LOGIN',
    details: { email: user.email }
  });

  return user;
}

export async function getUserById(id: number): Promise<User> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id)
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
}

export async function updateUser(id: number, data: UpdateUserDTO): Promise<User> {
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

export async function getAllUsers(): Promise<User[]> {
  const result = await db.select().from(users);
  return result as unknown as User[];
}

export async function deleteUser(id: number): Promise<void> {
  const user = await getUserById(id);
  
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  
  // Log the action before deleting
  await auditService.log({
    userId: id,
    action: 'USER_DELETED',
    details: { email: user.email }
  });
  
  // Delete the user
  await db.delete(users).where(eq(users.id, id));
}

export interface UserConsent {
  cookieConsent?: boolean;
  marketingConsent?: boolean;
  privacyPolicyAccepted?: boolean;
  termsAccepted?: boolean;
}

export async function updateUserConsent(id: number, consent: UserConsent): Promise<void> {
  const user = await getUserById(id);
  
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  
  // Update consent fields
  await db.update(users)
    .set({
      ...consent,
      consentUpdatedAt: new Date()
    })
    .where(eq(users.id, id));
    
  // Log consent update for compliance
  await auditService.log({
    userId: id,
    action: 'CONSENT_UPDATED',
    details: {
      ...consent,
      timestamp: new Date().toISOString()
    }
  });
}

export async function exportUserData(id: number): Promise<any> {
  const user = await getUserById(id);
  
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  
  // Get all user-related data for GDPR compliance
  const userData = {
    profile: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    // Exclude sensitive data like password
    consent: {
      cookieConsent: user.cookieConsent,
      marketingConsent: user.marketingConsent,
      privacyPolicyAccepted: user.privacyPolicyAccepted,
      termsAccepted: user.termsAccepted,
      consentUpdatedAt: user.consentUpdatedAt
    }
  };
  
  return userData;
}

export async function generate2FASecret(id: number): Promise<{ secret: string, qrCodeUrl: string }> {
  const user = await getUserById(id);
  
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  
  // Generate a random secret for 2FA
  const secret = crypto.randomBytes(20).toString('hex');
  
  // In a real implementation, we would use a library like 'speakeasy' to generate a proper TOTP secret
  // and QR code URL, but for this example we'll create a simple placeholder
  
  // Update the user with the 2FA secret
  await db.update(users)
    .set({
      twoFactorSecret: secret,
      twoFactorEnabled: false // Not enabled until verified
    })
    .where(eq(users.id, id));
  
  return {
    secret,
    qrCodeUrl: `otpauth://totp/ModexApp:${user.email}?secret=${secret}&issuer=ModexApp`
  };
}

export async function verify2FAToken(id: number, token: string): Promise<boolean> {
  const user = await getUserById(id);
  
  if (!user || !user.twoFactorSecret) {
    throw new AppError(400, '2FA not set up for this user');
  }
  
  // In a real implementation, we would use 'speakeasy' to verify the token
  // For this example, we'll simulate a simple verification
  // This is NOT secure and is just for demonstration
  const isValid = token.length === 6 && /^\d+$/.test(token);
  
  return isValid;
}

export async function enable2FA(id: number): Promise<void> {
  const user = await getUserById(id);
  
  if (!user) {
    throw new AppError(404, 'User not found');
  }
  
  if (!user.twoFactorSecret) {
    throw new AppError(400, '2FA secret not set');
  }
  
  // Enable 2FA for the user
  await db.update(users)
    .set({
      twoFactorEnabled: true
    })
    .where(eq(users.id, id));
  
  // Log 2FA enablement for security audit
  await auditService.log({
    userId: id,
    action: 'TWO_FACTOR_ENABLED',
    details: { timestamp: new Date().toISOString() }
  });
}

export const userService = {
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  createUser,
  validateUser,
  getUserById,
  updateUser,
  getAllUsers,
  deleteUser,
  exportUserData,
  updateUserConsent,
  generate2FASecret,
  verify2FAToken,
  enable2FA
};
