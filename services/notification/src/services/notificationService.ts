import { eq } from "drizzle-orm";
import { db } from "../config/database";
import { notifications } from "../models/schema";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
// Use any type for db to fix Drizzle TypeScript errors
const typedDb = db as any;
// Import template service functions directly to avoid module resolution issues
import { redis } from "../config/redis";
import { Notification } from "../models/notificationModel";
import { novuService } from "../utils/novuIntegration";
import {
  createTemplate,
  deleteTemplate,
  getAllTemplates,
  getTemplateById,
  updateTemplate,
} from "./templateService";

const templateService = {
  getById: getTemplateById,
  create: createTemplate,
  update: updateTemplate,
  getAll: getAllTemplates,
  delete: deleteTemplate,
};

// Type for Novu payload to avoid type errors
type NovuPayload = any;

export async function initializeNotificationService(): Promise<void> {
  try {
    // Initialize Novu service
    await novuService.initialize();

    logger.info("Notification service initialized");
  } catch (error: any) {
    logger.error("Failed to initialize notification service", { error });
    // Use error directly since we've typed it as any
    throw new AppError(
      500,
      `Failed to initialize service: ${error.message || "Unknown error"}`
    );
  }
}

export async function sendNotification(
  notificationData: any
): Promise<Notification> {
  try {
    let content = notificationData.content || "";
    let subject = notificationData.subject || "";
    let novuTemplateId: string | undefined = undefined;

    // If templateId is provided, fetch and compile template
    if (notificationData.templateId) {
      const template = await templateService.getById(
        notificationData.templateId
      );

      if (!template) {
        throw new AppError(404, "Template not found");
      }

      if (!template.isActive) {
        throw new AppError(400, "Template is inactive");
      }

      if (template.channel !== notificationData.channel) {
        throw new AppError(
          400,
          `Template channel (${template.channel}) does not match requested channel (${notificationData.channel})`
        );
      }

      // If this template has a novuTemplateId, use that instead of content
      if (template.variables?.includes("novuTemplateId")) {
        novuTemplateId = template.name; // Using template name as Novu template ID
      } else {
        content = template.content;
        subject = template.subject || subject;
      }
    } else if (!content) {
      throw new AppError(400, "Either templateId or content must be provided");
    }

    // Create notification record
    const [notification] = await typedDb
      .insert(notifications)
      .values({
        recipientId: notificationData.recipientId,
        recipientEmail: notificationData.recipientEmail,
        recipientPhone: notificationData.recipientPhone,
        recipientDeviceToken: notificationData.recipientDeviceToken,
        templateId: notificationData.templateId || null,
        channel: notificationData.channel,
        subject,
        content,
        data: notificationData.data || null,
        priority: notificationData.priority || "medium",
        status: "pending",
        isRead: false,
      })
      .returning();

    // Process notification using Novu
    await processNotificationWithNovu(
      notification,
      novuTemplateId,
      notificationData.data || {}
    );

    // Ensure the returned notification conforms to the Notification interface
    const typedNotification: Notification = {
      ...notification,
      isRead: notification.isRead === null ? false : notification.isRead,
      data: notification.data || null,
      externalId: notification.externalId || null,
      recipientEmail: notification.recipientEmail || null,
      recipientPhone: notification.recipientPhone || null,
      recipientDeviceToken: notification.recipientDeviceToken || null,
      templateId: notification.templateId || null,
      subject: notification.subject || null,
      sentAt: notification.sentAt || null,
      deliveredAt: notification.deliveredAt || null,
      failedAt: notification.failedAt || null,
      errorMessage: notification.errorMessage || null,
    };

    return typedNotification;
  } catch (error: any) {
    logger.error("Failed to send notification", { notificationData, error });
    if (error instanceof AppError) {
      throw error;
    }
    // Use error directly since we've typed it as any
    throw new AppError(
      500,
      `Failed to send notification: ${error.message || "Unknown error"}`
    );
  }
}

