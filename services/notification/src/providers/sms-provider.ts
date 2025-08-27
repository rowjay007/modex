// Simple SMS provider mock - replace with actual Twilio implementation
class Twilio {
  constructor(private accountSid: string, private authToken: string) {}
  
  messages = {
    create: async (options: any) => ({
      sid: 'mock_' + Math.random().toString(36).substr(2, 9),
      status: 'sent'
    }),
    fetch: async () => ({
      sid: 'mock_sid',
      status: 'delivered',
      errorCode: null,
      errorMessage: null,
      dateCreated: new Date(),
      dateUpdated: new Date(),
      dateSent: new Date()
    })
  }
  
  api = {
    accounts: (sid: string) => ({
      fetch: async () => ({ sid, status: 'active' })
    })
  }
}
import { SMSConfig, NotificationRequest } from '../types/notification'
import { logger } from '../utils/logger'

export class SMSProvider {
  private client: Twilio
  private config: SMSConfig

  constructor(config: SMSConfig) {
    this.config = config
    this.client = new Twilio(config.accountSid, config.authToken)
  }

  async sendSMS(notification: NotificationRequest): Promise<void> {
    try {
      const phoneNumber = notification.metadata?.phoneNumber || notification.recipientId
      
      if (!this.isValidPhoneNumber(phoneNumber)) {
        throw new Error(`Invalid phone number: ${phoneNumber}`)
      }

      const message = await this.client.messages.create({
        body: this.formatSMSContent(notification.content),
        from: this.config.fromNumber,
        to: phoneNumber,
        statusCallback: `${process.env.BASE_URL}/api/v1/notifications/webhooks/sms`,
        statusCallbackMethod: 'POST'
      })

      logger.info('SMS sent successfully', {
        notificationId: notification.id,
        recipient: phoneNumber,
        messageSid: message.sid,
        status: message.status
      })

    } catch (error) {
      logger.error('Failed to send SMS', {
        notificationId: notification.id,
        recipient: notification.recipientId,
        error: error.message
      })
      throw error
    }
  }

  private formatSMSContent(content: string): string {
    // Truncate content to SMS limit (160 characters for single SMS)
    const maxLength = 160
    if (content.length <= maxLength) {
      return content
    }
    
    return content.substring(0, maxLength - 3) + '...'
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    return phoneRegex.test(phoneNumber)
  }

  async getMessageStatus(messageSid: string): Promise<any> {
    try {
      const message = await this.client.messages.fetch()
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        dateSent: message.dateSent
      }
    } catch (error) {
      logger.error('Failed to get SMS status', { messageSid, error: error.message })
      throw error
    }
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.client.api.accounts(this.config.accountSid).fetch()
      logger.info('SMS configuration validated')
      return true
    } catch (error) {
      logger.error('SMS configuration validation failed', error)
      return false
    }
  }
}
