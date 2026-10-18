import type { Role } from "@bookleaf/shared";
import type { RequestHandler } from "express";
import { ForbiddenError, UnauthenticatedError } from "../lib/errors.js";

/** Namespace guard: /author/* needs role author, /admin/* needs role admin (403 otherwise). */
export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new UnauthenticatedError());
    } else if (req.auth.role !== role) {
      next(new ForbiddenError());
    } else {
      next();
    }
  };
}
