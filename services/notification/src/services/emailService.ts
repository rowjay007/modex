import nodemailer from 'nodemailer';

// Define Attachment type to fix the type issue
type Attachment = {
  filename?: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
  encoding?: string;
  cid?: string;
};
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { Template } from '../models/notificationModel';

let transporter: nodemailer.Transporter;

function createTransporter() {
  if (config.nodeEnv === 'development' && (!config.emailHost || !config.emailUsername || !config.emailPassword)) {
    logger.info('Using test account for email delivery in development mode');
    return null;
  }

  return nodemailer.createTransport({
    host: config.emailHost,
    port: config.emailPort,
    secure: config.emailPort === 465,
    auth: {
      user: config.emailUsername,
      pass: config.emailPassword,
    },
  });
}

export async function initializeEmailService(): Promise<void> {
  try {
    // Use Mailtrap for both development and production
    transporter = nodemailer.createTransport({
      host: config.emailHost,
      port: config.emailPort,
      secure: false,
      auth: {
        user: config.emailUsername,
        pass: config.emailPassword,
      }
    });
    
    logger.info('Email service initialized with Mailtrap', {
      host: config.emailHost,
      port: config.emailPort
    });
  } catch (error: any) {
    logger.error('Failed to initialize email service', { error });
    throw error;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: {
    cc?: string;
    bcc?: string;
    attachments?: Attachment[];
  } = {}
): Promise<{ success: boolean; messageId?: string; previewUrl?: string }> {
  try {
    if (!transporter) {
      await initializeEmailService();
    }

    const mailOptions = {
      from: config.emailAddress || 'notifications@app.com',
      to,
      subject,
      html,
      ...options,
    };

    const info = await transporter.sendMail(mailOptions);
    
    const previewUrl = typeof nodemailer.getTestMessageUrl === 'function' 
      ? nodemailer.getTestMessageUrl(info)
      : undefined;
      
    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl as string | undefined
    };
  } catch (error: any) {
    logger.error('Failed to send email', { to, subject, error });
    throw new AppError(500, `Failed to send email: ${error.message}`);
  }
}

export function compileTemplate(template: Template, data: Record<string, any>): string {
  let compiledContent = template.content;
  
  // Simple variable replacement
  if (data && typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      compiledContent = compiledContent.replace(regex, String(value));
    });
  }
  
  return compiledContent;
}

export const emailService = {
  initialize: initializeEmailService,
  send: sendEmail,
  compileTemplate,
};
