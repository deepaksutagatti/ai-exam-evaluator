import {
  Router,
  raw,
  type IRouter,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import {
  readObject,
  requestObjectUpload,
  saveUploadedObject,
} from "../lib/storage";

const router: IRouter = Router();
const UploadRequest = z.object({
  name: z.string().min(1),
  size: z.number().int().positive().max(30_000_000),
  contentType: z.string().min(1),
});

router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UploadRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid upload metadata." });
      return;
    }
    try {
      const upload = await requestObjectUpload();
      res.json({ ...upload, metadata: parsed.data });
    } catch (error) {
      req.log.error({ err: error }, "Failed to create upload URL");
      res.status(500).json({ error: "Could not prepare the file upload." });
    }
  },
);

router.put(
  "/storage/uploads/:uploadId",
  requireAuth,
  raw({ type: "*/*", limit: "30mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const uploadId = req.params.uploadId;
    if (Array.isArray(uploadId) || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
      res.status(400).json({ error: "Invalid upload identifier." });
      return;
    }
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: "The uploaded file body is missing." });
      return;
    }
    try {
      const contentType =
        typeof req.headers["content-type"] === "string"
          ? req.headers["content-type"].split(";")[0]
          : "application/pdf";
      await saveUploadedObject(uploadId, req.body, contentType);
      res.status(201).json({ ok: true });
    } catch (error) {
      req.log.error({ err: error }, "Failed to save uploaded object");
      res.status(400).json({ error: "Could not save the uploaded file." });
    }
  },
);

router.get(
  "/storage/objects/*path",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const raw = req.params.path;
    const path = Array.isArray(raw) ? raw.join("/") : raw;
    try {
      const bytes = await readObject(`/objects/${path}`);
      res.setHeader("Cache-Control", "private, no-store");
      res.type("application/pdf").send(bytes);
    } catch (error) {
      if (error instanceof Error && error.name === "ObjectNotFoundError") {
        res.status(404).json({ error: "Object not found." });
        return;
      }
      req.log.error({ err: error }, "Failed to serve object");
      res.status(500).json({ error: "Could not serve the document." });
    }
  },
);

export default router;