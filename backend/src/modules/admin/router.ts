import { Router } from "express";

// /api/v1/admin/* (role admin, enforced in app.ts). Queue and ticket
// management routes arrive in API-5 onwards.
export const adminRouter = Router();
