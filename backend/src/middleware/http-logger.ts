import type { Request } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

const HEALTH_PATH = "/api/v1/health";

/**
 * One log line per request: id, method, URL, status and timing only. Headers,
 * IPs, user agents and bodies are deliberately not logged (.agent/THREAT_MODEL.md T-14).
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
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
