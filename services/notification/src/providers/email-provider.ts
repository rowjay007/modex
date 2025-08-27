import nodemailer from 'nodemailer'
import { Transporter } from 'nodemailer'
import { EmailConfig, NotificationRequest } from '../types/notification'
import { logger } from '../utils/logger'
import path from 'path'
import fs from 'fs/promises'

// Simple template function type
type HandlebarsTemplateDelegate = (context: any) => string

// Simple template compiler
const compileTemplate = (source: string): HandlebarsTemplateDelegate => {
  return (context: any) => {
    let result = source
    Object.keys(context).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      result = result.replace(regex, context[key] || '')
    })
    return result
  }
}

export class EmailProvider {
  private transporter: Transporter
  private config: EmailConfig
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map()

  constructor(config: EmailConfig) {
    this.config = config
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 10
    })

    this.loadTemplates()
  }

  async sendEmail(notification: NotificationRequest): Promise<void> {
    try {
      const template = this.templates.get(notification.template)
      if (!template) {
        throw new Error(`Email template '${notification.template}' not found`)
      }

      const htmlContent = template({
        ...notification.metadata,
        content: notification.content,
        recipientId: notification.recipientId
      })

      const mailOptions = {
        from: this.config.from,
        to: notification.metadata?.email || notification.recipientId,
        subject: notification.subject || 'Notification from Modex',
        html: htmlContent,
        text: notification.content,
        headers: {
          'X-Notification-ID': notification.id || '',
          'X-Priority': this.getPriorityHeader(notification.priority)
        }
      }

      const info: any = await this.transporter.sendMail(mailOptions)
      
      logger.info('Email sent successfully', {
        notificationId: notification.id,
        recipient: notification.recipientId,
        messageId: info.messageId,
        template: notification.template
      })

    } catch (error) {
      logger.error('Failed to send email', {
        notificationId: notification.id,
        recipient: notification.recipientId,
        error: error.message
      })
      throw error
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templatesDir = path.join(__dirname, '../templates/email')
      const templateFiles = await fs.readdir(templatesDir)
      
      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = path.basename(file, '.hbs')
          const templateContent = await fs.readFile(
            path.join(templatesDir, file), 
            'utf-8'
          )
          const template = compileTemplate(templateContent)
          this.templates.set(templateName, template)
        }
      }

      // Simple template system loaded

      logger.info('Email templates loaded', { 
        count: this.templates.size,
        templates: Array.from(this.templates.keys())
      })
    } catch (error) {
      logger.error('Failed to load email templates', error)
    }
  }

  private getPriorityHeader(priority: string): string {
    const priorityMap = {
      'urgent': '1 (Highest)',
      'high': '2 (High)',
      'medium': '3 (Normal)',
      'low': '4 (Low)'
    }
    return priorityMap[priority] || '3 (Normal)'
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      logger.info('Email connection verified')
      return true
    } catch (error) {
      logger.error('Email connection failed', error)
      return false
    }
  }

  async close(): Promise<void> {
    this.transporter.close()
  }
}
