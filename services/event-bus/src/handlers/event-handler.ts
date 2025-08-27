import { DomainEvent } from '../types/events'
import { logger } from '../utils/logger'
import { EventStore } from '../store/event-store'
import { NotificationService } from '../integrations/notification-service'
import { AnalyticsService } from '../integrations/analytics-service'
import { AuditService } from '../integrations/audit-service'

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>
}

export class DomainEventHandler implements EventHandler {
  private eventStore: EventStore
  private notificationService: NotificationService
  private analyticsService: AnalyticsService
  private auditService: AuditService

  constructor(
    eventStore: EventStore,
    notificationService: NotificationService,
    analyticsService: AnalyticsService,
    auditService: AuditService
  ) {
    this.eventStore = eventStore
    this.notificationService = notificationService
    this.analyticsService = analyticsService
    this.auditService = auditService
  }

  async handle(event: DomainEvent): Promise<void> {
    try {
      // Store event in event store for audit and replay
      await this.eventStore.saveEvent(event)

      // Handle specific event types
      switch (event.eventType) {
        case 'USER_REGISTERED':
          await this.handleUserRegistered(event as any)
          break
        case 'STUDENT_ENROLLED':
          await this.handleStudentEnrolled(event as any)
          break
        case 'COURSE_COMPLETED':
          await this.handleCourseCompleted(event as any)
          break
        case 'PAYMENT_COMPLETED':
          await this.handlePaymentCompleted(event as any)
          break
        case 'PAYMENT_FAILED':
          await this.handlePaymentFailed(event as any)
          break
        case 'ASSESSMENT_COMPLETED':
          await this.handleAssessmentCompleted(event as any)
          break
        case 'COURSE_PUBLISHED':
          await this.handleCoursePublished(event as any)
          break
        default:
          logger.info('No specific handler for event type', { eventType: event.eventType })
      }

      // Send analytics data for all events
      await this.analyticsService.trackEvent(event)

      // Audit critical events
      if (this.isCriticalEvent(event)) {
        await this.auditService.logEvent(event)
      }

    } catch (error) {
      logger.error('Failed to handle event', {
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error
      })
      throw error
    }
  }

  private async handleUserRegistered(event: any): Promise<void> {
    // Send welcome email
    await this.notificationService.sendNotification({
      recipientId: event.aggregateId,
      type: 'email',
      template: 'welcome_email',
      subject: 'Welcome to Modex Learning Platform',
      content: `Welcome ${event.data.name}! Your account has been created successfully.`,
      priority: 'medium'
    })

    // Send welcome push notification if mobile app is installed
    await this.notificationService.sendNotification({
      recipientId: event.aggregateId,
      type: 'push',
      template: 'welcome_push',
      content: 'Welcome to Modex! Start your learning journey today.',
      priority: 'low'
    })

    logger.info('Welcome notifications sent for new user', {
      userId: event.aggregateId,
      email: event.data.email
    })
  }

  private async handleStudentEnrolled(event: any): Promise<void> {
    // Send enrollment confirmation
    await this.notificationService.sendNotification({
      recipientId: event.data.studentId,
      type: 'email',
      template: 'enrollment_confirmation',
      subject: 'Course Enrollment Confirmed',
      content: `You have successfully enrolled in the course. Start learning now!`,
      metadata: {
        courseId: event.data.courseId,
        enrollmentDate: event.data.enrollmentDate
      },
      priority: 'high'
    })

    // Notify instructor of new enrollment
    await this.notificationService.sendNotification({
      recipientId: event.metadata?.instructorId,
      type: 'in_app',
      template: 'new_student_enrolled',
      content: 'A new student has enrolled in your course',
      metadata: {
        courseId: event.data.courseId,
        studentId: event.data.studentId
      },
      priority: 'medium'
    })

    logger.info('Enrollment notifications sent', {
      studentId: event.data.studentId,
      courseId: event.data.courseId
    })
  }

