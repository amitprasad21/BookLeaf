declare global {
  namespace Express {
    interface Request {
      /** Set by middleware/request-id.ts; echoed in X-Request-Id and every error body. */
      requestId: string;
    }
  }
}

export {};
