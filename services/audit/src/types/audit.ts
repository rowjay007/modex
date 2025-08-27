export interface AuditLog {
  id: string
  eventId?: string
  userId: string
  userEmail?: string
  entityType: string
  entityId: string
  action: AuditAction
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  changes?: ChangeRecord[]
  source: AuditSource
  ipAddress: string
  userAgent: string
  sessionId?: string
  requestId?: string
  compliance: ComplianceFlags
  retention: RetentionPolicy
  classification: DataClassification
  metadata?: Record<string, any>
  createdAt: Date
}

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  EXPORT = 'export',
  IMPORT = 'import',
  SHARE = 'share',
  DOWNLOAD = 'download',
  PRINT = 'print',
  BACKUP = 'backup',
  RESTORE = 'restore'
}

export enum AuditSource {
  WEB_APP = 'web_app',
  MOBILE_APP = 'mobile_app',
  API = 'api',
  SYSTEM = 'system',
  ADMIN_PANEL = 'admin_panel',
  BACKGROUND_JOB = 'background_job',
  INTEGRATION = 'integration'
}

export interface ChangeRecord {
  field: string
  oldValue: any
  newValue: any
  type: 'added' | 'modified' | 'removed'
}

export interface ComplianceFlags {
  gdpr: boolean
  sox: boolean
  hipaa: boolean
  pci: boolean
  ferpa: boolean
  coppa: boolean
}

export interface RetentionPolicy {
  retainUntil: Date
  autoDelete: boolean
  legalHold: boolean
  archiveAfter?: Date
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  PII = 'pii',
  SENSITIVE = 'sensitive'
}

export interface GDPRRequest {
  id: string
  userId: string
  requestType: GDPRRequestType
  status: GDPRRequestStatus
  requestedAt: Date
  fulfilledAt?: Date
  expiresAt: Date
  metadata?: Record<string, any>
  documents?: GDPRDocument[]
}

export enum GDPRRequestType {
  ACCESS = 'access',
  RECTIFICATION = 'rectification',
  ERASURE = 'erasure',
  PORTABILITY = 'portability',
  RESTRICTION = 'restriction',
  OBJECTION = 'objection',
  WITHDRAW_CONSENT = 'withdraw_consent'
}

export enum GDPRRequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export interface GDPRDocument {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  downloadUrl: string
  expiresAt: Date
  createdAt: Date
}

export interface ComplianceReport {
  id: string
  reportType: ComplianceReportType
  period: ReportPeriod
  generatedBy: string
  generatedAt: Date
  data: ComplianceData
  metadata?: Record<string, any>
}

export enum ComplianceReportType {
  GDPR_AUDIT = 'gdpr_audit',
  SOX_AUDIT = 'sox_audit',
  SECURITY_AUDIT = 'security_audit',
  DATA_BREACH = 'data_breach',
  ACCESS_REVIEW = 'access_review',
  RETENTION_REVIEW = 'retention_review'
}

export interface ReportPeriod {
  startDate: Date
  endDate: Date
  description: string
}

export interface ComplianceData {
  totalEvents: number
  eventsByType: Record<string, number>
  privacyEvents: number
  securityEvents: number
  accessEvents: number
  dataExports: number
  deletionRequests: number
  breachEvents: number
  findings: ComplianceFinding[]
  recommendations: string[]
}

export interface ComplianceFinding {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  description: string
  affectedRecords: number
  remediation: string
  status: 'open' | 'in_progress' | 'resolved'
  dueDate?: Date
}

export interface DataRetentionRule {
  id: string
  name: string
  description: string
  entityType: string
  retentionPeriod: number // in days
  isActive: boolean
  legalBasis: string
  autoDelete: boolean
  archiveBeforeDelete: boolean
  exceptions: string[]
  createdAt: Date
  updatedAt: Date
}

export interface ConsentRecord {
  id: string
  userId: string
  consentType: ConsentType
  consentGiven: boolean
  consentDate: Date
  withdrawnDate?: Date
  legalBasis: string
  purpose: string
  dataTypes: string[]
  processingLocation: string
  thirdParties: string[]
  retentionPeriod: number
  version: string
  ipAddress: string
  userAgent: string
  isActive: boolean
  metadata?: Record<string, any>
}

export enum ConsentType {
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  COOKIES = 'cookies',
  THIRD_PARTY = 'third_party',
  PROFILING = 'profiling',
  AUTOMATED_DECISIONS = 'automated_decisions',
  DATA_SHARING = 'data_sharing'
}
