import { Router } from "express";
import { APP_VERSION } from "../../version.js";

// operationId: getHealth
export const healthRouter = Router().get("/", (_req, res) => {
  res.json({ data: { status: "ok", version: APP_VERSION } });
});
