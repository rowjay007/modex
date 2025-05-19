import nodemailer from 'nodemailer';
import { config } from '../config';

export class EmailService {
  private transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: true,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword
    }
  });

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verificationUrl = `${config.appUrl}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: config.emailFrom,
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

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: config.emailFrom,
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
}

export const emailService = new EmailService();
