"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollmentService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const database_1 = require("../config/database");
const schema_1 = require("../models/schema");
const drizzle_orm_1 = require("drizzle-orm");
class EnrollmentService {
    /**
     * Creates a new enrollment record in the database.
     * @param data - The data for the new enrollment (userId, courseId).
     * @returns The newly created enrollment record.
     */
    async createEnrollment(data) {
        logger_1.default.info({ data }, 'Service: Creating enrollment');
        const [newEnrollment] = await database_1.db.insert(schema_1.enrollments).values(data).returning();
        return newEnrollment;
    }
    /**
     * Retrieves a single enrollment by its ID.
     * @param id - The ID of the enrollment to retrieve.
     * @returns The enrollment record, or undefined if not found.
     */
    async getEnrollmentById(id) {
        logger_1.default.info({ id }, 'Service: Getting enrollment by ID');
        const [enrollment] = await database_1.db.select().from(schema_1.enrollments).where((0, drizzle_orm_1.eq)(schema_1.enrollments.id, id));
        return enrollment;
    }
    /**
     * Retrieves all enrollments for a specific user.
     * @param userId - The ID of the user.
     * @returns An array of enrollment records.
     */
    async getEnrollmentsByUser(userId) {
        logger_1.default.info({ userId }, 'Service: Getting enrollments for user');
        return database_1.db.select().from(schema_1.enrollments).where((0, drizzle_orm_1.eq)(schema_1.enrollments.userId, userId));
    }
    /**
     * Updates the status of an existing enrollment.
     * @param id - The ID of the enrollment to update.
     * @param status - The new status for the enrollment.
     * @returns The updated enrollment record, or undefined if not found.
     */
    async updateEnrollmentStatus(id, status) {
        logger_1.default.info({ id, status }, 'Service: Updating enrollment status');
        const [updatedEnrollment] = await database_1.db
            .update(schema_1.enrollments)
            .set({ status, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.enrollments.id, id))
            .returning();
        return updatedEnrollment;
    }
    /**
     * Deletes an enrollment from the database.
     * @param id - The ID of the enrollment to delete.
     * @returns The deleted enrollment record.
     */
    async deleteEnrollment(id) {
        logger_1.default.info({ id }, 'Service: Deleting enrollment');
        const [deletedEnrollment] = await database_1.db.delete(schema_1.enrollments).where((0, drizzle_orm_1.eq)(schema_1.enrollments.id, id)).returning();
        return deletedEnrollment;
    }
}
exports.enrollmentService = new EnrollmentService();
