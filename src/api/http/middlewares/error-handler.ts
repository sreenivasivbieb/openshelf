import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError, z } from "zod";
import { AppError } from "../../../shared/errors";

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
    logger.error({ err, requestId: res.locals.requestId }, "unhandled error");
    res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
  };
}
