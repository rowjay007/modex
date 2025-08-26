export interface EventData {
    userId?: string;
    sessionId?: string;
    eventType: string;
    eventName: string;
    courseId?: string;
    lessonId?: string;
    assessmentId?: string;
    properties?: Record<string, any>;
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
}
export interface AnalyticsFilter {
    startDate?: Date;
    endDate?: Date;
    courseId?: string;
    userId?: string;
    eventType?: string;
}
declare class AnalyticsService {
    trackEvent(eventData: EventData): Promise<void>;
    processBatchedEvents(): Promise<void>;
    getCourseAnalytics(courseId: string, days?: number): Promise<any>;
    getUserProgress(userId: string, courseId?: string): Promise<any>;
    getDashboardAnalytics(days?: number): Promise<any>;
    updateUserProgress(userId: string, courseId: string, data: {
        lessonsCompleted?: number;
        totalLessons?: number;
        timeSpent?: number;
        isCompleted?: boolean;
    }): Promise<void>;
}
export declare const analyticsService: AnalyticsService;
export {};
