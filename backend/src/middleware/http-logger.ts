import type { Request } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

const HEALTH_PATH = "/api/v1/health";
/** Free-text query parameters can contain names or ticket text, so their values never reach the log. */
const REDACTED_QUERY_PARAMS = ["q"];

export function loggableUrl(url: string): string {
  const start = url.indexOf("?");
  if (start === -1) return url;
  const params = new URLSearchParams(url.slice(start + 1));
  const sensitive = REDACTED_QUERY_PARAMS.filter((name) => params.has(name));
  if (sensitive.length === 0) return url;
  for (const name of sensitive) params.set(name, "redacted");
  return `${url.slice(0, start)}?${params.toString()}`;
}

/**
 * One log line per request: id, method, URL, status and timing only. Headers,
 * IPs, user agents and bodies are deliberately not logged, and search text in
 * the URL is redacted (.agent/THREAT_MODEL.md T-14).
 * Health checks are skipped to keep platform probes out of the log.
 */
export function httpLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req) => (req as Request).requestId,
    autoLogging: { ignore: (req) => req.url === HEALTH_PATH },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: loggableUrl(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
