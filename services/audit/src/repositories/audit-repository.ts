import { Pool } from 'pg'
import Redis from 'ioredis'
import { 
  AuditLog, 
  GDPRRequest, 
  GDPRRequestStatus,
  ComplianceReport,
  ComplianceFinding,
  DataRetentionRule,
  ConsentRecord
} from '../types/audit'
import { logger } from '../utils/logger'

export class AuditRepository {
  private db: Pool
  private redis: Redis

  constructor(db: Pool, redis: Redis) {
    this.db = db
    this.redis = redis
  }

  async initializeSchema(): Promise<void> {
    try {
      await this.db.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Audit logs table
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          event_id UUID,
          user_id VARCHAR(255) NOT NULL,
          user_email VARCHAR(255),
          entity_type VARCHAR(100) NOT NULL,
          entity_id VARCHAR(255) NOT NULL,
          action VARCHAR(50) NOT NULL,
          old_values JSONB,
          new_values JSONB,
          changes JSONB,
          source VARCHAR(50) NOT NULL,
          ip_address INET NOT NULL,
          user_agent TEXT,
          session_id VARCHAR(255),
          request_id VARCHAR(255),
          compliance JSONB NOT NULL DEFAULT '{}',
          retention JSONB NOT NULL DEFAULT '{}',
          classification VARCHAR(50) NOT NULL,
          metadata JSONB DEFAULT '{}',
          is_archived BOOLEAN DEFAULT FALSE,
          legal_hold BOOLEAN DEFAULT FALSE,
          review_required BOOLEAN DEFAULT FALSE,
          review_reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- GDPR requests table
        CREATE TABLE IF NOT EXISTS gdpr_requests (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id VARCHAR(255) NOT NULL,
          request_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          fulfilled_at TIMESTAMP WITH TIME ZONE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- GDPR documents table
        CREATE TABLE IF NOT EXISTS gdpr_documents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          request_id UUID NOT NULL REFERENCES gdpr_requests(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_type VARCHAR(50) NOT NULL,
          file_size BIGINT NOT NULL,
          download_url TEXT NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Compliance reports table
        CREATE TABLE IF NOT EXISTS compliance_reports (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          report_type VARCHAR(50) NOT NULL,
          period_start TIMESTAMP WITH TIME ZONE NOT NULL,
          period_end TIMESTAMP WITH TIME ZONE NOT NULL,
          period_description TEXT,
          generated_by VARCHAR(255) NOT NULL,
          generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          data JSONB NOT NULL DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Compliance findings table
        CREATE TABLE IF NOT EXISTS compliance_findings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          audit_log_id UUID REFERENCES audit_logs(id) ON DELETE SET NULL,
          severity VARCHAR(20) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          affected_records INTEGER DEFAULT 1,
          remediation TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'open',
          due_date TIMESTAMP WITH TIME ZONE,
          resolved_at TIMESTAMP WITH TIME ZONE,
          resolved_by VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Data retention rules table
        CREATE TABLE IF NOT EXISTS data_retention_rules (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          entity_type VARCHAR(100) NOT NULL,
          retention_period_days INTEGER NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          legal_basis TEXT NOT NULL,
          auto_delete BOOLEAN DEFAULT TRUE,
          archive_before_delete BOOLEAN DEFAULT FALSE,
          exceptions TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Consent records table
        CREATE TABLE IF NOT EXISTS consent_records (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id VARCHAR(255) NOT NULL,
          consent_type VARCHAR(50) NOT NULL,
          consent_given BOOLEAN NOT NULL,
          consent_date TIMESTAMP WITH TIME ZONE NOT NULL,
          withdrawn_date TIMESTAMP WITH TIME ZONE,
          legal_basis VARCHAR(255) NOT NULL,
          purpose TEXT NOT NULL,
          data_types TEXT[] NOT NULL,
          processing_location VARCHAR(100),
          third_parties TEXT[],
          retention_period_days INTEGER,
          version VARCHAR(20) NOT NULL,
          ip_address INET NOT NULL,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_classification ON audit_logs(classification);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance ON audit_logs USING GIN(compliance);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_retention ON audit_logs((retention->>'retainUntil'));
        CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_archived ON audit_logs(is_archived);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_legal_hold ON audit_logs(legal_hold);

        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user_id ON gdpr_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);
        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON gdpr_requests(request_type);
        CREATE INDEX IF NOT EXISTS idx_gdpr_requests_expires_at ON gdpr_requests(expires_at);

        CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity);
        CREATE INDEX IF NOT EXISTS idx_compliance_findings_status ON compliance_findings(status);
        CREATE INDEX IF NOT EXISTS idx_compliance_findings_category ON compliance_findings(category);

        CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id);
        CREATE INDEX IF NOT EXISTS idx_consent_records_type ON consent_records(consent_type);
        CREATE INDEX IF NOT EXISTS idx_consent_records_active ON consent_records(is_active);
      `)

      logger.info('Audit database schema initialized')

    } catch (error) {
      logger.error('Failed to initialize audit schema', { error: error.message })
      throw error
    }
  }

  async createAuditLog(auditLog: AuditLog): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_logs (
          id, event_id, user_id, user_email, entity_type, entity_id, action,
          old_values, new_values, changes, source, ip_address, user_agent,
          session_id, request_id, compliance, retention, classification, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `

      await this.db.query(query, [
        auditLog.id,
        auditLog.eventId,
        auditLog.userId,
        auditLog.userEmail,
        auditLog.entityType,
        auditLog.entityId,
        auditLog.action,
        JSON.stringify(auditLog.oldValues),
        JSON.stringify(auditLog.newValues),
        JSON.stringify(auditLog.changes),
        auditLog.source,
        auditLog.ipAddress,
        auditLog.userAgent,
        auditLog.sessionId,
        auditLog.requestId,
        JSON.stringify(auditLog.compliance),
        JSON.stringify(auditLog.retention),
        auditLog.classification,
        JSON.stringify(auditLog.metadata)
      ])

      // Cache recent audit logs for quick access
      await this.cacheAuditLog(auditLog)

    } catch (error) {
      logger.error('Failed to create audit log', { 
        auditId: auditLog.id,
        error: error.message 
      })
      throw error
    }
  }

  async getAuditLogs(
    filters: {
      entityType?: string
      entityId?: string
      userId?: string
      startDate?: Date
      endDate?: Date
    },
    limit: number = 100,
    offset: number = 0
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      let whereClause = 'WHERE 1=1'
      const params: any[] = []
      let paramIndex = 1

      if (filters.entityType) {
        whereClause += ` AND entity_type = $${paramIndex}`
        params.push(filters.entityType)
        paramIndex++
      }

      if (filters.entityId) {
        whereClause += ` AND entity_id = $${paramIndex}`
        params.push(filters.entityId)
        paramIndex++
      }

      if (filters.userId) {
        whereClause += ` AND user_id = $${paramIndex}`
        params.push(filters.userId)
        paramIndex++
      }

      if (filters.startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`
        params.push(filters.startDate)
        paramIndex++
      }

      if (filters.endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`
        params.push(filters.endDate)
        paramIndex++
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`
      const countResult = await this.db.query(countQuery, params)
      const total = parseInt(countResult.rows[0].count)

      // Get logs
      const query = `
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `
      params.push(limit, offset)

      const result = await this.db.query(query, params)
      const logs = result.rows.map(row => this.mapRowToAuditLog(row))

      return { logs, total }

    } catch (error) {
      logger.error('Failed to get audit logs', { filters, error: error.message })
      throw error
    }
  }

  async getAuditLogsByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE created_at >= $1 AND created_at <= $2
        ORDER BY created_at DESC
      `

      const result = await this.db.query(query, [startDate, endDate])
      return result.rows.map(row => this.mapRowToAuditLog(row))

    } catch (error) {
      logger.error('Failed to get audit logs by date range', { 
        startDate, 
        endDate, 
        error: error.message 
      })
      throw error
    }
  }

  async createGDPRRequest(request: GDPRRequest): Promise<void> {
    try {
      const query = `
        INSERT INTO gdpr_requests (
          id, user_id, request_type, status, requested_at, expires_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `

      await this.db.query(query, [
        request.id,
        request.userId,
        request.requestType,
        request.status,
        request.requestedAt,
        request.expiresAt,
        JSON.stringify(request.metadata)
      ])

    } catch (error) {
      logger.error('Failed to create GDPR request', { 
        requestId: request.id,
        error: error.message 
      })
      throw error
    }
  }

  async getGDPRRequest(requestId: string): Promise<GDPRRequest | null> {
    try {
      const query = 'SELECT * FROM gdpr_requests WHERE id = $1'
      const result = await this.db.query(query, [requestId])

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToGDPRRequest(result.rows[0])

    } catch (error) {
      logger.error('Failed to get GDPR request', { 
        requestId,
        error: error.message 
      })
      throw error
    }
  }

  async updateGDPRRequestStatus(requestId: string, status: GDPRRequestStatus): Promise<void> {
    try {
      const query = `
        UPDATE gdpr_requests 
        SET status = $1, updated_at = CURRENT_TIMESTAMP,
            fulfilled_at = CASE WHEN $1 = 'fulfilled' THEN CURRENT_TIMESTAMP ELSE fulfilled_at END
        WHERE id = $2
      `

      await this.db.query(query, [status, requestId])

    } catch (error) {
      logger.error('Failed to update GDPR request status', { 
        requestId,
        status,
        error: error.message 
      })
      throw error
    }
  }

  async createComplianceReport(report: ComplianceReport): Promise<void> {
    try {
      const query = `
        INSERT INTO compliance_reports (
          id, report_type, period_start, period_end, period_description,
          generated_by, generated_at, data, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `

      await this.db.query(query, [
        report.id,
        report.reportType,
        report.period.startDate,
        report.period.endDate,
        report.period.description,
        report.generatedBy,
        report.generatedAt,
        JSON.stringify(report.data),
        JSON.stringify(report.metadata)
      ])

    } catch (error) {
      logger.error('Failed to create compliance report', { 
        reportId: report.id,
        error: error.message 
      })
      throw error
    }
  }

  async createComplianceFinding(finding: ComplianceFinding): Promise<void> {
    try {
      const query = `
        INSERT INTO compliance_findings (
          id, severity, category, description, affected_records,
          remediation, status, due_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `

      await this.db.query(query, [
        finding.id,
        finding.severity,
        finding.category,
        finding.description,
        finding.affectedRecords,
        finding.remediation,
        finding.status,
        finding.dueDate
      ])

    } catch (error) {
      logger.error('Failed to create compliance finding', { 
        findingId: finding.id,
        error: error.message 
      })
      throw error
    }
  }

  async getComplianceFindings(startDate: Date, endDate: Date): Promise<ComplianceFinding[]> {
    try {
      const query = `
        SELECT * FROM compliance_findings 
        WHERE created_at >= $1 AND created_at <= $2
        ORDER BY severity DESC, created_at DESC
      `

      const result = await this.db.query(query, [startDate, endDate])
      return result.rows.map(row => this.mapRowToComplianceFinding(row))

    } catch (error) {
      logger.error('Failed to get compliance findings', { 
        startDate,
        endDate,
        error: error.message 
      })
      throw error
    }
  }

  async createConsentRecord(consent: ConsentRecord): Promise<void> {
    try {
      const query = `
        INSERT INTO consent_records (
          id, user_id, consent_type, consent_given, consent_date,
          legal_basis, purpose, data_types, processing_location,
          third_parties, retention_period_days, version, ip_address,
          user_agent, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `

      await this.db.query(query, [
        consent.id,
        consent.userId,
        consent.consentType,
        consent.consentGiven,
        consent.consentDate,
        consent.legalBasis,
        consent.purpose,
        consent.dataTypes,
        consent.processingLocation,
        consent.thirdParties,
        consent.retentionPeriod,
        consent.version,
        consent.ipAddress,
        consent.userAgent,
        JSON.stringify(consent.metadata)
      ])

    } catch (error) {
      logger.error('Failed to create consent record', { 
        consentId: consent.id,
        error: error.message 
      })
      throw error
    }
  }

  async getConsentRecord(consentId: string): Promise<ConsentRecord | null> {
    try {
      const query = 'SELECT * FROM consent_records WHERE id = $1'
      const result = await this.db.query(query, [consentId])

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToConsentRecord(result.rows[0])

    } catch (error) {
      logger.error('Failed to get consent record', { 
        consentId,
        error: error.message 
      })
      throw error
    }
  }

  async withdrawConsent(consentId: string): Promise<void> {
    try {
      const query = `
        UPDATE consent_records 
        SET withdrawn_date = CURRENT_TIMESTAMP, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `

      await this.db.query(query, [consentId])

    } catch (error) {
      logger.error('Failed to withdraw consent', { 
        consentId,
        error: error.message 
      })
      throw error
    }
  }

  // Additional repository methods for retention and compliance...
  async getExpiredRecords(): Promise<AuditLog[]> {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE (retention->>'retainUntil')::timestamp < CURRENT_TIMESTAMP
          AND legal_hold = FALSE
          AND is_archived = FALSE
        ORDER BY created_at ASC
        LIMIT 1000
      `

      const result = await this.db.query(query)
      return result.rows.map(row => this.mapRowToAuditLog(row))

    } catch (error) {
      logger.error('Failed to get expired records', { error: error.message })
      throw error
    }
  }

  async getRecentAccessDenials(userId: string, ipAddress: string, since: Date): Promise<AuditLog[]> {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE user_id = $1 AND ip_address = $2 AND action = 'access_denied' 
          AND created_at >= $3
        ORDER BY created_at DESC
      `

      const result = await this.db.query(query, [userId, ipAddress, since])
      return result.rows.map(row => this.mapRowToAuditLog(row))

    } catch (error) {
      logger.error('Failed to get recent access denials', { 
        userId,
        ipAddress,
        error: error.message 
      })
      throw error
    }
  }

  async getUserRecentIPAddresses(userId: string, days: number): Promise<string[]> {
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const query = `
        SELECT DISTINCT ip_address 
        FROM audit_logs 
        WHERE user_id = $1 AND created_at >= $2
      `

      const result = await this.db.query(query, [userId, since])
      return result.rows.map(row => row.ip_address)

    } catch (error) {
      logger.error('Failed to get user recent IP addresses', { 
        userId,
        days,
        error: error.message 
      })
      throw error
    }
  }

