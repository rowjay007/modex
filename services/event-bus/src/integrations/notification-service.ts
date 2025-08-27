import axios from 'axios'
import { logger } from '../utils/logger'

export interface NotificationRequest {
  recipientId: string
  type: 'email' | 'sms' | 'push' | 'in_app'
  template: string
  subject?: string
  content: string
  metadata?: Record<string, any>
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export class NotificationService {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007'
    this.apiKey = process.env.NOTIFICATION_SERVICE_API_KEY || 'dev-key'
  }

  async sendNotification(request: NotificationRequest): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/api/v1/notifications`, request, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })

      logger.info('Notification sent successfully', {
        recipientId: request.recipientId,
        type: request.type,
        template: request.template
      })
    } catch (error) {
      logger.error('Failed to send notification', {
        recipientId: request.recipientId,
        type: request.type,
        error: error.message
      })
      
      // Don't throw error to prevent event processing failure
      // Notifications are not critical for event processing
    }
  }

  async sendBulkNotifications(requests: NotificationRequest[]): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/api/v1/notifications/bulk`, {
        notifications: requests
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })

      logger.info('Bulk notifications sent successfully', {
        count: requests.length
      })
    } catch (error) {
      logger.error('Failed to send bulk notifications', {
        count: requests.length,
        error: error.message
      })
    }
  }
}
