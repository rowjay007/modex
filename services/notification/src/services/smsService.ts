import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { NovuService } from '../utils/novuIntegration';

// Create Novu service instance for SMS delivery
let novuService: NovuService;

/**
 * Initialize the SMS service using Novu
 */
export async function initializeSmsService(): Promise<void> {
  try {
    novuService = new NovuService();
    logger.info('SMS service initialized with Novu');
  } catch (error) {
    logger.error('Failed to initialize SMS service', { error });
    throw error;
  }
}

/**
 * Send SMS through Novu
 * @param phoneNumber Recipient phone number
 * @param message SMS content
 * @param options Optional settings for SMS delivery
 * @returns Success status and message ID
 */
export async function sendSms(
  phoneNumber: string,
  message: string,
  options: {
    senderId?: string;
    priority?: 'high' | 'medium' | 'low';
    templateId?: string;
  } = {}
): Promise<{ success: boolean; messageId?: string }> {
  try {
    if (!novuService) {
      await initializeSmsService();
    }

    // For development mode without full setup, simulate SMS delivery
    if (config.nodeEnv === 'development' && !config.novuApiKey) {
      logger.info('SMS would be sent in development mode', { phoneNumber, message });
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    // Prepare message data for Novu
    const result = await novuService.triggerEvent({
      name: options.templateId || 'sms-notification',
      to: {
        subscriberId: phoneNumber, // Use phone number as subscriber ID
        phone: phoneNumber
      },
      payload: {
        message: message,
        sender: options.senderId || 'MODEX'
      },
      overrides: {
        sms: {
          content: message
        }
      }
    });

    logger.info('SMS sent successfully via Novu', { messageId: result.data?.id });
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    logger.error('Failed to send SMS', { phoneNumber, error });
    if (error instanceof Error) {
      throw new AppError(500, `Failed to send SMS: ${error.message}`);
    }
    throw new AppError(500, 'Unknown error occurred while sending SMS');
  }
}

export const smsService = {
  initialize: initializeSmsService,
  send: sendSms,
};
