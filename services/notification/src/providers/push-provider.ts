// Simple web-push mock implementation
const webpush = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => {},
  sendNotification: async (subscription: any, payload: string, options?: any) => ({
    statusCode: 200,
    body: 'Mock notification sent'
  }),
  generateVAPIDKeys: () => ({
    publicKey: 'mock_public_key_' + Math.random().toString(36).substr(2, 9),
    privateKey: 'mock_private_key_' + Math.random().toString(36).substr(2, 9)
  })
}
import { PushConfig, NotificationRequest } from '../types/notification'
import { logger } from '../utils/logger'

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export class PushProvider {
  private config: PushConfig

  constructor(config: PushConfig) {
    this.config = config
    webpush.setVapidDetails(
      config.vapidSubject,
      config.vapidPublicKey,
      config.vapidPrivateKey
    )
  }

  async sendPushNotification(
    notification: NotificationRequest,
    subscription: PushSubscription
  ): Promise<void> {
    try {
      const payload = JSON.stringify({
        title: notification.subject || 'Modex Notification',
        body: notification.content,
        icon: '/icons/notification-icon.png',
        badge: '/icons/notification-badge.png',
        data: {
          notificationId: notification.id,
          url: notification.metadata?.url,
          actionUrl: notification.metadata?.actionUrl,
          ...notification.metadata
        },
        actions: this.getNotificationActions(notification),
        requireInteraction: notification.priority === 'urgent',
        silent: notification.priority === 'low',
        timestamp: Date.now(),
        tag: notification.template
      })

      const options = {
        vapidDetails: {
          subject: this.config.vapidSubject,
          publicKey: this.config.vapidPublicKey,
          privateKey: this.config.vapidPrivateKey
        },
        TTL: this.getTTL(notification.priority),
        urgency: this.getUrgency(notification.priority),
        headers: {
          'Topic': notification.template
        }
      }

      const result = await webpush.sendNotification(subscription, payload, options)

      logger.info('Push notification sent successfully', {
        notificationId: notification.id,
        recipient: notification.recipientId,
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        statusCode: result.statusCode
      })

    } catch (error) {
      logger.error('Failed to send push notification', {
        notificationId: notification.id,
        recipient: notification.recipientId,
        error: error.message,
        statusCode: error.statusCode
      })

      // Handle specific push notification errors
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription is no longer valid
        logger.warn('Push subscription is invalid', {
          recipient: notification.recipientId,
          endpoint: subscription.endpoint
        })
        // TODO: Remove invalid subscription from database
      }

      throw error
    }
  }

  private getNotificationActions(notification: NotificationRequest): any[] {
    const actions: any[] = []

    if (notification.metadata?.actionUrl) {
      actions.push({
        action: 'open',
        title: 'Open',
        icon: '/icons/open-icon.png'
      })
    }

    if (notification.type === 'in_app') {
      actions.push({
        action: 'mark-read',
        title: 'Mark as Read',
        icon: '/icons/check-icon.png'
      })
    }

    actions.push({
      action: 'dismiss',
      title: 'Dismiss',
      icon: '/icons/close-icon.png'
    })

    return actions
  }

  private getTTL(priority: string): number {
    const ttlMap = {
      'urgent': 3600,     // 1 hour
      'high': 86400,      // 1 day
      'medium': 259200,   // 3 days
      'low': 604800       // 1 week
    }
    return ttlMap[priority] || 86400
  }

  private getUrgency(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
    const urgencyMap = {
      'urgent': 'high' as const,
      'high': 'high' as const,
      'medium': 'normal' as const,
      'low': 'low' as const
    }
    return urgencyMap[priority] || 'normal'
  }

  generateVAPIDKeys(): { publicKey: string; privateKey: string } {
    return webpush.generateVAPIDKeys()
  }

  async validateSubscription(subscription: PushSubscription): Promise<boolean> {
    try {
      // Send a test notification to validate the subscription
      const testPayload = JSON.stringify({
        title: 'Test',
        body: 'Subscription validation',
        silent: true
      })

      await webpush.sendNotification(subscription, testPayload, {
        TTL: 60 // 1 minute
      })

      return true
    } catch (error) {
      logger.warn('Push subscription validation failed', {
        endpoint: subscription.endpoint,
        error: error.message
      })
      return false
    }
  }
}
