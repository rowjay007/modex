import { db } from '../db';
import { pgTable, serial, timestamp, varchar, integer, jsonb } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export class AuditService {
  async log(params: {
    userId: number;
    action: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId: params.userId,
        action: params.action,
        details: params.details,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw error to prevent disrupting the main flow
    }
  }

  async getUserAuditLogs(userId: number): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(auditLogs.createdAt);
  }
}

export const auditService = new AuditService();
