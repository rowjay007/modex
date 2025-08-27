import { 
  AuditLog, 
  DataRetentionRule, 
  RetentionPolicy,
  GDPRRequest,
  GDPRRequestType 
} from '../types/audit'
import { AuditRepository } from '../repositories/audit-repository'
import { logger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'

export class RetentionService {
  private auditRepository: AuditRepository

  constructor(auditRepository: AuditRepository) {
    this.auditRepository = auditRepository
  }

  async evaluateRecord(auditLog: AuditLog): Promise<void> {
    try {
      // Check if record is under legal hold
      if (auditLog.retention.legalHold) {
        logger.debug('Record under legal hold, skipping retention evaluation', {
          auditId: auditLog.id
        })
        return
      }

      // Check if retention period has expired
      const now = new Date()
      if (now > auditLog.retention.retainUntil) {
        await this.processExpiredRecord(auditLog)
      } else {
        // Schedule future evaluation
        await this.scheduleRetentionCheck(auditLog)
      }

    } catch (error) {
      logger.error('Failed to evaluate record retention', {
        auditId: auditLog.id,
        error: error.message
      })
    }
  }

  async processExpiredRecords(): Promise<void> {
    try {
      const expiredRecords = await this.auditRepository.getExpiredRecords()
      
      logger.info('Processing expired records', {
        count: expiredRecords.length
      })

      for (const record of expiredRecords) {
        await this.processExpiredRecord(record)
      }

    } catch (error) {
      logger.error('Failed to process expired records', {
        error: error.message
      })
    }
  }

  async createRetentionRule(rule: Omit<DataRetentionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const ruleId = uuidv4()
      
      const retentionRule: DataRetentionRule = {
        id: ruleId,
        ...rule,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await this.auditRepository.createRetentionRule(retentionRule)

      logger.info('Retention rule created', {
        ruleId,
        entityType: rule.entityType,
        retentionPeriod: rule.retentionPeriod
      })

      return ruleId

    } catch (error) {
      logger.error('Failed to create retention rule', {
        entityType: rule.entityType,
        error: error.message
      })
      throw error
    }
  }

  async updateRetentionRule(ruleId: string, updates: Partial<DataRetentionRule>): Promise<void> {
    try {
      const updatedRule = {
        ...updates,
        updatedAt: new Date()
      }

      await this.auditRepository.updateRetentionRule(ruleId, updatedRule)

      logger.info('Retention rule updated', {
        ruleId,
        updates: Object.keys(updates)
      })

    } catch (error) {
      logger.error('Failed to update retention rule', {
        ruleId,
        error: error.message
      })
      throw error
    }
  }

  async getRetentionRules(entityType?: string): Promise<DataRetentionRule[]> {
    try {
      return await this.auditRepository.getRetentionRules(entityType)
    } catch (error) {
      logger.error('Failed to get retention rules', {
        entityType,
        error: error.message
      })
      throw error
    }
  }

  async applyLegalHold(entityType: string, entityId: string, reason: string): Promise<void> {
    try {
      await this.auditRepository.applyLegalHold(entityType, entityId, reason)

      logger.info('Legal hold applied', {
        entityType,
        entityId,
        reason
      })

    } catch (error) {
      logger.error('Failed to apply legal hold', {
        entityType,
        entityId,
        error: error.message
      })
      throw error
    }
  }

  async removeLegalHold(entityType: string, entityId: string, reason: string): Promise<void> {
    try {
      await this.auditRepository.removeLegalHold(entityType, entityId, reason)

      // Re-evaluate retention for affected records
      const affectedRecords = await this.auditRepository.getRecordsByEntity(entityType, entityId)
      for (const record of affectedRecords) {
        await this.evaluateRecord(record)
      }

      logger.info('Legal hold removed', {
        entityType,
        entityId,
        reason,
        affectedRecords: affectedRecords.length
      })

    } catch (error) {
      logger.error('Failed to remove legal hold', {
        entityType,
        entityId,
        error: error.message
      })
      throw error
    }
  }

  async generateRetentionReport(startDate: Date, endDate: Date): Promise<{
    totalRecords: number
    expiredRecords: number
    deletedRecords: number
    archivedRecords: number
    legalHoldRecords: number
    retentionRules: DataRetentionRule[]
    recommendations: string[]
  }> {
    try {
      const [
        totalRecords,
        expiredRecords,
        deletedRecords,
        archivedRecords,
        legalHoldRecords,
        retentionRules
      ] = await Promise.all([
        this.auditRepository.getRecordCount(startDate, endDate),
        this.auditRepository.getExpiredRecordCount(startDate, endDate),
        this.auditRepository.getDeletedRecordCount(startDate, endDate),
        this.auditRepository.getArchivedRecordCount(startDate, endDate),
        this.auditRepository.getLegalHoldRecordCount(),
        this.auditRepository.getRetentionRules()
      ])

      const recommendations = this.generateRetentionRecommendations({
        totalRecords,
        expiredRecords,
        deletedRecords,
        archivedRecords,
        legalHoldRecords
      })

      return {
        totalRecords,
        expiredRecords,
        deletedRecords,
        archivedRecords,
        legalHoldRecords,
        retentionRules,
        recommendations
      }

    } catch (error) {
      logger.error('Failed to generate retention report', {
        startDate,
        endDate,
        error: error.message
      })
      throw error
    }
  }

  async enforceGDPRDeletion(userId: string): Promise<void> {
    try {
      // Get all audit records for the user
      const userRecords = await this.auditRepository.getUserAuditRecords(userId)
      
      // Check for legal holds
      const recordsUnderHold = userRecords.filter(record => record.retention.legalHold)
      if (recordsUnderHold.length > 0) {
        logger.warn('Cannot delete records under legal hold', {
          userId,
          recordsUnderHold: recordsUnderHold.length
        })
        return
      }

      // Archive critical audit records instead of deleting
      const criticalRecords = userRecords.filter(record => 
        record.compliance.sox || 
        record.compliance.ferpa ||
        record.entityType.includes('payment')
      )

      for (const record of criticalRecords) {
        await this.archiveRecord(record)
      }

      // Delete non-critical records
      const nonCriticalRecords = userRecords.filter(record => 
        !record.compliance.sox && 
        !record.compliance.ferpa &&
        !record.entityType.includes('payment')
      )

      for (const record of nonCriticalRecords) {
        await this.deleteRecord(record.id)
      }

      logger.info('GDPR deletion enforced', {
        userId,
        archivedRecords: criticalRecords.length,
        deletedRecords: nonCriticalRecords.length
      })

    } catch (error) {
      logger.error('Failed to enforce GDPR deletion', {
        userId,
        error: error.message
      })
      throw error
    }
  }

  private async processExpiredRecord(auditLog: AuditLog): Promise<void> {
    try {
      if (auditLog.retention.autoDelete) {
        // Check if record should be archived instead of deleted
        if (this.shouldArchiveRecord(auditLog)) {
          await this.archiveRecord(auditLog)
        } else {
          await this.deleteRecord(auditLog.id)
        }
      } else {
        // Mark for manual review
        await this.markForReview(auditLog.id, 'Retention period expired')
      }

      logger.debug('Expired record processed', {
        auditId: auditLog.id,
        action: auditLog.retention.autoDelete ? 'auto-processed' : 'marked-for-review'
      })

    } catch (error) {
      logger.error('Failed to process expired record', {
        auditId: auditLog.id,
        error: error.message
      })
    }
  }

  private async scheduleRetentionCheck(auditLog: AuditLog): Promise<void> {
    // In a production system, this would schedule a job for future execution
    // For now, we'll just log the scheduling
    logger.debug('Retention check scheduled', {
      auditId: auditLog.id,
      retainUntil: auditLog.retention.retainUntil
    })
  }

  private shouldArchiveRecord(auditLog: AuditLog): boolean {
    // Archive records that are required for compliance even after retention period
    return auditLog.compliance.sox || 
           auditLog.compliance.ferpa ||
           auditLog.entityType.includes('payment') ||
           auditLog.entityType.includes('transaction')
  }

  private async archiveRecord(auditLog: AuditLog): Promise<void> {
    try {
      await this.auditRepository.archiveRecord(auditLog.id)
      
      logger.info('Record archived', {
        auditId: auditLog.id,
        entityType: auditLog.entityType
      })

    } catch (error) {
      logger.error('Failed to archive record', {
        auditId: auditLog.id,
        error: error.message
      })
      throw error
    }
  }

  private async deleteRecord(auditId: string): Promise<void> {
    try {
      await this.auditRepository.deleteRecord(auditId)
      
      logger.info('Record deleted', {
        auditId
      })

    } catch (error) {
      logger.error('Failed to delete record', {
        auditId,
        error: error.message
      })
      throw error
    }
  }

  private async markForReview(auditId: string, reason: string): Promise<void> {
    try {
      await this.auditRepository.markForReview(auditId, reason)
      
      logger.info('Record marked for review', {
        auditId,
        reason
      })

    } catch (error) {
      logger.error('Failed to mark record for review', {
        auditId,
        error: error.message
      })
      throw error
    }
  }

  private generateRetentionRecommendations(metrics: {
    totalRecords: number
    expiredRecords: number
    deletedRecords: number
    archivedRecords: number
    legalHoldRecords: number
  }): string[] {
    const recommendations: string[] = []

    const { totalRecords, expiredRecords, deletedRecords, archivedRecords, legalHoldRecords } = metrics

    // Check retention efficiency
    const retentionRate = (totalRecords - deletedRecords) / totalRecords
    if (retentionRate > 0.95) {
      recommendations.push('High retention rate detected - review retention policies to ensure compliance and optimize storage')
    }

    // Check legal hold usage
    const legalHoldRate = legalHoldRecords / totalRecords
    if (legalHoldRate > 0.1) {
      recommendations.push('High percentage of records under legal hold - review and remove unnecessary holds')
    }

    // Check processing efficiency
    if (expiredRecords > totalRecords * 0.05) {
      recommendations.push('Large number of expired unprocessed records - increase retention processing frequency')
    }

    // Check archival patterns
    const archivalRate = archivedRecords / (deletedRecords + archivedRecords)
    if (archivalRate > 0.8) {
      recommendations.push('High archival rate - consider optimizing storage costs and access patterns')
    }

    if (recommendations.length === 0) {
      recommendations.push('Retention management appears to be operating within normal parameters')
    }

    return recommendations
  }
}
