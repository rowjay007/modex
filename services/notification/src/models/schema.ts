import {
  boolean,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";

export const channelEnum = pgEnum('channel_type', [
  'email',
  'sms',
  'push',
  'in_app'
]);

export const statusEnum = pgEnum('delivery_status', [
  'pending',
  'sent',
  'delivered',
  'failed'
]);

export const priorityEnum = pgEnum('priority_level', [
  'low',
  'medium',
  'high',
  'critical'
]);

export const templates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  channel: channelEnum("channel").notNull(),
  subject: varchar("subject", { length: 255 }),
  content: text("content").notNull(),
  variables: json("variables").$type<string[]>(),
  isActive: boolean("is_active").default(true),
  novuTemplateId: varchar("novu_template_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 20 }),
  recipientDeviceToken: varchar("recipient_device_token", { length: 255 }),
  templateId: integer("template_id"),
  channel: channelEnum("channel").notNull(),
  subject: varchar("subject", { length: 255 }),
  content: text("content").notNull(),
  data: json("data").$type<Record<string, any> | null>(),
  status: statusEnum("status").default('pending').notNull(),
  priority: priorityEnum("priority").default('medium').notNull(),
  externalId: varchar("external_id", { length: 255 }),
  isRead: boolean("is_read").default(false),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  marketingEnabled: boolean("marketing_enabled").default(false).notNull(),
  digestFrequency: varchar("digest_frequency", { length: 20 }).default('never'),
  novuSubscriberId: varchar("novu_subscriber_id", { length: 100 }),
  preferences: json("preferences"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