async function processNotificationWithNovu(
  notification: any,
  novuTemplateId?: string,
  payload?: any
): Promise<void> {
  try {
    // Create or update subscriber in Novu if needed
    const subscriberId = notification.recipientId.toString();

    // Prepare the subscriber data
    const subscriberData: {
      subscriberId: string;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
    } = { subscriberId };

    if (notification.recipientEmail) {
      subscriberData.email = notification.recipientEmail;
    }

    if (notification.recipientPhone) {
      subscriberData.phone = notification.recipientPhone;
    }

    // For existing subscribers, this will update their information
    // For new subscribers, it will create them
    await novuService.createSubscriber(subscriberData);

    // Determine which event name to use based on the notification properties
    const eventName =
      novuTemplateId ||
      `${notification.channel}_notification_${notification.priority}`;

    // Prepare payload with all notification data
    // Use any for payload to avoid type issues
    const eventPayload: NovuPayload = {
      subject: notification.subject !== null ? notification.subject : undefined,
      content: notification.content,
      priority: notification.priority,
      data: notification.data !== null ? notification.data : undefined,
    };

    // Prepare overrides based on notification channel
    const overrides: any = {};

    // Channel-specific overrides
    switch (notification.channel) {
      case "email":
        overrides.email = {
          subject: notification.subject,
          htmlContent: notification.content,
        };
        break;

      case "sms":
        overrides.sms = {
          content: notification.content,
        };
        break;

      case "push":
        overrides.push = {
          title: notification.subject,
          content: notification.content,
          data: notification.data,
        };
        break;

      case "in_app":
        overrides.in_app = {
          title: notification.subject,
          content: notification.content,
          data: notification.data,
        };

        // Store in-app notification in Redis for faster access
        const inAppKey = `in_app:${notification.recipientId}`;
        await redis.lpush(
          inAppKey,
          JSON.stringify({
            id: notification.id,
            subject: notification.subject,
            content: notification.content,
            data: notification.data,
            priority: notification.priority,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
          })
        );
        // Trim the list to keep only the latest 100 notifications per user
        await redis.ltrim(inAppKey, 0, 99);
        break;

      default:
        throw new AppError(
          400,
          `Unsupported notification channel: ${notification.channel}`
        );
    }

    // Send notification via Novu
    const result = await novuService.triggerEvent({
      name: eventName,
      to: { subscriberId },
      payload: eventPayload,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });

    // Update notification status to sent
    if (result) {
      await updateNotificationStatus(
        notification.id,
        "sent",
        undefined,
        typeof result === "object" && result.transactionId
          ? result.transactionId
          : undefined
      );
    } else {
      await updateNotificationStatus(
        notification.id,
        "failed",
        "Failed to send notification via Novu"
      );
    }
  } catch (error: any) {
    logger.error("Failed to process notification with Novu", {
      notification,
      error,
    });

    const errorMessage =
      error instanceof Error ? error.message : "Failed to process notification";

    await updateNotificationStatus(notification.id, "failed", errorMessage);

    if (error instanceof AppError) {
      throw error;
    }
    // Use error directly since we've typed it as any
    throw new AppError(
      500,
      `Failed to process notification with Novu: ${
        error.message || "Unknown error"
      }`
    );
  }
}

export async function updateNotificationStatus(
  id: number,
  status: "pending" | "sent" | "delivered" | "failed",
  errorMessage?: string,
  externalId?: string
): Promise<Notification> {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "sent") {
      updateData.sentAt = new Date();
      if (externalId) {
        updateData.externalId = externalId;
      }
    } else if (status === "delivered") {
      updateData.deliveredAt = new Date();
    } else if (status === "failed") {
      updateData.failedAt = new Date();
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    const markNotificationsAsRead = async (item: any): Promise<any> => {
      if (item.id && !item.isRead) {
        await typedDb
          .update(notifications)
          .set({ isRead: true })
          .where(eq(notifications.id, item.id));
      }
      return item;
    };

    const [updatedNotification] = await typedDb
      .update(notifications)
      .set(updateData)
      .where(eq(notifications.id, id))
      .returning();

    // Ensure the returned notification conforms to the Notification interface
    const typedNotification: Notification = {
      ...updatedNotification,
      isRead:
        updatedNotification.isRead === null
          ? false
          : updatedNotification.isRead,
      data: updatedNotification.data || null,
      externalId: updatedNotification.externalId || null,
      recipientEmail: updatedNotification.recipientEmail || null,
      recipientPhone: updatedNotification.recipientPhone || null,
      recipientDeviceToken: updatedNotification.recipientDeviceToken || null,
      templateId: updatedNotification.templateId || null,
      subject: updatedNotification.subject || null,
      sentAt: updatedNotification.sentAt || null,
      deliveredAt: updatedNotification.deliveredAt || null,
      failedAt: updatedNotification.failedAt || null,
      errorMessage: updatedNotification.errorMessage || null,
    };

    return typedNotification;
  } catch (error: any) {
    logger.error("Failed to update notification status", { id, status, error });
    // Use error directly since we've typed it as any
    throw new AppError(
      500,
      `Failed to update notification status: ${
        error.message || "Unknown error"
      }`
    );
  }
}

