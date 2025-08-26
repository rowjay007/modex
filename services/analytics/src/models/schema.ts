import { pgTable, uuid, varchar, timestamp, text, integer, boolean, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Event types enum
export const eventTypeEnum = pgEnum('event_type', [
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
export const userEvents = pgTable('user_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  sessionId: varchar('session_id', { length: 255 }),
  
  // Event details
  eventType: eventTypeEnum('event_type').notNull(),
  eventName: varchar('event_name', { length: 100 }).notNull(),
  
  // Context
  courseId: uuid('course_id'),
  lessonId: uuid('lesson_id'),
  assessmentId: uuid('assessment_id'),
  
  // Metadata
  properties: text('properties'), // JSON string
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  referrer: text('referrer'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Course analytics table
export const courseAnalytics = pgTable('course_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id').notNull(),
  
  // Metrics
  totalViews: integer('total_views').default(0),
  totalEnrollments: integer('total_enrollments').default(0),
  totalCompletions: integer('total_completions').default(0),
  totalRevenue: decimal('total_revenue', { precision: 10, scale: 2 }).default('0'),
  
  // Engagement metrics
  averageTimeSpent: integer('average_time_spent').default(0), // in seconds
  averageCompletionRate: decimal('average_completion_rate', { precision: 5, scale: 2 }).default('0'),
  
  // Timestamps
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User learning progress table
export const userProgress = pgTable('user_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  courseId: uuid('course_id').notNull(),
  
  // Progress tracking
  lessonsCompleted: integer('lessons_completed').default(0),
  totalLessons: integer('total_lessons').default(0),
  completionPercentage: decimal('completion_percentage', { precision: 5, scale: 2 }).default('0'),
  
  // Time tracking
  totalTimeSpent: integer('total_time_spent').default(0), // in seconds
  lastActivityAt: timestamp('last_activity_at'),
  
  // Status
  isCompleted: boolean('is_completed').default(false),
  completedAt: timestamp('completed_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Daily analytics aggregation table
export const dailyAnalytics = pgTable('daily_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: timestamp('date').notNull(),
  
  // Overall metrics
  totalUsers: integer('total_users').default(0),
  activeUsers: integer('active_users').default(0),
  newUsers: integer('new_users').default(0),
  
  // Course metrics
  totalCourseViews: integer('total_course_views').default(0),
  totalEnrollments: integer('total_enrollments').default(0),
  totalCompletions: integer('total_completions').default(0),
  
  // Revenue metrics
  totalRevenue: decimal('total_revenue', { precision: 10, scale: 2 }).default('0'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const userEventsRelations = relations(userEvents, ({ one }) => ({
  userProgress: one(userProgress, {
    fields: [userEvents.userId, userEvents.courseId],
    references: [userProgress.userId, userProgress.courseId],
  }),
}));

export const courseAnalyticsRelations = relations(courseAnalytics, ({ many }) => ({
  userProgress: many(userProgress),
}));

export const userProgressRelations = relations(userProgress, ({ many }) => ({
  events: many(userEvents),
}));
