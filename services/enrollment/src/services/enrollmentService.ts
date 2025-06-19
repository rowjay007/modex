import logger from '../utils/logger';
import { db } from '../config/database';
import { enrollments, enrollmentStatusEnum } from '../models/schema';
import { eq, InferInsertModel, InferSelectModel } from 'drizzle-orm';

// Define types for insertion and selection to ensure type safety
type NewEnrollment = InferInsertModel<typeof enrollments>;
type Enrollment = InferSelectModel<typeof enrollments>;

class EnrollmentService {
  /**
   * Creates a new enrollment record in the database.
   * @param data - The data for the new enrollment (userId, courseId).
   * @returns The newly created enrollment record.
   */
    public async createEnrollment(data: { userId: number; courseId: number }): Promise<Enrollment> {
    logger.info({ data }, 'Service: Creating enrollment');
    const [newEnrollment] = await db.insert(enrollments).values(data).returning();
    return newEnrollment;
  }

  /**
   * Retrieves a single enrollment by its ID.
   * @param id - The ID of the enrollment to retrieve.
   * @returns The enrollment record, or undefined if not found.
   */
  public async getEnrollmentById(id: number): Promise<Enrollment | undefined> {
    logger.info({ id }, 'Service: Getting enrollment by ID');
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.id, id));
    return enrollment;
  }

  /**
   * Retrieves all enrollments for a specific user.
   * @param userId - The ID of the user.
   * @returns An array of enrollment records.
   */
  public async getEnrollmentsByUser(userId: number): Promise<Enrollment[]> {
    logger.info({ userId }, 'Service: Getting enrollments for user');
    return db.select().from(enrollments).where(eq(enrollments.userId, userId));
  }

  /**
   * Updates the status of an existing enrollment.
   * @param id - The ID of the enrollment to update.
   * @param status - The new status for the enrollment.
   * @returns The updated enrollment record, or undefined if not found.
   */
    public async updateEnrollmentStatus(id: number, status: typeof enrollmentStatusEnum.enumValues[number]): Promise<Enrollment | undefined> {
    logger.info({ id, status }, 'Service: Updating enrollment status');
    const [updatedEnrollment] = await db
      .update(enrollments)
      .set({ status, updatedAt: new Date() })
      .where(eq(enrollments.id, id))
      .returning();
    return updatedEnrollment;
  }

  /**
   * Deletes an enrollment from the database.
   * @param id - The ID of the enrollment to delete.
   * @returns The deleted enrollment record.
   */
  public async deleteEnrollment(id: number): Promise<Enrollment | undefined> {
    logger.info({ id }, 'Service: Deleting enrollment');
    const [deletedEnrollment] = await db.delete(enrollments).where(eq(enrollments.id, id)).returning();
    return deletedEnrollment;
  }
}

export const enrollmentService = new EnrollmentService();
