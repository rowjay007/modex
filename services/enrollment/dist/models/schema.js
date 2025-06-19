"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollments = exports.enrollmentStatusEnum = exports.courses = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    fullName: (0, pg_core_1.varchar)("full_name", { length: 256 }),
});
exports.courses = (0, pg_core_1.pgTable)("courses", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    title: (0, pg_core_1.varchar)("title", { length: 256 }),
});
exports.enrollmentStatusEnum = (0, pg_core_1.pgEnum)("enrollment_status", [
    "enrolled",
    "completed",
    "withdrawn",
]);
exports.enrollments = (0, pg_core_1.pgTable)("enrollments", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    userId: (0, pg_core_1.integer)("user_id")
        .notNull()
        .references(() => exports.users.id, { onDelete: "cascade" }),
    courseId: (0, pg_core_1.integer)("course_id")
        .notNull()
        .references(() => exports.courses.id, { onDelete: "cascade" }),
    status: (0, exports.enrollmentStatusEnum)("status").default("enrolled").notNull(),
    enrolledAt: (0, pg_core_1.timestamp)("enrolled_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
