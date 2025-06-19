import { Router } from 'express';
import enrollmentRoutes from './enrollmentRoutes';

const router = Router();

router.use('/enrollments', enrollmentRoutes);

export default router;