export async function getNotificationById(id: number): Promise<any> {
  try {
    const notification = await typedDb.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });

    return notification || null;
  } catch (error: any) {
    logger.error("Failed to get notification", { id, error });
    // Use error directly since we've typed it as any
    throw new AppError(
      500,
      `Failed to get notification: ${error.message || "Unknown error"}`
    );
  }
}

export async function getNotificationsByRecipientId(
  recipientId: number,
  options: any = {}
): Promise<any[]> {
  try {
    const { limit = 20, offset = 0 } = options;

    const notificationList = await typedDb.query.notifications.findMany({
      where: eq(notifications.recipientId, recipientId),
      orderBy: (notificationsTable: any, { desc }: { desc: any }) => [
        desc(notificationsTable.createdAt),
      ],
      limit,
      offset,
    });

    return notificationList;
  } catch (error: any) {
    logger.error("Failed to get notifications", {
      recipientId,
      options,
      error,
    });
    // Use error directly since we've typed it as any
    throw new AppError(
      500,
      `Failed to get notifications: ${error.message || "Unknown error"}`
    );
  }
}

export async function getInAppNotifications(
  userId: number,
  options: any = {}
): Promise<any[]> {
  try {
    const { limit = 20, markAsRead = false } = options;
    const inAppKey = `inapp:user:${userId}`;

    // Get notifications from Redis
    const notifications = await redis.lrange(inAppKey, 0, limit - 1);

    const formatNotification = (n: any): any => ({
      id: n.id,
      title: n.subject,
      message: n.content,
      data: n.data,
      isRead: n.isRead,
      createdAt: n.createdAt,
    });

    const sortNotifications = (a: any, b: any): number => {
      // Sort first by read status (unread first)
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }

      // Then by priority
      const priorityValues = {
        critical: 3,
        high: 2,
        medium: 1,
        low: 0,
      };

      const aPriority =
        priorityValues[a.priority as keyof typeof priorityValues] || 0;
      const bPriority =
        priorityValues[b.priority as keyof typeof priorityValues] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Finally by date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    const parsedNotifications = notifications.map((item: string) =>
      JSON.parse(item)
    );

    // Mark as read if requested
    if (markAsRead && parsedNotifications.length > 0) {
      const notificationIds = parsedNotifications.map((n: any) => n.id);

      // Update status to 'delivered' for all retrieved notifications
      await Promise.all(
        notificationIds.map((id: number) =>
          updateNotificationStatus(id, "delivered")
        )
      );
    }

    // Cast the sort function to any to fix TypeScript error
    return parsedNotifications
      .map(formatNotification)
      .sort((a: any, b: any) => sortNotifications(a, b) as any);
  } catch (error: any) {
    logger.error("Failed to get in-app notifications", {
      userId,
      options,
      error,
    });
    // Use error directly since we've typed it as any
    throw new AppError(
      500,
      `Failed to get in-app notifications: ${error.message || "Unknown error"}`
    );
  }
}

export const notificationService = {
  initialize: initializeNotificationService,
  send: sendNotification,
  updateStatus: updateNotificationStatus,
  getById: getNotificationById,
  getByRecipientId: getNotificationsByRecipientId,
  getInAppNotifications,
};
