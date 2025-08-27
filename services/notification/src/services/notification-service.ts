import { NotificationRequest, NotificationLog, NotificationPreferences } from '../types/notification'
import { EmailProvider } from '../providers/email-provider'
import { SMSProvider } from '../providers/sms-provider'
import { PushProvider, PushSubscription } from '../providers/push-provider'
import { NotificationRepository } from '../repositories/notification-repository'
import { logger } from '../utils/logger'
// Simple UUID generator
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export class NotificationService {
  private emailProvider: EmailProvider
  private smsProvider: SMSProvider
  private pushProvider: PushProvider
  private repository: NotificationRepository

  constructor(
    emailProvider: EmailProvider,
    smsProvider: SMSProvider,
    pushProvider: PushProvider,
    repository: NotificationRepository
  ) {
    this.emailProvider = emailProvider
    this.smsProvider = smsProvider
    this.pushProvider = pushProvider
    this.repository = repository
  }

  async send(request: NotificationRequest): Promise<string> {
    return this.sendNotification(request)
  }

  async sendNotification(request: NotificationRequest): Promise<string> {
    const notificationId = request.id || uuidv4()
    
    try {
      // Check user preferences
      const preferences = await this.repository.getUserPreferences(request.recipientId)
      if (!this.shouldSendNotification(request, preferences)) {
        logger.info('Notification blocked by user preferences', {
          notificationId,
          recipientId: request.recipientId,
          type: request.type
        })
        return notificationId
      }

      // Create notification log
      await this.repository.createNotificationLog({
        notificationId,
        recipientId: request.recipientId,
        type: request.type,
        status: 'pending',
        metadata: request.metadata
      })

      // Add notification ID to request
      request.id = notificationId

      return notificationId
    } catch (error) {
      logger.error('Failed to process notification request', {
        notificationId,
        error: error.message
      })
      throw error
    }
  }

  async processEmailNotification(notification: NotificationRequest): Promise<void> {
    try {
      await this.emailProvider.sendEmail(notification)
      await this.updateNotificationStatus(notification.id!, 'sent')
    } catch (error) {
      await this.updateNotificationStatus(notification.id!, 'failed', error.message)
      throw error
    }
  }

  async processSMSNotification(notification: NotificationRequest): Promise<void> {
    try {
      await this.smsProvider.sendSMS(notification)
      await this.updateNotificationStatus(notification.id!, 'sent')
    } catch (error) {
      await this.updateNotificationStatus(notification.id!, 'failed', error.message)
      throw error
    }
  }

  async processPushNotification(notification: NotificationRequest): Promise<void> {
    try {
      const subscriptions = await this.repository.getPushSubscriptions(notification.recipientId)
      
      for (const subscription of subscriptions) {
        try {
          await this.pushProvider.sendPushNotification(notification, subscription)
        } catch (error) {
          // Don't fail the entire notification if one subscription fails
          logger.warn('Failed to send push to subscription', {
            notificationId: notification.id,
            subscription: subscription.endpoint,
            error: error.message
          })
        }
      }

      await this.updateNotificationStatus(notification.id!, 'sent')
    } catch (error) {
      await this.updateNotificationStatus(notification.id!, 'failed', error.message)
      throw error
    }
  }

  async processInAppNotification(notification: NotificationRequest): Promise<void> {
    try {
      await this.repository.createInAppNotification({
        id: uuidv4(),
        recipientId: notification.recipientId,
        title: notification.subject || 'Notification',
        content: notification.content,
        type: notification.template,
        priority: notification.priority,
        metadata: notification.metadata,
        isRead: false,
        createdAt: new Date()
      })

      await this.updateNotificationStatus(notification.id!, 'delivered')
      
      // Emit real-time event for immediate display
      await this.emitInAppNotification(notification)
      
    } catch (error) {
      await this.updateNotificationStatus(notification.id!, 'failed', error.message)
      throw error
    }
  }

  private async shouldSendNotification(
    request: NotificationRequest,
    preferences: NotificationPreferences | null
  ): Promise<boolean> {
    if (!preferences) return true

    // Check if notification type is enabled
    switch (request.type) {
      case 'email':
        if (!preferences.email) return false
        break
      case 'sms':
        if (!preferences.sms) return false
        break
      case 'push':
        if (!preferences.push) return false
        break
      case 'in_app':
        if (!preferences.inApp) return false
        break
    }

    // Check category preferences
    const category = this.getNotificationCategory(request.template)
    switch (category) {
      case 'marketing':
        if (!preferences.marketing) return false
        break
      case 'security':
        if (!preferences.security) return false
        break
      case 'course_updates':
        if (!preferences.courseUpdates) return false
        break
      case 'assessments':
        if (!preferences.assessments) return false
        break
      case 'payments':
        if (!preferences.payments) return false
        break
    }

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      return request.priority === 'urgent'
    }

    return true
  }

  private getNotificationCategory(template: string): string {
    const categoryMap: Record<string, string> = {
      'welcome_email': 'system',
      'course_enrollment': 'course_updates',
      'lesson_completed': 'course_updates',
      'assessment_completed': 'assessments',
      'payment_receipt': 'payments',
      'payment_failed': 'payments',
      'security_alert': 'security',
      'marketing_campaign': 'marketing'
    }
    return categoryMap[template] || 'system'
  }

  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false
    }

    const now = new Date()
    const userTime = new Intl.DateTimeFormat('en', {
      timeZone: preferences.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now)

    const currentTime = userTime.replace(':', '')
    const startTime = preferences.quietHoursStart.replace(':', '')
    const endTime = preferences.quietHoursEnd.replace(':', '')

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime
    }
  }

  private async updateNotificationStatus(
    notificationId: string,
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked',
    error?: string
  ): Promise<void> {
    try {
      await this.repository.updateNotificationStatus(notificationId, status, error)
    } catch (error) {
      logger.error('Failed to update notification status', {
        notificationId,
        status,
        error: error.message
      })
    }
  }

  private async emitInAppNotification(notification: NotificationRequest): Promise<void> {
    // TODO: Integrate with WebSocket service for real-time notifications
    logger.info('In-app notification ready for real-time delivery', {
      notificationId: notification.id,
      recipientId: notification.recipientId
    })
  }

  async getNotificationHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationLog[]> {
    return this.repository.getNotificationHistory(userId, limit, offset)
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.repository.markInAppNotificationAsRead(notificationId, userId)
    await this.updateNotificationStatus(notificationId, 'opened')
  }

  async markAsClicked(notificationId: string, userId: string): Promise<void> {
    await this.updateNotificationStatus(notificationId, 'clicked')
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    await this.repository.updateUserPreferences(userId, preferences)
    logger.info('User notification preferences updated', { userId })
  }

  async subscribeToPush(
    userId: string,
    subscription: PushSubscription
  ): Promise<void> {
    await this.repository.savePushSubscription(userId, subscription)
    logger.info('Push subscription saved', { userId })
  }

  async unsubscribeFromPush(
    userId: string,
    endpoint: string
  ): Promise<void> {
    await this.repository.removePushSubscription(userId, endpoint)
    logger.info('Push subscription removed', { userId, endpoint })
  }

  async getNotificationStats(userId?: string): Promise<any> {
    return this.repository.getNotificationStats(userId)
  }
}
