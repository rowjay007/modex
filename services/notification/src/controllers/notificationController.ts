import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { notificationService } from '../services/notificationService';
import { SendNotificationDTO, UpdateNotificationStatusDTO } from '../models/notificationModel';

export const sendNotification = catchAsync(async (req: Request, res: Response) => {
  const notificationData = SendNotificationDTO.parse(req.body);
  const notification = await notificationService.send(notificationData);
  
  res.status(201).json({
    status: 'success',
    data: notification
  });
});

export const getNotification = catchAsync(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const notification = await notificationService.getById(id);
  
  if (!notification) {
    res.status(404).json({
      status: 'error',
      message: 'Notification not found'
    });
    return;
  }
  
  res.json({
    status: 'success',
    data: notification
  });
});

export const updateNotificationStatus = catchAsync(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const statusData = UpdateNotificationStatusDTO.parse(req.body);
  
  const notification = await notificationService.updateStatus(
    id, 
    statusData.status, 
    statusData.errorMessage
  );
  
  res.json({
    status: 'success',
    data: notification
  });
});

export const getUserNotifications = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
  
  const notifications = await notificationService.getByRecipientId(userId, { limit, offset });
  
  res.json({
    status: 'success',
    results: notifications.length,
    data: notifications
  });
});

export const getInAppNotifications = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const markAsRead = req.query.markAsRead === 'true';
  
  const notifications = await notificationService.getInAppNotifications(userId, { 
    limit, 
    markAsRead 
  });
  
  res.json({
    status: 'success',
    results: notifications.length,
    data: notifications
  });
});

export const notificationController = {
  sendNotification,
  getNotification,
  updateNotificationStatus,
  getUserNotifications,
  getInAppNotifications
};