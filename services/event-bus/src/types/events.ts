export interface BaseEvent {
  id: string
  aggregateId: string
  aggregateType: string
  eventType: string
  version: number
  timestamp: Date
  userId?: string
  metadata?: Record<string, any>
}

// User Events
export interface UserRegisteredEvent extends BaseEvent {
  eventType: 'USER_REGISTERED'
  aggregateType: 'User'
  data: {
    email: string
    name: string
    role: 'student' | 'instructor' | 'admin'
  }
}

export interface UserProfileUpdatedEvent extends BaseEvent {
  eventType: 'USER_PROFILE_UPDATED'
  aggregateType: 'User'
  data: {
    email?: string
    name?: string
    avatar?: string
  }
}

// Course Events
export interface CourseCreatedEvent extends BaseEvent {
  eventType: 'COURSE_CREATED'
  aggregateType: 'Course'
  data: {
    title: string
    description: string
    instructorId: string
    price: number
    category: string
    level: 'Beginner' | 'Intermediate' | 'Advanced'
  }
}

export interface CourseUpdatedEvent extends BaseEvent {
  eventType: 'COURSE_UPDATED'
  aggregateType: 'Course'
  data: {
    title?: string
    description?: string
    price?: number
    category?: string
  }
}

export interface CoursePublishedEvent extends BaseEvent {
  eventType: 'COURSE_PUBLISHED'
  aggregateType: 'Course'
  data: {
    title: string
    instructorId: string
  }
}

// Enrollment Events
export interface StudentEnrolledEvent extends BaseEvent {
  eventType: 'STUDENT_ENROLLED'
  aggregateType: 'Enrollment'
  data: {
    courseId: string
    studentId: string
    enrollmentDate: Date
    paymentId?: string
  }
}

export interface LessonCompletedEvent extends BaseEvent {
  eventType: 'LESSON_COMPLETED'
  aggregateType: 'Enrollment'
  data: {
    courseId: string
    studentId: string
    lessonId: string
    completionDate: Date
    timeSpent: number
  }
}

export interface CourseCompletedEvent extends BaseEvent {
  eventType: 'COURSE_COMPLETED'
  aggregateType: 'Enrollment'
  data: {
    courseId: string
    studentId: string
    completionDate: Date
    finalScore?: number
    certificateId?: string
  }
}

// Assessment Events
export interface AssessmentAttemptedEvent extends BaseEvent {
  eventType: 'ASSESSMENT_ATTEMPTED'
  aggregateType: 'Assessment'
  data: {
    assessmentId: string
    studentId: string
    courseId: string
    attemptNumber: number
    startTime: Date
  }
}

export interface AssessmentCompletedEvent extends BaseEvent {
  eventType: 'ASSESSMENT_COMPLETED'
  aggregateType: 'Assessment'
  data: {
    assessmentId: string
    studentId: string
    courseId: string
    score: number
    passed: boolean
    completionTime: Date
    timeSpent: number
  }
}

// Payment Events
export interface PaymentInitiatedEvent extends BaseEvent {
  eventType: 'PAYMENT_INITIATED'
  aggregateType: 'Payment'
  data: {
    courseId: string
    studentId: string
    amount: number
    currency: string
    paymentMethod: string
  }
}

export interface PaymentCompletedEvent extends BaseEvent {
  eventType: 'PAYMENT_COMPLETED'
  aggregateType: 'Payment'
  data: {
    courseId: string
    studentId: string
    amount: number
    transactionId: string
    paymentMethod: string
  }
}

export interface PaymentFailedEvent extends BaseEvent {
  eventType: 'PAYMENT_FAILED'
  aggregateType: 'Payment'
  data: {
    courseId: string
    studentId: string
    amount: number
    reason: string
    errorCode?: string
  }
}

export interface RefundProcessedEvent extends BaseEvent {
  eventType: 'REFUND_PROCESSED'
  aggregateType: 'Payment'
  data: {
    originalPaymentId: string
    refundAmount: number
    reason: string
    processedBy: string
  }
}

// Notification Events
export interface NotificationRequestedEvent extends BaseEvent {
  eventType: 'NOTIFICATION_REQUESTED'
  aggregateType: 'Notification'
  data: {
    recipientId: string
    type: 'email' | 'sms' | 'push' | 'in_app'
    template: string
    subject?: string
    content: string
    metadata?: Record<string, any>
    priority: 'low' | 'medium' | 'high' | 'urgent'
  }
}

// Content Events
export interface ContentUploadedEvent extends BaseEvent {
  eventType: 'CONTENT_UPLOADED'
  aggregateType: 'Content'
  data: {
    contentId: string
    courseId: string
    fileName: string
    fileType: string
    fileSize: number
    uploadedBy: string
  }
}

// System Events
export interface SystemHealthCheckEvent extends BaseEvent {
  eventType: 'SYSTEM_HEALTH_CHECK'
  aggregateType: 'System'
  data: {
    service: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    checks: Record<string, boolean>
  }
}

export type DomainEvent = 
  | UserRegisteredEvent
  | UserProfileUpdatedEvent
  | CourseCreatedEvent
  | CourseUpdatedEvent
  | CoursePublishedEvent
  | StudentEnrolledEvent
  | LessonCompletedEvent
  | CourseCompletedEvent
  | AssessmentAttemptedEvent
  | AssessmentCompletedEvent
  | PaymentInitiatedEvent
  | PaymentCompletedEvent
  | PaymentFailedEvent
  | RefundProcessedEvent
  | NotificationRequestedEvent
  | ContentUploadedEvent
  | SystemHealthCheckEvent
