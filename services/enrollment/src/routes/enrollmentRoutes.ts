import { Router } from 'express';
import { enrollmentController } from '../controllers/enrollmentController';

const router = Router();

router.post('/', enrollmentController.createEnrollment);

router.get('/:id', enrollmentController.getEnrollmentById);

router.get('/user/:userId', enrollmentController.getEnrollmentsByUser);

router.patch('/:id/status', enrollmentController.updateEnrollmentStatus);

router.delete('/:id', enrollmentController.deleteEnrollment);

export default router;

