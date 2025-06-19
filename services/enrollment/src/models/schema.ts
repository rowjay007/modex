import {
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 256 }),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }),
});

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "enrolled",
  "completed",
  "withdrawn",
]);

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  status: enrollmentStatusEnum("status").default("enrolled").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
