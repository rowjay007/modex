import { z } from 'zod';

export const ChannelEnum = z.enum(['email', 'sms', 'push', 'in_app']);
export type Channel = z.infer<typeof ChannelEnum>;

export const StatusEnum = z.enum(['pending', 'sent', 'delivered', 'failed']);
export type Status = z.infer<typeof StatusEnum>;

export const PriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export type Priority = z.infer<typeof PriorityEnum>;

export const CreateTemplateDTO = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  channel: ChannelEnum,
  subject: z.string().max(255).optional(),
  content: z.string(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  novuTemplateId: z.string().optional()
});
export type CreateTemplateDTO = z.infer<typeof CreateTemplateDTO>;

export const UpdateTemplateDTO = CreateTemplateDTO.partial();
export type UpdateTemplateDTO = z.infer<typeof UpdateTemplateDTO>;

export const SendNotificationDTO = z.object({
  recipientId: z.number(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  recipientDeviceToken: z.string().optional(),
  templateId: z.number().optional(),
  novuTemplateId: z.string().optional(),
  channel: ChannelEnum,
  subject: z.string().max(255).optional(),
  content: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
  priority: PriorityEnum.default('medium')
});
export type SendNotificationDTO = z.infer<typeof SendNotificationDTO>;

export const UpdateNotificationStatusDTO = z.object({
  status: StatusEnum,
  errorMessage: z.string().optional(),
  externalId: z.string().optional()
});
export type UpdateNotificationStatusDTO = z.infer<typeof UpdateNotificationStatusDTO>;

export const NotificationSettingsDTO = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  marketingEnabled: z.boolean().optional(),
  digestFrequency: z.enum(['realtime', 'daily', 'weekly', 'never']).optional(),
  preferences: z.record(z.string(), z.any()).optional()
});
export type NotificationSettingsDTO = z.infer<typeof NotificationSettingsDTO>;

export interface Template {
  id: number;
  name: string;
  description: string | null;
  channel: Channel;
  subject: string | null;
  content: string;
  variables: string[] | null;
  isActive: boolean;
  novuTemplateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: number;
  recipientId: number;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientDeviceToken: string | null;
  templateId: number | null;
  channel: Channel;
  subject: string | null;
  content: string;
  data: Record<string, any> | null;
  status: Status;
  priority: Priority;
  externalId: string | null;
  isRead: boolean;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Database notification type that may have nullable fields
export interface DbNotification extends Omit<Notification, 'isRead'> {
  isRead: boolean | null;
}

export interface NotificationSettings {
  id: number;
  userId: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  marketingEnabled: boolean;
  digestFrequency: string;
  novuSubscriberId: string | null;
  preferences: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}