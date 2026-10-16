import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

// The repository-root openapi.yaml is the single source of truth for the
// contract. src/openapi and dist/openapi sit at the same depth, so this
// relative path works for both tsx (dev) and the compiled build.
export const OPENAPI_SPEC_PATH = fileURLToPath(new URL("../../../openapi.yaml", import.meta.url));

/** Serves the raw contract at /openapi.yaml and Swagger UI at /docs. */
export function docsRouter(specPath = OPENAPI_SPEC_PATH): Router {
  const raw = readFileSync(specPath, "utf8");
  const spec = parse(raw) as Record<string, unknown>;

  const router = Router();
  router.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").send(raw);
  });
  router.use("/docs", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "BookLeaf API" }));
  return router;
}
