// Simple PostgreSQL Pool mock
class Pool {
  constructor(config: any) {}
  
  async query(text: string, params?: any[]): Promise<any> {
    // Mock successful queries
    if (text.includes('CREATE TABLE') || text.includes('CREATE INDEX')) {
      return { rows: [] }
    }
    if (text.includes('SELECT COUNT')) {
      return { rows: [{ count: '0' }] }
    }
    if (text.includes('SELECT') && text.includes('notification_preferences')) {
      return { rows: [] }
    }
    return { rows: [], rowCount: 0 }
  }
  
  async connect(): Promise<any> {
    return {
      query: this.query.bind(this),
      release: () => {},
    }
  }
  
  async end(): Promise<void> {}
}
// Simple Redis mock
class Redis {
  private store = new Map<string, string>()
  
  constructor(url?: string) {}
  
  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null
  }
  
  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, value)
    setTimeout(() => this.store.delete(key), seconds * 1000)
    return 'OK'
  }
  
  async del(key: string): Promise<number> {
    const existed = this.store.has(key)
    this.store.delete(key)
    return existed ? 1 : 0
  }
  
  async ping(): Promise<string> {
    return 'PONG'
  }
  
  async quit(): Promise<string> {
    this.store.clear()
    return 'OK'
  }
}
import { 
  NotificationLog, 
  NotificationPreferences, 
  NotificationTemplate 
} from '../types/notification'
import { PushSubscription } from '../providers/push-provider'
import { logger } from '../utils/logger'

