import axios from 'axios'
import { logger } from '../utils/logger'
import { DomainEvent } from '../types/events'

export class AuditService {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.AUDIT_SERVICE_URL || 'http://audit-service:3008'
    this.apiKey = process.env.AUDIT_SERVICE_API_KEY || 'dev-key'
  }

  async logEvent(event: DomainEvent): Promise<void> {
    try {
      const auditLog = {
        eventId: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        userId: event.userId,
        timestamp: event.timestamp,
        eventData: event.data,
        metadata: event.metadata,
        ipAddress: event.metadata?.ipAddress,
        userAgent: event.metadata?.userAgent,
        sessionId: event.metadata?.sessionId
      }

      await axios.post(`${this.baseUrl}/api/v1/audit/events`, auditLog, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })

      logger.debug('Audit log created', {
        eventType: event.eventType,
        aggregateId: event.aggregateId
      })
    } catch (error) {
      logger.error('Failed to create audit log', {
        eventType: event.eventType,
        error: error.message
      })
    }
  }
}
