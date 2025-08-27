import { 
  AuditLog, 
  ComplianceData, 
  ComplianceReportType, 
  ComplianceFinding,
  AuditAction,
  DataClassification 
} from '../types/audit'
import { AuditRepository } from '../repositories/audit-repository'
import { logger } from '../utils/logger'

export class ComplianceEngine {
  private auditRepository: AuditRepository

  constructor(auditRepository: AuditRepository) {
    this.auditRepository = auditRepository
  }

  async analyzeEvent(auditLog: AuditLog): Promise<void> {
    try {
      const violations: ComplianceFinding[] = []

      // GDPR Compliance Checks
      if (auditLog.compliance.gdpr) {
        violations.push(...await this.checkGDPRCompliance(auditLog))
      }

      // SOX Compliance Checks
      if (auditLog.compliance.sox) {
        violations.push(...await this.checkSOXCompliance(auditLog))
      }

      // FERPA Compliance Checks
      if (auditLog.compliance.ferpa) {
        violations.push(...await this.checkFERPACompliance(auditLog))
      }

      // PCI Compliance Checks
      if (auditLog.compliance.pci) {
        violations.push(...await this.checkPCICompliance(auditLog))
      }

      // General Security Checks
      violations.push(...await this.checkSecurityCompliance(auditLog))

      // Store any violations found
      for (const violation of violations) {
        await this.auditRepository.createComplianceFinding(violation)
        
        if (violation.severity === 'critical' || violation.severity === 'high') {
          logger.warn('Compliance violation detected', {
            auditId: auditLog.id,
            finding: violation
          })
        }
      }

    } catch (error) {
      logger.error('Failed to analyze compliance for audit event', {
        auditId: auditLog.id,
        error: error.message
      })
    }
  }

  async generateReportData(
    reportType: ComplianceReportType,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceData> {
    try {
      const logs = await this.auditRepository.getAuditLogsByDateRange(startDate, endDate)
      const findings = await this.auditRepository.getComplianceFindings(startDate, endDate)

      const data: ComplianceData = {
        totalEvents: logs.length,
        eventsByType: this.aggregateEventsByType(logs),
        privacyEvents: this.countPrivacyEvents(logs),
        securityEvents: this.countSecurityEvents(logs),
        accessEvents: this.countAccessEvents(logs),
        dataExports: this.countDataExports(logs),
        deletionRequests: this.countDeletionRequests(logs),
        breachEvents: this.countBreachEvents(logs),
        findings,
        recommendations: await this.generateRecommendations(reportType, logs, findings)
      }

      return data

    } catch (error) {
      logger.error('Failed to generate compliance report data', {
        reportType,
        startDate,
        endDate,
        error: error.message
      })
      throw error
    }
  }

  private async checkGDPRCompliance(auditLog: AuditLog): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = []

    // Check for data processing without consent
    if (this.isDataProcessingAction(auditLog.action) && 
        auditLog.classification === DataClassification.PII) {
      
      const hasConsent = await this.checkUserConsent(auditLog.userId, auditLog.entityType)
      if (!hasConsent) {
        findings.push({
          id: `gdpr-consent-${Date.now()}`,
          severity: 'high',
          category: 'GDPR Consent',
          description: `Data processing action ${auditLog.action} performed without valid consent for user ${auditLog.userId}`,
          affectedRecords: 1,
          remediation: 'Obtain explicit consent before processing personal data',
          status: 'open',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        })
      }
    }

    // Check for excessive data retention
    const retentionDays = Math.floor((auditLog.retention.retainUntil.getTime() - auditLog.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    if (retentionDays > 2555) { // More than 7 years
      findings.push({
        id: `gdpr-retention-${Date.now()}`,
        severity: 'medium',
        category: 'GDPR Data Retention',
        description: `Data retention period exceeds recommended limits: ${retentionDays} days`,
        affectedRecords: 1,
        remediation: 'Review and adjust data retention policies to comply with GDPR principles',
        status: 'open'
      })
    }

    // Check for cross-border data transfers
    if (auditLog.metadata?.processingLocation && 
        !this.isEUCountry(auditLog.metadata.processingLocation)) {
      findings.push({
        id: `gdpr-transfer-${Date.now()}`,
        severity: 'high',
        category: 'GDPR Data Transfer',
        description: `Personal data transferred to non-EU country: ${auditLog.metadata.processingLocation}`,
        affectedRecords: 1,
        remediation: 'Ensure adequate safeguards for international data transfers',
        status: 'open'
      })
    }

    return findings
  }

  private async checkSOXCompliance(auditLog: AuditLog): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = []

    // Check for financial data modifications without approval
    if (auditLog.action === AuditAction.UPDATE && 
        auditLog.entityType.includes('payment')) {
      
      const hasApproval = auditLog.metadata?.approvedBy
      if (!hasApproval) {
        findings.push({
          id: `sox-approval-${Date.now()}`,
          severity: 'high',
          category: 'SOX Financial Controls',
          description: `Financial data modification without proper approval trail for ${auditLog.entityType}`,
          affectedRecords: 1,
          remediation: 'Implement approval workflow for financial data changes',
          status: 'open'
        })
      }
    }

    // Check for segregation of duties violations
    if (this.isFinancialTransaction(auditLog) && 
        await this.checkDutiesSegregation(auditLog.userId, auditLog.action)) {
      findings.push({
        id: `sox-segregation-${Date.now()}`,
        severity: 'critical',
        category: 'SOX Segregation of Duties',
        description: `Same user performing conflicting financial operations: ${auditLog.userId}`,
        affectedRecords: 1,
        remediation: 'Implement proper segregation of duties for financial processes',
        status: 'open'
      })
    }

    return findings
  }

  private async checkFERPACompliance(auditLog: AuditLog): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = []

    // Check for unauthorized access to educational records
    if (auditLog.action === AuditAction.READ && 
        this.isEducationalRecord(auditLog.entityType)) {
      
      const hasAuthorization = await this.checkEducationalRecordAccess(auditLog.userId, auditLog.entityId)
      if (!hasAuthorization) {
        findings.push({
          id: `ferpa-access-${Date.now()}`,
          severity: 'high',
          category: 'FERPA Unauthorized Access',
          description: `Unauthorized access to educational record by user ${auditLog.userId}`,
          affectedRecords: 1,
          remediation: 'Verify user authorization before granting access to educational records',
          status: 'open'
        })
      }
    }

    // Check for educational record sharing without consent
    if (auditLog.action === AuditAction.SHARE && 
        this.isEducationalRecord(auditLog.entityType)) {
      findings.push({
        id: `ferpa-sharing-${Date.now()}`,
        severity: 'medium',
        category: 'FERPA Record Sharing',
        description: `Educational record shared - verify consent and legitimate interest`,
        affectedRecords: 1,
        remediation: 'Ensure proper consent or legitimate educational interest for record sharing',
        status: 'open'
      })
    }

    return findings
  }

