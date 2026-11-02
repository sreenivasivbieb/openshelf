import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";

/** Every request gets an id (reused from X-Request-Id if sent), echoed back and put in logs. */
export const requestId: RequestHandler = (req, res, next) => {
  const id = req.get("x-request-id") ?? randomUUID();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};
