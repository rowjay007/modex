import { 
  AuditLog, 
  AuditAction, 
  AuditSource, 
  GDPRRequest, 
  GDPRRequestType, 
  GDPRRequestStatus,
  ComplianceReport,
  ComplianceReportType,
  DataRetentionRule,
  ConsentRecord,
  ConsentType,
  ChangeRecord,
  ComplianceFlags,
  RetentionPolicy,
  DataClassification
} from '../types/audit'
import { AuditRepository } from '../repositories/audit-repository'
import { ComplianceEngine } from './compliance-engine'
import { RetentionService } from './retention-service'
import { logger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'
import { compare } from 'fast-json-patch'

export class AuditService {
  private auditRepository: AuditRepository
  private complianceEngine: ComplianceEngine
  private retentionService: RetentionService

  constructor(
    auditRepository: AuditRepository,
    complianceEngine: ComplianceEngine,
    retentionService: RetentionService
  ) {
    this.auditRepository = auditRepository
    this.complianceEngine = complianceEngine
    this.retentionService = retentionService
  }

  async logAuditEvent(event: Omit<AuditLog, 'id' | 'createdAt'>): Promise<string> {
    try {
      const auditId = uuidv4()
      
      // Calculate changes if old and new values provided
      let changes: ChangeRecord[] = []
      if (event.oldValues && event.newValues) {
        changes = this.calculateChanges(event.oldValues, event.newValues)
      }

      // Determine compliance flags based on entity type and data
      const compliance = this.determineComplianceFlags(event.entityType, event.newValues || event.oldValues)
      
      // Set retention policy based on compliance requirements
      const retention = this.determineRetentionPolicy(compliance, event.entityType)
      
      // Classify data sensitivity
      const classification = this.classifyData(event.entityType, event.newValues || event.oldValues)

      const auditLog: AuditLog = {
        id: auditId,
        ...event,
        changes,
        compliance,
        retention,
        classification,
        createdAt: new Date()
      }

      await this.auditRepository.createAuditLog(auditLog)

      // Check for compliance violations
      await this.complianceEngine.analyzeEvent(auditLog)

      // Trigger retention policy evaluation
      await this.retentionService.evaluateRecord(auditLog)

      logger.info('Audit event logged', {
        auditId,
        action: event.action,
        entityType: event.entityType,
        userId: event.userId
      })

      return auditId

    } catch (error) {
      logger.error('Failed to log audit event', {
        action: event.action,
        entityType: event.entityType,
        error: error.message
      })
      throw error
    }
  }

  async getAuditTrail(
    entityType?: string,
    entityId?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const filters = {
        entityType,
        entityId,
        userId,
        startDate,
        endDate
      }

      const result = await this.auditRepository.getAuditLogs(filters, limit, offset)
      
      logger.info('Audit trail retrieved', {
        filters,
        count: result.logs.length,
        total: result.total
      })

      return result

    } catch (error) {
      logger.error('Failed to retrieve audit trail', {
        entityType,
        entityId,
        userId,
        error: error.message
      })
      throw error
    }
  }

  async createGDPRRequest(
    userId: string,
    requestType: GDPRRequestType,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      const requestId = uuidv4()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 days to fulfill

      const gdprRequest: GDPRRequest = {
        id: requestId,
        userId,
        requestType,
        status: GDPRRequestStatus.PENDING,
        requestedAt: new Date(),
        expiresAt,
        metadata
      }

      await this.auditRepository.createGDPRRequest(gdprRequest)

      // Log the GDPR request as an audit event
      await this.logAuditEvent({
        userId,
        entityType: 'gdpr_request',
        entityId: requestId,
        action: AuditAction.CREATE,
        newValues: { requestType, status: 'pending' },
        source: AuditSource.SYSTEM,
        ipAddress: metadata?.ipAddress || 'system',
        userAgent: metadata?.userAgent || 'system',
        compliance: { gdpr: true, sox: false, hipaa: false, pci: false, ferpa: false, coppa: false },
        retention: this.getGDPRRetentionPolicy(),
        classification: DataClassification.PII
      })

      // Start processing the request
      await this.processGDPRRequest(requestId)

      logger.info('GDPR request created', {
        requestId,
        userId,
        requestType
      })

      return requestId

    } catch (error) {
      logger.error('Failed to create GDPR request', {
        userId,
        requestType,
        error: error.message
      })
      throw error
    }
  }

  async processGDPRRequest(requestId: string): Promise<void> {
    try {
      const request = await this.auditRepository.getGDPRRequest(requestId)
      if (!request) {
        throw new Error('GDPR request not found')
      }

      // Update status to in progress
      await this.auditRepository.updateGDPRRequestStatus(requestId, GDPRRequestStatus.IN_PROGRESS)

      switch (request.requestType) {
        case GDPRRequestType.ACCESS:
          await this.handleDataAccessRequest(request)
          break
        case GDPRRequestType.ERASURE:
          await this.handleDataErasureRequest(request)
          break
        case GDPRRequestType.PORTABILITY:
          await this.handleDataPortabilityRequest(request)
          break
        case GDPRRequestType.RECTIFICATION:
          await this.handleDataRectificationRequest(request)
          break
        default:
          throw new Error(`Unsupported GDPR request type: ${request.requestType}`)
      }

      // Mark as fulfilled
      await this.auditRepository.updateGDPRRequestStatus(requestId, GDPRRequestStatus.FULFILLED)

      logger.info('GDPR request processed', {
        requestId,
        requestType: request.requestType
      })

    } catch (error) {
      logger.error('Failed to process GDPR request', {
        requestId,
        error: error.message
      })
      
      // Mark as rejected
      await this.auditRepository.updateGDPRRequestStatus(requestId, GDPRRequestStatus.REJECTED)
      throw error
    }
  }

  async generateComplianceReport(
    reportType: ComplianceReportType,
    startDate: Date,
    endDate: Date,
    generatedBy: string
  ): Promise<string> {
    try {
      const reportId = uuidv4()
      
      const data = await this.complianceEngine.generateReportData(reportType, startDate, endDate)
      
      const report: ComplianceReport = {
        id: reportId,
        reportType,
        period: {
          startDate,
          endDate,
          description: `${reportType} report for ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
        },
        generatedBy,
        generatedAt: new Date(),
        data
      }

      await this.auditRepository.createComplianceReport(report)

      logger.info('Compliance report generated', {
        reportId,
        reportType,
        period: report.period
      })

      return reportId

    } catch (error) {
      logger.error('Failed to generate compliance report', {
        reportType,
        startDate,
        endDate,
        error: error.message
      })
      throw error
    }
  }

  async recordConsent(consent: Omit<ConsentRecord, 'id' | 'isActive'>): Promise<string> {
    try {
      const consentId = uuidv4()
      
      const consentRecord: ConsentRecord = {
        id: consentId,
        ...consent,
        isActive: true
      }

      await this.auditRepository.createConsentRecord(consentRecord)

      // Log consent as audit event
      await this.logAuditEvent({
        userId: consent.userId,
        entityType: 'consent',
        entityId: consentId,
        action: AuditAction.CREATE,
        newValues: {
          consentType: consent.consentType,
          consentGiven: consent.consentGiven,
          purpose: consent.purpose
        },
        source: AuditSource.WEB_APP,
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent,
        compliance: { gdpr: true, sox: false, hipaa: false, pci: false, ferpa: false, coppa: false },
        retention: this.getConsentRetentionPolicy(),
        classification: DataClassification.PII
      })

      logger.info('Consent recorded', {
        consentId,
        userId: consent.userId,
        consentType: consent.consentType,
        consentGiven: consent.consentGiven
      })

      return consentId

    } catch (error) {
      logger.error('Failed to record consent', {
        userId: consent.userId,
        consentType: consent.consentType,
        error: error.message
      })
      throw error
    }
  }

  async withdrawConsent(consentId: string, userId: string, ipAddress: string, userAgent: string): Promise<void> {
    try {
      const consent = await this.auditRepository.getConsentRecord(consentId)
      if (!consent || consent.userId !== userId) {
        throw new Error('Consent record not found or access denied')
      }

      await this.auditRepository.withdrawConsent(consentId)

      // Log consent withdrawal
      await this.logAuditEvent({
        userId,
        entityType: 'consent',
        entityId: consentId,
        action: AuditAction.UPDATE,
        oldValues: { withdrawnDate: null, isActive: true },
        newValues: { withdrawnDate: new Date(), isActive: false },
        source: AuditSource.WEB_APP,
        ipAddress,
        userAgent,
        compliance: { gdpr: true, sox: false, hipaa: false, pci: false, ferpa: false, coppa: false },
        retention: this.getConsentRetentionPolicy(),
        classification: DataClassification.PII
      })

      logger.info('Consent withdrawn', {
        consentId,
        userId
      })

    } catch (error) {
      logger.error('Failed to withdraw consent', {
        consentId,
        userId,
        error: error.message
      })
      throw error
    }
  }

  private calculateChanges(oldValues: Record<string, any>, newValues: Record<string, any>): ChangeRecord[] {
    const changes: ChangeRecord[] = []
    const patches = compare(oldValues, newValues)

    for (const patch of patches) {
      const field = patch.path.replace('/', '')
      
      if (patch.op === 'add') {
        changes.push({
          field,
          oldValue: null,
          newValue: patch.value,
          type: 'added'
        })
      } else if (patch.op === 'remove') {
        changes.push({
          field,
          oldValue: oldValues[field],
          newValue: null,
          type: 'removed'
        })
      } else if (patch.op === 'replace') {
        changes.push({
          field,
          oldValue: oldValues[field],
          newValue: patch.value,
          type: 'modified'
        })
      }
    }

    return changes
  }

  private determineComplianceFlags(entityType: string, data?: Record<string, any>): ComplianceFlags {
    const flags: ComplianceFlags = {
      gdpr: false,
      sox: false,
      hipaa: false,
      pci: false,
      ferpa: false,
      coppa: false
    }

    // GDPR applies to personal data
    if (this.containsPersonalData(entityType, data)) {
      flags.gdpr = true
    }

    // SOX applies to financial data
    if (entityType.includes('payment') || entityType.includes('financial')) {
      flags.sox = true
    }

    // FERPA applies to educational records
    if (entityType.includes('course') || entityType.includes('enrollment') || entityType.includes('assessment')) {
      flags.ferpa = true
    }

    // PCI applies to payment card data
    if (data && (data.cardNumber || data.cvv || data.paymentMethod === 'card')) {
      flags.pci = true
    }

    return flags
  }

  private containsPersonalData(entityType: string, data?: Record<string, any>): boolean {
    const personalDataEntities = ['user', 'student', 'instructor', 'profile', 'contact']
    const personalDataFields = ['email', 'name', 'phone', 'address', 'ssn', 'birthday']

    if (personalDataEntities.some(entity => entityType.includes(entity))) {
      return true
    }

    if (data) {
      return Object.keys(data).some(key => 
        personalDataFields.some(field => key.toLowerCase().includes(field))
      )
    }

    return false
  }

  private determineRetentionPolicy(compliance: ComplianceFlags, entityType: string): RetentionPolicy {
    let retentionDays = 2555 // 7 years default

    // GDPR: varies by purpose, default 6 years
    if (compliance.gdpr) {
      retentionDays = 2190 // 6 years
    }

    // SOX: 7 years for financial records
    if (compliance.sox) {
      retentionDays = 2555 // 7 years
    }

    // FERPA: varies, but generally 5 years after graduation
    if (compliance.ferpa) {
      retentionDays = 1825 // 5 years
    }

    const retainUntil = new Date()
    retainUntil.setDate(retainUntil.getDate() + retentionDays)

    return {
      retainUntil,
      autoDelete: true,
      legalHold: false
    }
  }

  private classifyData(entityType: string, data?: Record<string, any>): DataClassification {
    if (this.containsPersonalData(entityType, data)) {
      return DataClassification.PII
    }

    if (entityType.includes('payment') || entityType.includes('financial')) {
      return DataClassification.CONFIDENTIAL
    }

    if (entityType.includes('assessment') || entityType.includes('grade')) {
      return DataClassification.CONFIDENTIAL
    }

    return DataClassification.INTERNAL
  }

  private getGDPRRetentionPolicy(): RetentionPolicy {
    const retainUntil = new Date()
    retainUntil.setFullYear(retainUntil.getFullYear() + 6) // 6 years

    return {
      retainUntil,
      autoDelete: false, // Manual review for GDPR requests
      legalHold: true
    }
  }

  private getConsentRetentionPolicy(): RetentionPolicy {
    const retainUntil = new Date()
    retainUntil.setFullYear(retainUntil.getFullYear() + 7) // 7 years for proof of consent

    return {
      retainUntil,
      autoDelete: false,
      legalHold: true
    }
  }

  private async handleDataAccessRequest(request: GDPRRequest): Promise<void> {
    // Implementation would gather all user data across services
    logger.info('Processing data access request', { requestId: request.id })
    // TODO: Integrate with other services to collect user data
  }

  private async handleDataErasureRequest(request: GDPRRequest): Promise<void> {
    // Implementation would delete user data across services
    logger.info('Processing data erasure request', { requestId: request.id })
    // TODO: Integrate with other services to delete user data
  }

  private async handleDataPortabilityRequest(request: GDPRRequest): Promise<void> {
    // Implementation would export user data in portable format
    logger.info('Processing data portability request', { requestId: request.id })
    // TODO: Create exportable data package
  }

  private async handleDataRectificationRequest(request: GDPRRequest): Promise<void> {
    // Implementation would update incorrect user data
    logger.info('Processing data rectification request', { requestId: request.id })
    // TODO: Update user data across services
  }
}
