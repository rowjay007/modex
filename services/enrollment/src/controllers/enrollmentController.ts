import { Request, Response, NextFunction } from 'express';
import { enrollmentService } from '../services/enrollmentService';
import catchAsync from '../utils/catchAsync';
import AppError from '../utils/appError';

class EnrollmentController {
    public createEnrollment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const enrollment = await enrollmentService.createEnrollment(req.body);
    res.status(201).json({
      status: 'success',
      data: { enrollment },
    });
  });

    public getEnrollmentById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    const enrollment = await enrollmentService.getEnrollmentById(id);

    if (!enrollment) {
      return next(new AppError('No enrollment found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { enrollment },
    });
  });

    public getEnrollmentsByUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = parseInt(req.params.userId, 10);
    const enrollments = await enrollmentService.getEnrollmentsByUser(userId);

    res.status(200).json({
      status: 'success',
      results: enrollments.length,
      data: { enrollments },
    });
  });

    public updateEnrollmentStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    const updatedEnrollment = await enrollmentService.updateEnrollmentStatus(id, status);

    if (!updatedEnrollment) {
      return next(new AppError('No enrollment found with that ID to update', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { enrollment: updatedEnrollment },
    });
  });

    public deleteEnrollment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    await enrollmentService.deleteEnrollment(id);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });
}

export const enrollmentController = new EnrollmentController();