  private async handleCourseCompleted(event: any): Promise<void> {
    // Send completion certificate
    await this.notificationService.sendNotification({
      recipientId: event.data.studentId,
      type: 'email',
      template: 'course_completion_certificate',
      subject: 'Congratulations! Course Completed',
      content: `Congratulations on completing the course! Your certificate is attached.`,
      metadata: {
        courseId: event.data.courseId,
        completionDate: event.data.completionDate,
        certificateId: event.data.certificateId
      },
      priority: 'high'
    })

    // Suggest related courses
    await this.notificationService.sendNotification({
      recipientId: event.data.studentId,
      type: 'in_app',
      template: 'course_recommendations',
      content: 'Check out these recommended courses based on your learning journey',
      priority: 'low'
    })

    logger.info('Course completion notifications sent', {
      studentId: event.data.studentId,
      courseId: event.data.courseId
    })
  }

  private async handlePaymentCompleted(event: any): Promise<void> {
    // Send payment receipt
    await this.notificationService.sendNotification({
      recipientId: event.data.studentId,
      type: 'email',
      template: 'payment_receipt',
      subject: 'Payment Receipt - Course Access Granted',
      content: `Your payment has been processed successfully. You now have access to the course.`,
      metadata: {
        amount: event.data.amount,
        transactionId: event.data.transactionId,
        courseId: event.data.courseId
      },
      priority: 'high'
    })

    logger.info('Payment confirmation sent', {
      studentId: event.data.studentId,
      amount: event.data.amount,
      transactionId: event.data.transactionId
    })
  }

  private async handlePaymentFailed(event: any): Promise<void> {
    // Send payment failure notification
    await this.notificationService.sendNotification({
      recipientId: event.data.studentId,
      type: 'email',
      template: 'payment_failed',
      subject: 'Payment Processing Failed',
      content: `We were unable to process your payment. Please try again or contact support.`,
      metadata: {
        amount: event.data.amount,
        reason: event.data.reason,
        courseId: event.data.courseId
      },
      priority: 'urgent'
    })

    // Send support notification for urgent cases
    await this.notificationService.sendNotification({
      recipientId: 'support-team',
      type: 'email',
      template: 'payment_failure_alert',
      subject: 'Payment Failure Alert',
      content: `Payment failure for student ${event.data.studentId}. Reason: ${event.data.reason}`,
      priority: 'urgent'
    })

    logger.error('Payment failure notifications sent', {
      studentId: event.data.studentId,
      reason: event.data.reason
    })
  }

  private async handleAssessmentCompleted(event: any): Promise<void> {
    if (event.data.passed) {
      // Send congratulations for passing
      await this.notificationService.sendNotification({
        recipientId: event.data.studentId,
        type: 'email',
        template: 'assessment_passed',
        subject: 'Congratulations! Assessment Passed',
        content: `Great job! You passed the assessment with a score of ${event.data.score}%.`,
        metadata: {
          assessmentId: event.data.assessmentId,
          score: event.data.score
        },
        priority: 'medium'
      })
    } else {
      // Send encouragement for retrying
      await this.notificationService.sendNotification({
        recipientId: event.data.studentId,
        type: 'email',
        template: 'assessment_failed',
        subject: 'Assessment Result - Try Again',
        content: `You scored ${event.data.score}%. Don't give up! Review the material and try again.`,
        metadata: {
          assessmentId: event.data.assessmentId,
          score: event.data.score
        },
        priority: 'medium'
      })
    }

    logger.info('Assessment completion notification sent', {
      studentId: event.data.studentId,
      passed: event.data.passed,
      score: event.data.score
    })
  }

  private async handleCoursePublished(event: any): Promise<void> {
    // Notify all students who wishlisted this course
    await this.notificationService.sendNotification({
      recipientId: 'wishlist-subscribers',
      type: 'email',
      template: 'course_published',
      subject: 'New Course Available!',
      content: `A new course "${event.data.title}" is now available. Enroll now!`,
      metadata: {
        courseId: event.aggregateId,
        instructorId: event.data.instructorId
      },
      priority: 'medium'
    })

    logger.info('Course publication notifications sent', {
      courseId: event.aggregateId,
      title: event.data.title
    })
  }

  private isCriticalEvent(event: DomainEvent): boolean {
    const criticalEvents = [
      'USER_REGISTERED',
      'PAYMENT_COMPLETED',
      'PAYMENT_FAILED',
      'COURSE_COMPLETED',
      'REFUND_PROCESSED'
    ]
    return criticalEvents.includes(event.eventType)
  }
}
