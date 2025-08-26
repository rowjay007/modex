"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userProgressRelations = exports.courseAnalyticsRelations = exports.userEventsRelations = exports.dailyAnalytics = exports.userProgress = exports.courseAnalytics = exports.userEvents = exports.eventTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// Event types enum
exports.eventTypeEnum = (0, pg_core_1.pgEnum)('event_type', [
    'page_view',
    'course_view',
    'lesson_start',
    'lesson_complete',
    'quiz_start',
    'quiz_complete',
    'enrollment',
    'payment',
    'login',
    'logout',
    'search',
    'click',
    'scroll',
    'video_play',
    'video_pause',
    'video_complete'
]);
// User events table
exports.userEvents = (0, pg_core_1.pgTable)('user_events', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id'),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 255 }),
    // Event details
    eventType: (0, exports.eventTypeEnum)('event_type').notNull(),
    eventName: (0, pg_core_1.varchar)('event_name', { length: 100 }).notNull(),
    // Context
    courseId: (0, pg_core_1.uuid)('course_id'),
    lessonId: (0, pg_core_1.uuid)('lesson_id'),
    assessmentId: (0, pg_core_1.uuid)('assessment_id'),
    // Metadata
    properties: (0, pg_core_1.text)('properties'), // JSON string
    userAgent: (0, pg_core_1.text)('user_agent'),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    referrer: (0, pg_core_1.text)('referrer'),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// Course analytics table
exports.courseAnalytics = (0, pg_core_1.pgTable)('course_analytics', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    courseId: (0, pg_core_1.uuid)('course_id').notNull(),
    // Metrics
    totalViews: (0, pg_core_1.integer)('total_views').default(0),
    totalEnrollments: (0, pg_core_1.integer)('total_enrollments').default(0),
    totalCompletions: (0, pg_core_1.integer)('total_completions').default(0),
    totalRevenue: (0, pg_core_1.decimal)('total_revenue', { precision: 10, scale: 2 }).default('0'),
    // Engagement metrics
    averageTimeSpent: (0, pg_core_1.integer)('average_time_spent').default(0), // in seconds
    averageCompletionRate: (0, pg_core_1.decimal)('average_completion_rate', { precision: 5, scale: 2 }).default('0'),
    // Timestamps
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// User learning progress table
exports.userProgress = (0, pg_core_1.pgTable)('user_progress', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull(),
    courseId: (0, pg_core_1.uuid)('course_id').notNull(),
    // Progress tracking
    lessonsCompleted: (0, pg_core_1.integer)('lessons_completed').default(0),
    totalLessons: (0, pg_core_1.integer)('total_lessons').default(0),
    completionPercentage: (0, pg_core_1.decimal)('completion_percentage', { precision: 5, scale: 2 }).default('0'),
    // Time tracking
    totalTimeSpent: (0, pg_core_1.integer)('total_time_spent').default(0), // in seconds
    lastActivityAt: (0, pg_core_1.timestamp)('last_activity_at'),
    // Status
    isCompleted: (0, pg_core_1.boolean)('is_completed').default(false),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Daily analytics aggregation table
exports.dailyAnalytics = (0, pg_core_1.pgTable)('daily_analytics', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    date: (0, pg_core_1.timestamp)('date').notNull(),
    // Overall metrics
    totalUsers: (0, pg_core_1.integer)('total_users').default(0),
    activeUsers: (0, pg_core_1.integer)('active_users').default(0),
    newUsers: (0, pg_core_1.integer)('new_users').default(0),
    // Course metrics
    totalCourseViews: (0, pg_core_1.integer)('total_course_views').default(0),
    totalEnrollments: (0, pg_core_1.integer)('total_enrollments').default(0),
    totalCompletions: (0, pg_core_1.integer)('total_completions').default(0),
    // Revenue metrics
    totalRevenue: (0, pg_core_1.decimal)('total_revenue', { precision: 10, scale: 2 }).default('0'),
    // Timestamps
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// Relations
exports.userEventsRelations = (0, drizzle_orm_1.relations)(exports.userEvents, ({ one }) => ({
    userProgress: one(exports.userProgress, {
        fields: [exports.userEvents.userId, exports.userEvents.courseId],
        references: [exports.userProgress.userId, exports.userProgress.courseId],
    }),
}));
exports.courseAnalyticsRelations = (0, drizzle_orm_1.relations)(exports.courseAnalytics, ({ many }) => ({
    userProgress: many(exports.userProgress),
}));
exports.userProgressRelations = (0, drizzle_orm_1.relations)(exports.userProgress, ({ many }) => ({
    events: many(exports.userEvents),
}));
