import { Request, Response } from 'express';
import { analyticsService, EventData } from '../services/analyticsService';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class AnalyticsController {

  async trackEvent(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        sessionId,
        eventType,
        eventName,
        courseId,
        lessonId,
        assessmentId,
        properties
      } = req.body;

      if (!eventType || !eventName) {
        res.status(400).json({ 
          error: 'Event type and event name are required' 
        });
        return;
      }

      const eventData: EventData = {
        userId,
        sessionId,
        eventType,
        eventName,
        courseId,
        lessonId,
        assessmentId,
        properties,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection.remoteAddress,
        referrer: req.get('Referer'),
      };

      await analyticsService.trackEvent(eventData);

      res.status(201).json({
        success: true,
        message: 'Event tracked successfully',
      });
    } catch (error) {
      console.error('Error tracking event:', error);
      res.status(500).json({
        error: 'Failed to track event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCourseAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { courseId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      if (!courseId) {
        res.status(400).json({ error: 'Course ID is required' });
        return;
      }

      const analytics = await analyticsService.getCourseAnalytics(courseId, days);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Error getting course analytics:', error);
      res.status(500).json({
        error: 'Failed to get course analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getUserProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { courseId } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const progress = await analyticsService.getUserProgress(
        userId, 
        courseId as string
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      console.error('Error getting user progress:', error);
      res.status(500).json({
        error: 'Failed to get user progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getDashboardAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Check if user has admin role for full dashboard access
      if (req.user?.role !== 'admin' && req.user?.role !== 'instructor') {
        res.status(403).json({ 
          error: 'Access denied. Admin or instructor role required' 
        });
        return;
      }

      const analytics = await analyticsService.getDashboardAnalytics(days);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Error getting dashboard analytics:', error);
      res.status(500).json({
        error: 'Failed to get dashboard analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateUserProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId, courseId } = req.params;
      const { lessonsCompleted, totalLessons, timeSpent, isCompleted } = req.body;

      if (!userId || !courseId) {
        res.status(400).json({ 
          error: 'User ID and Course ID are required' 
        });
        return;
      }

      // Check if the authenticated user can update this progress
      const authenticatedUserId = req.user?.id;
      if (authenticatedUserId !== userId && req.user?.role !== 'admin') {
        res.status(403).json({ 
          error: 'Access denied. Can only update own progress' 
        });
        return;
      }

      await analyticsService.updateUserProgress(userId, courseId, {
        lessonsCompleted,
        totalLessons,
        timeSpent,
        isCompleted,
      });

      res.json({
        success: true,
        message: 'User progress updated successfully',
      });
    } catch (error) {
      console.error('Error updating user progress:', error);
      res.status(500).json({
        error: 'Failed to update user progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getMyProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { courseId } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const progress = await analyticsService.getUserProgress(
        userId, 
        courseId as string
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error) {
      console.error('Error getting my progress:', error);
      res.status(500).json({
        error: 'Failed to get progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Process batched events (internal endpoint for scheduled jobs)
  async processBatchedEvents(req: Request, res: Response): Promise<void> {
    try {
      await analyticsService.processBatchedEvents();

      res.json({
        success: true,
        message: 'Batched events processed successfully',
      });
    } catch (error) {
      console.error('Error processing batched events:', error);
      res.status(500).json({
        error: 'Failed to process batched events',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}