  private async checkPCICompliance(auditLog: AuditLog): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = []

    // Check for payment card data access
    if (auditLog.newValues?.cardNumber || auditLog.oldValues?.cardNumber) {
      findings.push({
        id: `pci-carddata-${Date.now()}`,
        severity: 'critical',
        category: 'PCI Data Security',
        description: 'Raw payment card data detected in audit log',
        affectedRecords: 1,
        remediation: 'Implement proper payment card data tokenization and masking',
        status: 'open'
      })
    }

    // Check for unencrypted payment data transmission
    if (auditLog.source !== AuditSource.SYSTEM && 
        this.containsPaymentData(auditLog)) {
      findings.push({
        id: `pci-transmission-${Date.now()}`,
        severity: 'high',
        category: 'PCI Data Transmission',
        description: 'Payment data transmission detected - verify encryption',
        affectedRecords: 1,
        remediation: 'Ensure all payment data transmissions are properly encrypted',
        status: 'open'
      })
    }

    return findings
  }

  private async checkSecurityCompliance(auditLog: AuditLog): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = []

    // Check for suspicious access patterns
    if (auditLog.action === AuditAction.ACCESS_DENIED) {
      const recentDenials = await this.auditRepository.getRecentAccessDenials(
        auditLog.userId, 
        auditLog.ipAddress, 
        new Date(Date.now() - 60 * 60 * 1000) // Last hour
      )

      if (recentDenials.length >= 5) {
        findings.push({
          id: `security-brute-force-${Date.now()}`,
          severity: 'high',
          category: 'Security Brute Force',
          description: `Multiple access denials detected for user ${auditLog.userId} from IP ${auditLog.ipAddress}`,
          affectedRecords: recentDenials.length,
          remediation: 'Implement account lockout and IP blocking mechanisms',
          status: 'open'
        })
      }
    }

    // Check for privilege escalation
    if (auditLog.action === AuditAction.UPDATE && 
        auditLog.entityType === 'user' && 
        auditLog.changes?.some(c => c.field === 'role')) {
      findings.push({
        id: `security-privilege-${Date.now()}`,
        severity: 'medium',
        category: 'Security Privilege Change',
        description: `User privilege modification detected for user ${auditLog.entityId}`,
        affectedRecords: 1,
        remediation: 'Review and approve all privilege changes through proper workflow',
        status: 'open'
      })
    }

    // Check for unusual IP addresses
    if (await this.isUnusualIPAddress(auditLog.userId, auditLog.ipAddress)) {
      findings.push({
        id: `security-unusual-ip-${Date.now()}`,
        severity: 'medium',
        category: 'Security Unusual Access',
        description: `Access from unusual IP address ${auditLog.ipAddress} for user ${auditLog.userId}`,
        affectedRecords: 1,
        remediation: 'Verify user identity and consider additional authentication',
        status: 'open'
      })
    }

    return findings
  }

  private aggregateEventsByType(logs: AuditLog[]): Record<string, number> {
    const aggregation: Record<string, number> = {}
    
    for (const log of logs) {
      const key = `${log.entityType}:${log.action}`
      aggregation[key] = (aggregation[key] || 0) + 1
    }

    return aggregation
  }

  private countPrivacyEvents(logs: AuditLog[]): number {
    return logs.filter(log => 
      log.classification === DataClassification.PII ||
      log.compliance.gdpr ||
      log.entityType.includes('consent')
    ).length
  }

  private countSecurityEvents(logs: AuditLog[]): number {
    return logs.filter(log => 
      log.action === AuditAction.LOGIN ||
      log.action === AuditAction.LOGOUT ||
      log.action === AuditAction.ACCESS_DENIED ||
      log.action === AuditAction.ACCESS_GRANTED
    ).length
  }

  private countAccessEvents(logs: AuditLog[]): number {
    return logs.filter(log => 
      log.action === AuditAction.READ ||
      log.action === AuditAction.ACCESS_GRANTED ||
      log.action === AuditAction.ACCESS_DENIED
    ).length
  }

  private countDataExports(logs: AuditLog[]): number {
    return logs.filter(log => log.action === AuditAction.EXPORT).length
  }

  private countDeletionRequests(logs: AuditLog[]): number {
    return logs.filter(log => 
      log.action === AuditAction.DELETE ||
      log.entityType === 'gdpr_request'
    ).length
  }

  private countBreachEvents(logs: AuditLog[]): number {
    return logs.filter(log => 
      log.entityType.includes('breach') ||
      log.metadata?.security_incident === true
    ).length
  }

  private async generateRecommendations(
    reportType: ComplianceReportType,
    logs: AuditLog[],
    findings: ComplianceFinding[]
  ): Promise<string[]> {
    const recommendations: string[] = []

    const criticalFindings = findings.filter(f => f.severity === 'critical')
    const highFindings = findings.filter(f => f.severity === 'high')

    if (criticalFindings.length > 0) {
      recommendations.push(`Address ${criticalFindings.length} critical compliance findings immediately`)
    }

    if (highFindings.length > 0) {
      recommendations.push(`Review and remediate ${highFindings.length} high-priority compliance issues`)
    }

    const accessDenials = logs.filter(log => log.action === AuditAction.ACCESS_DENIED)
    if (accessDenials.length > 100) {
      recommendations.push('High number of access denials detected - review authentication and authorization mechanisms')
    }

    const dataExports = logs.filter(log => log.action === AuditAction.EXPORT)
    if (dataExports.length > 50) {
      recommendations.push('Significant data export activity - ensure proper data loss prevention controls')
    }

    if (reportType === ComplianceReportType.GDPR_AUDIT) {
      recommendations.push('Conduct regular consent reviews and data retention policy assessments')
      recommendations.push('Implement automated data subject request processing')
    }

    return recommendations
  }

  // Helper methods
  private isDataProcessingAction(action: AuditAction): boolean {
    return [AuditAction.CREATE, AuditAction.UPDATE, AuditAction.READ].includes(action)
  }

  private async checkUserConsent(userId: string, entityType: string): Promise<boolean> {
    // Implementation would check consent records
    // For now, return true to avoid false positives
    return true
  }

  private isEUCountry(country: string): boolean {
    const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PL', 'PT', 'FI', 'SE', 'DK']
    return euCountries.includes(country.toUpperCase())
  }

  private isFinancialTransaction(auditLog: AuditLog): boolean {
    return auditLog.entityType.includes('payment') || 
           auditLog.entityType.includes('transaction') ||
           auditLog.entityType.includes('invoice')
  }

  private async checkDutiesSegregation(userId: string, action: AuditAction): Promise<boolean> {
    // Implementation would check if user has conflicting financial roles
    return false
  }

  private isEducationalRecord(entityType: string): boolean {
    return entityType.includes('grade') || 
           entityType.includes('transcript') ||
           entityType.includes('enrollment') ||
           entityType.includes('assessment')
  }

  private async checkEducationalRecordAccess(userId: string, entityId: string): Promise<boolean> {
    // Implementation would verify user authorization for educational records
    return true
  }

  private containsPaymentData(auditLog: AuditLog): boolean {
    const paymentFields = ['cardNumber', 'cvv', 'expiryDate', 'accountNumber']
    const data = { ...auditLog.newValues, ...auditLog.oldValues }
    
    return Object.keys(data || {}).some(key => 
      paymentFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
    )
  }

  private async isUnusualIPAddress(userId: string, ipAddress: string): Promise<boolean> {
    // Implementation would check historical IP patterns for user
    const recentIPs = await this.auditRepository.getUserRecentIPAddresses(userId, 30) // Last 30 days
    return !recentIPs.includes(ipAddress)
  }
}