  // Helper methods for caching and mapping
  private async cacheAuditLog(auditLog: AuditLog): Promise<void> {
    try {
      const key = `audit:recent:${auditLog.userId}`
      await this.redis.lpush(key, JSON.stringify(auditLog))
      await this.redis.ltrim(key, 0, 99) // Keep last 100 entries
      await this.redis.expire(key, 3600) // 1 hour expiry
    } catch (error) {
      // Non-critical, don't throw
      logger.warn('Failed to cache audit log', { error: error.message })
    }
  }

  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      eventId: row.event_id,
      userId: row.user_id,
      userEmail: row.user_email,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      oldValues: row.old_values,
      newValues: row.new_values,
      changes: row.changes,
      source: row.source,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      sessionId: row.session_id,
      requestId: row.request_id,
      compliance: row.compliance,
      retention: row.retention,
      classification: row.classification,
      metadata: row.metadata,
      createdAt: row.created_at
    }
  }

  private mapRowToGDPRRequest(row: any): GDPRRequest {
    return {
      id: row.id,
      userId: row.user_id,
      requestType: row.request_type,
      status: row.status,
      requestedAt: row.requested_at,
      fulfilledAt: row.fulfilled_at,
      expiresAt: row.expires_at,
      metadata: row.metadata
    }
  }

  private mapRowToComplianceFinding(row: any): ComplianceFinding {
    return {
      id: row.id,
      severity: row.severity,
      category: row.category,
      description: row.description,
      affectedRecords: row.affected_records,
      remediation: row.remediation,
      status: row.status,
      dueDate: row.due_date
    }
  }

  private mapRowToConsentRecord(row: any): ConsentRecord {
    return {
      id: row.id,
      userId: row.user_id,
      consentType: row.consent_type,
      consentGiven: row.consent_given,
      consentDate: row.consent_date,
      withdrawnDate: row.withdrawn_date,
      legalBasis: row.legal_basis,
      purpose: row.purpose,
      dataTypes: row.data_types,
      processingLocation: row.processing_location,
      thirdParties: row.third_parties,
      retentionPeriod: row.retention_period_days,
      version: row.version,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      isActive: row.is_active,
      metadata: row.metadata
    }
  }

  // Additional stub methods for retention service
  async createRetentionRule(rule: DataRetentionRule): Promise<void> {
    // Implementation stub
  }

  async updateRetentionRule(ruleId: string, updates: Partial<DataRetentionRule>): Promise<void> {
    // Implementation stub  
  }

  async getRetentionRules(entityType?: string): Promise<DataRetentionRule[]> {
    // Implementation stub
    return []
  }

  async applyLegalHold(entityType: string, entityId: string, reason: string): Promise<void> {
    // Implementation stub
  }

  async removeLegalHold(entityType: string, entityId: string, reason: string): Promise<void> {
    // Implementation stub
  }

  async getRecordsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    // Implementation stub
    return []
  }

  async getRecordCount(startDate: Date, endDate: Date): Promise<number> {
    // Implementation stub
    return 0
  }

  async getExpiredRecordCount(startDate: Date, endDate: Date): Promise<number> {
    // Implementation stub
    return 0
  }

  async getDeletedRecordCount(startDate: Date, endDate: Date): Promise<number> {
    // Implementation stub
    return 0
  }

  async getArchivedRecordCount(startDate: Date, endDate: Date): Promise<number> {
    // Implementation stub
    return 0
  }

  async getLegalHoldRecordCount(): Promise<number> {
    // Implementation stub
    return 0
  }

  async getUserAuditRecords(userId: string): Promise<AuditLog[]> {
    // Implementation stub
    return []
  }

  async archiveRecord(auditId: string): Promise<void> {
    // Implementation stub
  }

  async deleteRecord(auditId: string): Promise<void> {
    // Implementation stub
  }

  async markForReview(auditId: string, reason: string): Promise<void> {
    // Implementation stub
  }
}
