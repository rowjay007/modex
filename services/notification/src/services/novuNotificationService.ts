import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { novuService } from '../utils/novuIntegration';
import type { Channel, Priority } from '../models/notificationModel';

interface NovuNotificationOptions {
  templateId?: string;
  payload?: Record<string, unknown>;
  overrides?: {
    email?: {
      subject?: string;
      textContent?: string;
      htmlContent?: string;
    };
    sms?: {
      content?: string;
    };
    push?: {
      title?: string;
      content?: string;
      data?: Record<string, unknown>;
    };
    in_app?: {
      title?: string;
      content?: string;
      data?: Record<string, unknown>;
    };
  };
}

export async function initializeNovuService(): Promise<void> {
  try {
    await novuService.initialize();
    logger.info('Novu notification service initialized');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize Novu notification service', { error });
    throw new AppError(500, `Failed to initialize Novu service: ${errorMessage}`);
  }
}

export async function registerUser(
  userId: number,
  email?: string,
  phone?: string,
  firstName?: string,
  lastName?: string
): Promise<any> {
  try {
    const subscriberId = userId.toString();
    
    const subscriber = await novuService.createSubscriber({
      subscriberId,
      email,
      firstName,
      lastName,
      phone,
      data: {
        userId: userId
      }
    });
    
    logger.info(`User registered with Novu: ${subscriberId}`);
    return subscriber;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to register user with Novu', { userId, error });
    throw new AppError(500, `Failed to register user with Novu: ${errorMessage}`);
  }
}

export async function sendNotification(
  userId: number,
  channel: Channel,
  subject: string,
  content: string,
  priority: Priority = 'medium',
  options: NovuNotificationOptions = {}
): Promise<any> {
  try {
    const subscriberId = userId.toString();
    
    // Determine which template to use based on channel and priority
    const eventName = options.templateId || `${channel}_notification_${priority}`;
    
    // Prepare payload
    const payload = {
      subject,
      content,
      priority,
      ...(options.payload || {})
    };
    
    // Prepare channel-specific overrides
    const overrides: Record<string, unknown> = {};
    
    if (channel === 'email' && options.overrides?.email) {
      overrides.email = options.overrides.email;
    } else if (channel === 'sms' && options.overrides?.sms) {
      overrides.sms = options.overrides.sms;
    } else if (channel === 'push' && options.overrides?.push) {
      overrides.push = options.overrides.push;
    } else if (channel === 'in_app' && options.overrides?.in_app) {
      overrides.in_app = options.overrides.in_app;
    }
    
    // Send notification via Novu
    const result = await novuService.triggerEvent({
      name: eventName,
      to: { subscriberId },
      payload,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined
    });
    
    logger.info(`Notification sent via Novu: ${eventName}`, { userId, channel });
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send notification via Novu', { userId, channel, error });
    throw new AppError(500, `Failed to send notification via Novu: ${errorMessage}`);
  }
}

export async function updateUserPreferences(userId: number, preferences: Record<string, boolean>): Promise<any> {
  try {
    const subscriberId = userId.toString();
    
    // Convert preferences object to a JSON string to satisfy Novu type constraints
    const subscriber = await novuService.createSubscriber({
      subscriberId,
      data: {
        // Cast preferences to string to satisfy type constraints
        preferences: JSON.stringify(preferences) as any
      }
    });
    
    logger.info(`User preferences updated in Novu: ${subscriberId}`);
    return subscriber;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update user preferences in Novu', { userId, error });
    throw new AppError(500, `Failed to update user preferences in Novu: ${errorMessage}`);
  }
}

export async function deleteUser(userId: number): Promise<boolean> {
  try {
    const subscriberId = userId.toString();
    
    await novuService.deleteSubscriber(subscriberId);
    
    logger.info(`User deleted from Novu: ${subscriberId}`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete user from Novu', { userId, error });
    throw new AppError(500, `Failed to delete user from Novu: ${errorMessage}`);
  }
}

export const novuNotificationService = {
  initialize: initializeNovuService,
  registerUser,
  sendNotification,
  updateUserPreferences,
  deleteUser
};
