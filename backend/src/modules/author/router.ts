import { Router } from "express";

// /api/v1/author/* (role author, enforced in app.ts). Books and tickets
// routes arrive in API-3 and API-4.
export const authorRouter = Router();
