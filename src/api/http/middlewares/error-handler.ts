import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError, z } from "zod";
import { AppError } from "../../../shared/errors";

/** Body-parser failures carry a type; map the common ones to stable codes. */
const BODY_ERROR_CODES: Record<string, string> = {
  "entity.parse.failed": "INVALID_JSON",
  "entity.too.large": "PAYLOAD_TOO_LARGE",
  "encoding.unsupported": "UNSUPPORTED_ENCODING",
};

interface HttpClientError {
  status: number;
  type?: string;
  expose?: boolean;
  message: string;
}

function isHttpClientError(err: unknown): err is HttpClientError {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/** Last middleware. Known errors -> their status; validation -> 400; anything else -> logged 500. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: { code: "INVALID_INPUT", message: z.prettifyError(err) } });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    if (isHttpClientError(err)) {
      res.status(err.status).json({
        error: {
          code: (err.type && BODY_ERROR_CODES[err.type]) ?? "BAD_REQUEST",
          message: err.expose ? err.message : "Bad request",
        },
      });
      return;
    }
    logger.error({ err, requestId: res.locals.requestId }, "unhandled error");
    res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
  };
}
