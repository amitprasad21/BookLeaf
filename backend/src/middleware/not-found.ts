import type { RequestHandler } from "express";
import { NotFoundError } from "../lib/errors.js";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};
