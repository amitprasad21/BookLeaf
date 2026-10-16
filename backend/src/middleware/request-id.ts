import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Accept a caller-supplied id only if it is short and log-safe; otherwise mint one.
const SAFE_INCOMING_ID = /^[A-Za-z0-9._:-]{8,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get("x-request-id");
  req.requestId = incoming && SAFE_INCOMING_ID.test(incoming) ? incoming : `req_${randomUUID()}`;
  res.setHeader("X-Request-Id", req.requestId);
  next();
};
