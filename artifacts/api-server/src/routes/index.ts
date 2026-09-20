import { Router, type IRouter } from "express";
import healthRouter from "./health";
import evaluateRouter from "./evaluate";
import portalRouter from "./portal";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(evaluateRouter);
router.use(portalRouter);
router.use(storageRouter);

export default router;
