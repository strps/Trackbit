import { Hono } from "hono";


const exerciseInfoRouter = new Hono();

import exerciseRouter from './exercises.js';
import muscleGroupRouter from './musclegroups.js';

exerciseInfoRouter.route('/exercises', exerciseRouter);
exerciseInfoRouter.route('/muscle-groups', muscleGroupRouter);

export default exerciseInfoRouter;