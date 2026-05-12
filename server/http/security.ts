import type { NextFunction, Request, RequestHandler, Response } from "express";
import { sendApiError } from "./errors";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  message?: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sameOrigin(req: Request) {
  const origin = req.get("origin");
  if (!origin) return true;

  const host = req.get("host");
  if (!host) return false;

  try {
    const url = new URL(origin);
    return url.host === host;
  } catch {
    return false;
  }
}

export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }

    next();
  };
}

export function rejectCrossOriginWrites(): RequestHandler {
  return (req, res, next) => {
    if (!stateChangingMethods.has(req.method)) return next();
    if (sameOrigin(req)) return next();
    return sendApiError(res, 403, "forbidden", "Cross-origin write requests are not allowed.");
  };
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const key = options.key?.(req) ?? clientIp(req);
    const bucketKey = `${req.method}:${req.baseUrl || req.path}:${key}`;
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return sendApiError(
        res,
        429,
        "too_many_requests",
        options.message ?? "Too many requests. Please try again shortly.",
      );
    }

    next();
  };
}

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  key: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return `${clientIp(req)}:${email}`;
  },
  message: "Too many sign-in attempts. Please wait and try again.",
});

export function requestErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (!err) return next();

  const error = err as { type?: string; status?: number; message?: string };
  if (error.type === "entity.too.large" || error.status === 413) {
    return sendApiError(res, 413, "payload_too_large", "Request body is too large.");
  }

  if (error instanceof SyntaxError) {
    return sendApiError(res, 400, "bad_request", "Invalid JSON request body.");
  }

  return next(err);
}
