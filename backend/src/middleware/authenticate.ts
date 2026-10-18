import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request, RequestHandler } from "express";
import type { AuthContext, AuthVerifier } from "../auth/types.js";
import { ForbiddenError, UnauthenticatedError } from "../lib/errors.js";

// JWTs are three base64url segments; anything else is rejected before any network call.
const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
const MAX_TOKEN_LENGTH = 4096;

/** Verifies the bearer token and attaches req.auth and req.db. Identity never comes from the body or query. */
export function authenticate(verifier: AuthVerifier): RequestHandler {
  return async (req, _res, next) => {
    const token = req.get("authorization")?.match(BEARER)?.[1];
    if (!token || token.length > MAX_TOKEN_LENGTH) {
      next(new UnauthenticatedError());
      return;
    }
    const verified = await verifier.verify(token);
    if (!verified) {
      next(new UnauthenticatedError("Your session has expired or is invalid. Please sign in again."));
      return;
    }
    req.auth = verified.auth;
    req.db = verified.db;
    next();
  };
}

/** For handlers behind authenticate(): the caller's identity, or 401 if somehow missing. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
}

/** The caller's RLS-scoped database client. */
export function dbOf(req: Request): SupabaseClient {
  if (!req.db) throw new UnauthenticatedError();
  return req.db;
}

/** The caller's author id. Authors always have one (profiles check constraint); anyone else gets 403. */
export function authorIdOf(req: Request): string {
  const author = authOf(req).author;
  if (!author) throw new ForbiddenError();
  return author.authorId;
}
