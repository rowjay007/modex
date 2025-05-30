import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { novuNotificationService } from '../services/novuNotificationService';
import { z } from 'zod';
import { ChannelEnum, PriorityEnum } from '../models/notificationModel';

const SendNovuNotificationDTO = z.object({
  channel: ChannelEnum,
  subject: z.string().max(255).optional(),
  content: z.string(),
  priority: PriorityEnum.default('medium'),
  templateId: z.string().optional(),
  payload: z.record(z.string(), z.any()).optional(),
  overrides: z.object({
    email: z.object({
      subject: z.string().optional(),
      textContent: z.string().optional(),
      htmlContent: z.string().optional(),
    }).optional(),
    sms: z.object({
      content: z.string().optional(),
    }).optional(),
    push: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      data: z.record(z.string(), z.any()).optional(),
    }).optional(),
    in_app: z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      data: z.record(z.string(), z.any()).optional(),
    }).optional(),
  }).optional(),
});

export const registerUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { email, phone, firstName, lastName } = req.body;
  
  const subscriber = await novuNotificationService.registerUser(
    userId,
    email,
    phone,
    firstName,
    lastName
  );
  
  res.status(201).json({
    status: 'success',
    data: subscriber
  });
});

export const sendNotification = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const validatedData = SendNovuNotificationDTO.parse(req.body);
  
  const result = await novuNotificationService.sendNotification(
    parseInt(userId, 10),
    validatedData.channel,
    validatedData.subject || '',
    validatedData.content,
    validatedData.priority,
    {
      templateId: validatedData.templateId,
      payload: validatedData.payload,
      overrides: validatedData.overrides
    }
  );
  
  res.status(201).json({
    status: 'success',
    data: result
  });
});

export const updatePreferences = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const preferences = req.body;
  
  const result = await novuNotificationService.updateUserPreferences(userId, preferences);
  
  res.json({
    status: 'success',
    data: result
  });
});

export const deleteUserFromNovu = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  
  await novuNotificationService.deleteUser(userId);
  
  res.status(204).send();
});

export const sendToCurrentUser = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const validatedData = SendNovuNotificationDTO.parse(req.body);
  
  const result = await novuNotificationService.sendNotification(
    userId,
    validatedData.channel,
    validatedData.subject || '',
    validatedData.content,
    validatedData.priority,
    {
      templateId: validatedData.templateId,
      payload: validatedData.payload,
      overrides: validatedData.overrides
    }
  );
  
  res.status(201).json({
    status: 'success',
    data: result
  });
});

export const novuController = {
  registerUser,
  sendNotification,
  updatePreferences,
  deleteUserFromNovu,
  sendToCurrentUser
};
