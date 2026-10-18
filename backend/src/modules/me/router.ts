import { Router } from "express";
import type { AuthContext } from "../../auth/types.js";
import { authOf } from "../../middleware/authenticate.js";

/** Me DTO (openapi.yaml components/schemas/Me). Everything comes from the verified auth context. */
export function toMeDto(auth: AuthContext) {
  return {
    userId: auth.userId,
    role: auth.role,
    displayName: auth.displayName,
    author: auth.author,
  };
}

// operationId: getMe
export const meRouter = Router().get("/", (req, res) => {
  res.json({ data: toMeDto(authOf(req)) });
});
