import { Hono } from "hono";
import { requireAuth } from '../../../middleware/auth.js';
import { localeMiddleware } from '../../../middleware/locale.js';
import exerciseRouter from './exercises.js';
import muscleGroupRouter from './musclegroups.js';

const exerciseInfoRouter = new Hono();

exerciseInfoRouter.use('*', requireAuth);
exerciseInfoRouter.use('*', localeMiddleware);
exerciseInfoRouter.route('/exercises', exerciseRouter);
exerciseInfoRouter.route('/muscle-groups', muscleGroupRouter);

export default exerciseInfoRouter;