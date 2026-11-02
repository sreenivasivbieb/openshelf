import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";

/** Bearer-token guard for /admin/* (NFR-01). Hackathon-grade; real merchant auth is roadmap. */
export function adminAuth(adminToken: string): RequestHandler {
  const expected = Buffer.from(`Bearer ${adminToken}`);
  return (req, res, next) => {
    const got = Buffer.from(req.get("authorization") ?? "");
    if (got.length === expected.length && timingSafeEqual(got, expected)) return next();
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Admin token required" } });
  };
}
