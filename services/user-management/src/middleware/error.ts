import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    logger.error(err.message);
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.error(err.errors);
    res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: err.errors
    });
    return;
  }

  logger.error(err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
};