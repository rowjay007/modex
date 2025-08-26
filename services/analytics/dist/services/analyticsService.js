"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const schema_1 = require("../models/schema");
const date_fns_1 = require("date-fns");
const uuid_1 = require("uuid");
class AnalyticsService {
    // Track user events
    async trackEvent(eventData) {
        try {
            // Add to batch for processing
            const batchKey = `events:batch:${(0, date_fns_1.format)(new Date(), 'yyyy-MM-dd-HH')}`;
            await redis_1.redisClient.addEventToBatch(batchKey, {
                ...eventData,
                id: (0, uuid_1.v4)(),
                createdAt: new Date(),
            });
            // Increment real-time counters
            const today = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
            await redis_1.redisClient.incrementCounter(`analytics:events:${today}`);
            if (eventData.courseId) {
                await redis_1.redisClient.incrementCounter(`analytics:course:${eventData.courseId}:${today}`);
            }
            if (eventData.userId) {
                await redis_1.redisClient.incrementCounter(`analytics:user:${eventData.userId}:${today}`);
            }
        }
        catch (error) {
            console.error('Error tracking event:', error);
            throw error;
        }
    }
    // Process batched events (called by scheduled job)
    async processBatchedEvents() {
        try {
            const currentHour = (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd-HH');
            const previousHour = (0, date_fns_1.format)((0, date_fns_1.subDays)(new Date(), 0), 'yyyy-MM-dd-HH');
            for (const hour of [currentHour, previousHour]) {
                const batchKey = `events:batch:${hour}`;
                const events = await redis_1.redisClient.getEventBatch(batchKey, 1000);
                if (events.length > 0) {
                    // Insert events into database
                    await database_1.db.insert(schema_1.userEvents).values(events.map(event => ({
                        ...event,
                        properties: event.properties ? JSON.stringify(event.properties) : null,
                    })));
                    console.log(`Processed ${events.length} events for hour ${hour}`);
                }
            }
        }
        catch (error) {
            console.error('Error processing batched events:', error);
            throw error;
        }
    }
    // Get course analytics
    async getCourseAnalytics(courseId, days = 30) {
        try {
            const cacheKey = `analytics:course:${courseId}:${days}d`;
            const cached = await redis_1.redisClient.getCachedAnalyticsData(cacheKey);
            if (cached) {
                return cached;
            }
            const startDate = (0, date_fns_1.subDays)(new Date(), days);
            // Get course analytics from database
            const [analytics] = await database_1.db
                .select()
                .from(schema_1.courseAnalytics)
                .where((0, drizzle_orm_1.eq)(schema_1.courseAnalytics.courseId, courseId));
            // Get recent events for this course
            const events = await database_1.db
                .select({
                eventType: schema_1.userEvents.eventType,
                eventName: schema_1.userEvents.eventName,
                createdAt: schema_1.userEvents.createdAt,
            })
                .from(schema_1.userEvents)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userEvents.courseId, courseId), (0, drizzle_orm_1.gte)(schema_1.userEvents.createdAt, startDate)))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.userEvents.createdAt));
            // Calculate metrics
            const eventsByType = events.reduce((acc, event) => {
                acc[event.eventType] = (acc[event.eventType] || 0) + 1;
                return acc;
            }, {});
            // Get user progress for this course
            const progressData = await database_1.db
                .select({
                userId: schema_1.userProgress.userId,
                completionPercentage: schema_1.userProgress.completionPercentage,
                totalTimeSpent: schema_1.userProgress.totalTimeSpent,
                isCompleted: schema_1.userProgress.isCompleted,
            })
                .from(schema_1.userProgress)
                .where((0, drizzle_orm_1.eq)(schema_1.userProgress.courseId, courseId));
            const result = {
                courseId,
                analytics: analytics || {
                    totalViews: 0,
                    totalEnrollments: 0,
                    totalCompletions: 0,
                    totalRevenue: '0',
                    averageTimeSpent: 0,
                    averageCompletionRate: '0',
                },
                eventsByType,
                progressData,
                totalUsers: progressData.length,
                completedUsers: progressData.filter(p => p.isCompleted).length,
                averageProgress: progressData.length > 0
                    ? (progressData.reduce((sum, p) => sum + parseFloat(p.completionPercentage || '0'), 0) / progressData.length).toFixed(2)
                    : '0',
            };
            // Cache result for 1 hour
            await redis_1.redisClient.cacheAnalyticsData(cacheKey, result, 3600);
            return result;
        }
        catch (error) {
            console.error('Error getting course analytics:', error);
            throw error;
        }
    }
    // Get user progress analytics
    async getUserProgress(userId, courseId) {
        try {
            const cacheKey = `analytics:user:${userId}:progress${courseId ? `:${courseId}` : ''}`;
            const cached = await redis_1.redisClient.getCachedAnalyticsData(cacheKey);
            if (cached) {
                return cached;
            }
            let query = database_1.db.select().from(schema_1.userProgress).where((0, drizzle_orm_1.eq)(schema_1.userProgress.userId, userId));
            if (courseId) {
                query = query.where((0, drizzle_orm_1.eq)(schema_1.userProgress.courseId, courseId));
            }
            const progress = await query;
            // Get recent events for this user
            const events = await database_1.db
                .select({
                eventType: schema_1.userEvents.eventType,
                eventName: schema_1.userEvents.eventName,
                courseId: schema_1.userEvents.courseId,
                createdAt: schema_1.userEvents.createdAt,
            })
                .from(schema_1.userEvents)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userEvents.userId, userId), courseId ? (0, drizzle_orm_1.eq)(schema_1.userEvents.courseId, courseId) : (0, drizzle_orm_1.sql) `true`, (0, drizzle_orm_1.gte)(schema_1.userEvents.createdAt, (0, date_fns_1.subDays)(new Date(), 30))))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.userEvents.createdAt))
                .limit(100);
            const result = {
                userId,
                courseId,
                progress,
                recentEvents: events,
                totalCourses: progress.length,
                completedCourses: progress.filter(p => p.isCompleted).length,
                averageProgress: progress.length > 0
                    ? (progress.reduce((sum, p) => sum + parseFloat(p.completionPercentage || '0'), 0) / progress.length).toFixed(2)
                    : '0',
            };
            // Cache result for 30 minutes
            await redis_1.redisClient.cacheAnalyticsData(cacheKey, result, 1800);
            return result;
        }
        catch (error) {
            console.error('Error getting user progress:', error);
            throw error;
        }
    }
    // Get dashboard analytics
    async getDashboardAnalytics(days = 7) {
        try {
            const cacheKey = `analytics:dashboard:${days}d`;
            const cached = await redis_1.redisClient.getCachedAnalyticsData(cacheKey);
            if (cached) {
                return cached;
            }
            const startDate = (0, date_fns_1.subDays)(new Date(), days);
            // Get daily analytics for the period
            const dailyData = await database_1.db
                .select()
                .from(schema_1.dailyAnalytics)
                .where((0, drizzle_orm_1.gte)(schema_1.dailyAnalytics.date, startDate))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.dailyAnalytics.date));
            // Get recent events summary
            const eventSummary = await database_1.db
                .select({
                eventType: schema_1.userEvents.eventType,
                count: (0, drizzle_orm_1.sql) `count(*)`.as('count'),
            })
                .from(schema_1.userEvents)
                .where((0, drizzle_orm_1.gte)(schema_1.userEvents.createdAt, startDate))
                .groupBy(schema_1.userEvents.eventType);
            // Get top courses by engagement
            const topCourses = await database_1.db
                .select({
                courseId: schema_1.userEvents.courseId,
                views: (0, drizzle_orm_1.sql) `count(*)`.as('views'),
            })
                .from(schema_1.userEvents)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(schema_1.userEvents.createdAt, startDate), (0, drizzle_orm_1.eq)(schema_1.userEvents.eventType, 'course_view')))
                .groupBy(schema_1.userEvents.courseId)
                .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `count(*)`))
                .limit(10);
            const result = {
                period: { days, startDate, endDate: new Date() },
                dailyData,
                eventSummary,
                topCourses,
                totalUsers: dailyData.reduce((sum, day) => sum + (day.totalUsers || 0), 0),
                activeUsers: dailyData.reduce((sum, day) => sum + (day.activeUsers || 0), 0),
                totalRevenue: dailyData.reduce((sum, day) => sum + parseFloat(day.totalRevenue || '0'), 0),
            };
            // Cache result for 15 minutes
            await redis_1.redisClient.cacheAnalyticsData(cacheKey, result, 900);
            return result;
        }
        catch (error) {
            console.error('Error getting dashboard analytics:', error);
            throw error;
        }
    }
    // Update user progress
    async updateUserProgress(userId, courseId, data) {
        try {
            const completionPercentage = data.totalLessons && data.lessonsCompleted
                ? ((data.lessonsCompleted / data.totalLessons) * 100).toFixed(2)
                : undefined;
            // Check if progress record exists
            const [existing] = await database_1.db
                .select()
                .from(schema_1.userProgress)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userProgress.userId, userId), (0, drizzle_orm_1.eq)(schema_1.userProgress.courseId, courseId)));
            if (existing) {
                // Update existing record
                await database_1.db
                    .update(schema_1.userProgress)
                    .set({
                    lessonsCompleted: data.lessonsCompleted ?? existing.lessonsCompleted,
                    totalLessons: data.totalLessons ?? existing.totalLessons,
                    completionPercentage: completionPercentage ?? existing.completionPercentage,
                    totalTimeSpent: data.timeSpent
                        ? (existing.totalTimeSpent || 0) + data.timeSpent
                        : existing.totalTimeSpent,
                    isCompleted: data.isCompleted ?? existing.isCompleted,
                    completedAt: data.isCompleted ? new Date() : existing.completedAt,
                    lastActivityAt: new Date(),
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userProgress.userId, userId), (0, drizzle_orm_1.eq)(schema_1.userProgress.courseId, courseId)));
            }
            else {
                // Create new record
                await database_1.db.insert(schema_1.userProgress).values({
                    userId,
                    courseId,
                    lessonsCompleted: data.lessonsCompleted || 0,
                    totalLessons: data.totalLessons || 0,
                    completionPercentage: completionPercentage || '0',
                    totalTimeSpent: data.timeSpent || 0,
                    isCompleted: data.isCompleted || false,
                    completedAt: data.isCompleted ? new Date() : undefined,
                    lastActivityAt: new Date(),
                });
            }
            // Invalidate cache
            await redis_1.redisClient.getClient().del(`analytics:user:${userId}:progress:${courseId}`);
        }
        catch (error) {
            console.error('Error updating user progress:', error);
            throw error;
        }
    }
}
exports.analyticsService = new AnalyticsService();
