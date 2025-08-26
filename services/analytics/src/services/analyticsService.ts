import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { redisClient } from '../config/redis';
import { userEvents, courseAnalytics, userProgress, dailyAnalytics } from '../models/schema';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

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

class AnalyticsService {

  // Track user events
  async trackEvent(eventData: EventData): Promise<void> {
    try {
      // Add to batch for processing
      const batchKey = `events:batch:${format(new Date(), 'yyyy-MM-dd-HH')}`;
      await redisClient.addEventToBatch(batchKey, {
        ...eventData,
        id: uuidv4(),
        createdAt: new Date(),
      });

      // Increment real-time counters
      const today = format(new Date(), 'yyyy-MM-dd');
      await redisClient.incrementCounter(`analytics:events:${today}`);
      
      if (eventData.courseId) {
        await redisClient.incrementCounter(`analytics:course:${eventData.courseId}:${today}`);
      }

      if (eventData.userId) {
        await redisClient.incrementCounter(`analytics:user:${eventData.userId}:${today}`);
      }

    } catch (error) {
      console.error('Error tracking event:', error);
      throw error;
    }
  }

  // Process batched events (called by scheduled job)
  async processBatchedEvents(): Promise<void> {
    try {
      const currentHour = format(new Date(), 'yyyy-MM-dd-HH');
      const previousHour = format(subDays(new Date(), 0), 'yyyy-MM-dd-HH');
      
      for (const hour of [currentHour, previousHour]) {
        const batchKey = `events:batch:${hour}`;
        const events = await redisClient.getEventBatch(batchKey, 1000);
        
        if (events.length > 0) {
          // Insert events into database
          await db.insert(userEvents).values(
            events.map(event => ({
              ...event,
              properties: event.properties ? JSON.stringify(event.properties) : null,
            }))
          );

          console.log(`Processed ${events.length} events for hour ${hour}`);
        }
      }
    } catch (error) {
      console.error('Error processing batched events:', error);
      throw error;
    }
  }

  // Get course analytics
  async getCourseAnalytics(courseId: string, days: number = 30): Promise<any> {
    try {
      const cacheKey = `analytics:course:${courseId}:${days}d`;
      const cached = await redisClient.getCachedAnalyticsData(cacheKey);
      
      if (cached) {
        return cached;
      }

      const startDate = subDays(new Date(), days);
      
      // Get course analytics from database
      const [analytics] = await db
        .select()
        .from(courseAnalytics)
        .where(eq(courseAnalytics.courseId, courseId));

      // Get recent events for this course
      const events = await db
        .select({
          eventType: userEvents.eventType,
          eventName: userEvents.eventName,
          createdAt: userEvents.createdAt,
        })
        .from(userEvents)
        .where(
          and(
            eq(userEvents.courseId, courseId),
            gte(userEvents.createdAt, startDate)
          )
        )
        .orderBy(desc(userEvents.createdAt));

      // Calculate metrics
      const eventsByType = events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get user progress for this course
      const progressData = await db
        .select({
          userId: userProgress.userId,
          completionPercentage: userProgress.completionPercentage,
          totalTimeSpent: userProgress.totalTimeSpent,
          isCompleted: userProgress.isCompleted,
        })
        .from(userProgress)
        .where(eq(userProgress.courseId, courseId));

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
      await redisClient.cacheAnalyticsData(cacheKey, result, 3600);

      return result;
    } catch (error) {
      console.error('Error getting course analytics:', error);
      throw error;
    }
  }

  // Get user progress analytics
  async getUserProgress(userId: string, courseId?: string): Promise<any> {
    try {
      const cacheKey = `analytics:user:${userId}:progress${courseId ? `:${courseId}` : ''}`;
      const cached = await redisClient.getCachedAnalyticsData(cacheKey);
      
      if (cached) {
        return cached;
      }

      let query = db.select().from(userProgress).where(eq(userProgress.userId, userId));
      
      if (courseId) {
        query = query.where(eq(userProgress.courseId, courseId));
      }

      const progress = await query;

      // Get recent events for this user
      const events = await db
        .select({
          eventType: userEvents.eventType,
          eventName: userEvents.eventName,
          courseId: userEvents.courseId,
          createdAt: userEvents.createdAt,
        })
        .from(userEvents)
        .where(
          and(
            eq(userEvents.userId, userId),
            courseId ? eq(userEvents.courseId, courseId) : sql`true`,
            gte(userEvents.createdAt, subDays(new Date(), 30))
          )
        )
        .orderBy(desc(userEvents.createdAt))
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
      await redisClient.cacheAnalyticsData(cacheKey, result, 1800);

      return result;
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  // Get dashboard analytics
  async getDashboardAnalytics(days: number = 7): Promise<any> {
    try {
      const cacheKey = `analytics:dashboard:${days}d`;
      const cached = await redisClient.getCachedAnalyticsData(cacheKey);
      
      if (cached) {
        return cached;
      }

      const startDate = subDays(new Date(), days);

      // Get daily analytics for the period
      const dailyData = await db
        .select()
        .from(dailyAnalytics)
        .where(gte(dailyAnalytics.date, startDate))
        .orderBy(desc(dailyAnalytics.date));

      // Get recent events summary
      const eventSummary = await db
        .select({
          eventType: userEvents.eventType,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(userEvents)
        .where(gte(userEvents.createdAt, startDate))
        .groupBy(userEvents.eventType);

      // Get top courses by engagement
      const topCourses = await db
        .select({
          courseId: userEvents.courseId,
          views: sql<number>`count(*)`.as('views'),
        })
        .from(userEvents)
        .where(
          and(
            gte(userEvents.createdAt, startDate),
            eq(userEvents.eventType, 'course_view')
          )
        )
        .groupBy(userEvents.courseId)
        .orderBy(desc(sql`count(*)`))
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
      await redisClient.cacheAnalyticsData(cacheKey, result, 900);

      return result;
    } catch (error) {
      console.error('Error getting dashboard analytics:', error);
      throw error;
    }
  }

  // Update user progress
  async updateUserProgress(
    userId: string,
    courseId: string,
    data: {
      lessonsCompleted?: number;
      totalLessons?: number;
      timeSpent?: number;
      isCompleted?: boolean;
    }
  ): Promise<void> {
    try {
      const completionPercentage = data.totalLessons && data.lessonsCompleted
        ? ((data.lessonsCompleted / data.totalLessons) * 100).toFixed(2)
        : undefined;

      // Check if progress record exists
      const [existing] = await db
        .select()
        .from(userProgress)
        .where(
          and(
            eq(userProgress.userId, userId),
            eq(userProgress.courseId, courseId)
          )
        );

      if (existing) {
        // Update existing record
        await db
          .update(userProgress)
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
          .where(
            and(
              eq(userProgress.userId, userId),
              eq(userProgress.courseId, courseId)
            )
          );
      } else {
        // Create new record
        await db.insert(userProgress).values({
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
      await redisClient.getClient().del(`analytics:user:${userId}:progress:${courseId}`);
      
    } catch (error) {
      console.error('Error updating user progress:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
