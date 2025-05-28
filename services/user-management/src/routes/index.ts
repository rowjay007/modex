import { Router } from 'express';
import userRoutes from './userRoutes';

const v1Router = Router();
v1Router.use('/users', userRoutes);

const apiRouter = Router();
apiRouter.use('/v1', v1Router);

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

export default apiRouter;
