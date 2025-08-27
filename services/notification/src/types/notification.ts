export interface NotificationRequest {
  id?: string
  recipientId: string
  type: 'email' | 'sms' | 'push' | 'in_app'
  template: string
  subject?: string
  content: string
  metadata?: Record<string, any>
  priority: 'low' | 'medium' | 'high' | 'urgent'
  scheduledAt?: Date
  expiresAt?: Date
}

export interface NotificationTemplate {
  id: string
  name: string
  type: 'email' | 'sms' | 'push' | 'in_app'
  subject?: string
  content: string
  variables: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface NotificationLog {
  id: string
  notificationId: string
  recipientId: string
  type: 'email' | 'sms' | 'push' | 'in_app'
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked'
  error?: string
  sentAt?: Date
  deliveredAt?: Date
  openedAt?: Date
  clickedAt?: Date
  metadata?: Record<string, any>
}

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: string
}

export interface SMSConfig {
  accountSid: string
  authToken: string
  fromNumber: string
}

export interface PushConfig {
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
}

export interface NotificationPreferences {
  userId: string
  email: boolean
  sms: boolean
  push: boolean
  inApp: boolean
  marketing: boolean
  security: boolean
  courseUpdates: boolean
  assessments: boolean
  payments: boolean
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
  quietHoursStart?: string
  quietHoursEnd?: string
  timezone: string
}
