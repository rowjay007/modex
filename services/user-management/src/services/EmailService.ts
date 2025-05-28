import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

const hasEmailCredentials = Boolean(
  config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPassword
);

const transporter = hasEmailCredentials 
  ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: true,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      }
    })
  : {
      sendMail: async (mailOptions: any) => {
        logger.info(`[MOCK EMAIL] Would send email to: ${mailOptions.to}`);
        logger.info(`[MOCK EMAIL] Subject: ${mailOptions.subject}`);
        return { messageId: `mock-email-${Date.now()}` };
      }
    };

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verificationUrl = `${config.appUrl}/verify-email?token=${token}`;
  
  if (!hasEmailCredentials) {
    logger.info(`[DEV] Verification token for ${to}: ${token}`);
    logger.info(`[DEV] Verification URL: ${verificationUrl}`);
  }

  await transporter.sendMail({
    from: config.emailFrom || 'noreply@example.com',
    to,
    subject: 'Verify Your Email Address',
    html: `
      <h1>Email Verification</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>This link will expire in 24 hours.</p>
    `
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${config.appUrl}/reset-password?token=${token}`;

  if (!hasEmailCredentials) {
    logger.info(`[DEV] Password reset token for ${to}: ${token}`);
    logger.info(`[DEV] Reset URL: ${resetUrl}`);
  }

  await transporter.sendMail({
    from: config.emailFrom || 'noreply@example.com',
    to,
    subject: 'Password Reset Request',
    html: `
      <h1>Password Reset</h1>
      <p>You requested to reset your password. Click the link below to proceed:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  });
}

export const emailService = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
