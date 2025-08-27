import axios from 'axios'
import { logger } from '../utils/logger'
import { DomainEvent } from '../types/events'

export class AnalyticsService {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3006'
    this.apiKey = process.env.ANALYTICS_SERVICE_API_KEY || 'dev-key'
  }

  async trackEvent(event: DomainEvent): Promise<void> {
    try {
      const analyticsEvent = {
        eventId: event.id,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        userId: event.userId,
        timestamp: event.timestamp,
        properties: event.data,
        metadata: event.metadata
      }

      await axios.post(`${this.baseUrl}/api/v1/analytics/events`, analyticsEvent, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      })

      logger.debug('Analytics event tracked', {
        eventType: event.eventType,
        aggregateId: event.aggregateId
      })
    } catch (error) {
      logger.warn('Failed to track analytics event', {
        eventType: event.eventType,
        error: error.message
      })
    }
  }
}