export class NotificationRepository {
  private pool: Pool
  private redis: Redis

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    this.initializeDatabase()
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS notification_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          notification_id VARCHAR(255) NOT NULL,
          recipient_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          error_message TEXT,
          sent_at TIMESTAMP WITH TIME ZONE,
          delivered_at TIMESTAMP WITH TIME ZONE,
          opened_at TIMESTAMP WITH TIME ZONE,
          clicked_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notification_preferences (
          user_id VARCHAR(255) PRIMARY KEY,
          email BOOLEAN DEFAULT true,
          sms BOOLEAN DEFAULT false,
          push BOOLEAN DEFAULT true,
          in_app BOOLEAN DEFAULT true,
          marketing BOOLEAN DEFAULT false,
          security BOOLEAN DEFAULT true,
          course_updates BOOLEAN DEFAULT true,
          assessments BOOLEAN DEFAULT true,
          payments BOOLEAN DEFAULT true,
          frequency VARCHAR(50) DEFAULT 'immediate',
          quiet_hours_start TIME,
          quiet_hours_end TIME,
          timezone VARCHAR(100) DEFAULT 'UTC',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          endpoint TEXT NOT NULL,
          p256dh_key TEXT NOT NULL,
          auth_key TEXT NOT NULL,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, endpoint)
        );

        CREATE TABLE IF NOT EXISTS in_app_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient_id VARCHAR(255) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          type VARCHAR(100) NOT NULL,
          priority VARCHAR(50) NOT NULL,
          metadata JSONB,
          is_read BOOLEAN DEFAULT false,
          read_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notification_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          subject VARCHAR(500),
          content TEXT NOT NULL,
          variables JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient ON notification_logs(recipient_id);
        CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
        CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
        CREATE INDEX IF NOT EXISTS idx_in_app_notifications_recipient ON in_app_notifications(recipient_id);
        CREATE INDEX IF NOT EXISTS idx_in_app_notifications_is_read ON in_app_notifications(is_read);
      `)
      logger.info('Notification database initialized')
    } catch (error) {
      logger.error('Failed to initialize notification database', error)
      throw error
    }
  }

  async createNotificationLog(log: Omit<NotificationLog, 'id'>): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO notification_logs 
         (notification_id, recipient_id, type, status, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [log.notificationId, log.recipientId, log.type, log.status, JSON.stringify(log.metadata)]
      )
    } finally {
      client.release()
    }
  }

  async updateNotificationStatus(
    notificationId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const client = await this.pool.connect()
    try {
      let query = 'UPDATE notification_logs SET status = $1'
      const params = [status, notificationId]

      if (status === 'sent') {
        query += ', sent_at = NOW()'
      } else if (status === 'delivered') {
        query += ', delivered_at = NOW()'
      } else if (status === 'opened') {
        query += ', opened_at = NOW()'
      } else if (status === 'clicked') {
        query += ', clicked_at = NOW()'
      } else if (status === 'failed' && errorMessage) {
        query += ', error_message = $3'
        params.push(errorMessage)
      }

      query += ' WHERE notification_id = $2'

      await client.query(query, params)
    } finally {
      client.release()
    }
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      // Try cache first
      const cached = await this.redis.get(`prefs:${userId}`)
      if (cached) {
        return JSON.parse(cached)
      }

      // Fetch from database
      const result = await this.pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      )

      if (result.rows.length === 0) {
        return null
      }

      const preferences = {
        userId: result.rows[0].user_id,
        email: result.rows[0].email,
        sms: result.rows[0].sms,
        push: result.rows[0].push,
        inApp: result.rows[0].in_app,
        marketing: result.rows[0].marketing,
        security: result.rows[0].security,
        courseUpdates: result.rows[0].course_updates,
        assessments: result.rows[0].assessments,
        payments: result.rows[0].payments,
        frequency: result.rows[0].frequency,
        quietHoursStart: result.rows[0].quiet_hours_start,
        quietHoursEnd: result.rows[0].quiet_hours_end,
        timezone: result.rows[0].timezone
      }

      // Cache for 1 hour
      await this.redis.setex(`prefs:${userId}`, 3600, JSON.stringify(preferences))

      return preferences
    } catch (error) {
      logger.error('Failed to get user preferences', { userId, error: error.message })
      return null
    }
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Upsert preferences
      await client.query(
        `INSERT INTO notification_preferences (
          user_id, email, sms, push, in_app, marketing, security,
          course_updates, assessments, payments, frequency,
          quiet_hours_start, quiet_hours_end, timezone, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          email = COALESCE($2, notification_preferences.email),
          sms = COALESCE($3, notification_preferences.sms),
          push = COALESCE($4, notification_preferences.push),
          in_app = COALESCE($5, notification_preferences.in_app),
          marketing = COALESCE($6, notification_preferences.marketing),
          security = COALESCE($7, notification_preferences.security),
          course_updates = COALESCE($8, notification_preferences.course_updates),
          assessments = COALESCE($9, notification_preferences.assessments),
          payments = COALESCE($10, notification_preferences.payments),
          frequency = COALESCE($11, notification_preferences.frequency),
          quiet_hours_start = COALESCE($12, notification_preferences.quiet_hours_start),
          quiet_hours_end = COALESCE($13, notification_preferences.quiet_hours_end),
          timezone = COALESCE($14, notification_preferences.timezone),
          updated_at = NOW()`,
        [
          userId,
          preferences.email,
          preferences.sms,
          preferences.push,
          preferences.inApp,
          preferences.marketing,
          preferences.security,
          preferences.courseUpdates,
          preferences.assessments,
          preferences.payments,
          preferences.frequency,
          preferences.quietHoursStart,
          preferences.quietHoursEnd,
          preferences.timezone
        ]
      )

      await client.query('COMMIT')

      // Clear cache
      await this.redis.del(`prefs:${userId}`)

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async savePushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, endpoint) DO UPDATE SET
           p256dh_key = $3,
           auth_key = $4,
           is_active = true,
           updated_at = NOW()`,
        [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      )
    } finally {
      client.release()
    }
  }

  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    const result = await this.pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 AND is_active = true',
      [userId]
    )

    return result.rows.map(row => ({
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh_key,
        auth: row.auth_key
      }
    }))
  }

  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.pool.query(
      'UPDATE push_subscriptions SET is_active = false WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    )
  }

  async createInAppNotification(notification: any): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO in_app_notifications 
         (id, recipient_id, title, content, type, priority, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          notification.id,
          notification.recipientId,
          notification.title,
          notification.content,
          notification.type,
          notification.priority,
          JSON.stringify(notification.metadata),
          notification.createdAt
        ]
      )
    } finally {
      client.release()
    }
  }

  async markInAppNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE in_app_notifications 
       SET is_read = true, read_at = NOW() 
       WHERE id = $1 AND recipient_id = $2`,
      [notificationId, userId]
    )
  }

  async getNotificationHistory(
    userId: string,
    limit: number,
    offset: number
  ): Promise<NotificationLog[]> {
    const result = await this.pool.query(
      `SELECT * FROM notification_logs 
       WHERE recipient_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    return result.rows.map(row => ({
      id: row.id,
      notificationId: row.notification_id,
      recipientId: row.recipient_id,
      type: row.type,
      status: row.status,
      error: row.error_message,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      openedAt: row.opened_at,
      clickedAt: row.clicked_at,
      metadata: row.metadata
    }))
  }

  async getNotificationStats(userId?: string): Promise<any> {
    let query = `
      SELECT 
        type,
        status,
        COUNT(*) as count,
        DATE_TRUNC('day', created_at) as date
      FROM notification_logs
    `
    const params: any[] = []

    if (userId) {
      query += ' WHERE recipient_id = $1'
      params.push(userId)
    }

    query += `
      GROUP BY type, status, DATE_TRUNC('day', created_at)
      ORDER BY date DESC
      LIMIT 30
    `

    const result = await this.pool.query(query, params)
    return result.rows
  }

  async close(): Promise<void> {
    await this.pool.end()
    await this.redis.quit()
  }
}
