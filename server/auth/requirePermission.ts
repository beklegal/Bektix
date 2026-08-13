import type { RequestHandler } from "express";
import type { UserPermission } from "@shared/bektix";
import { sendApiError } from "../http/errors.js";

export function requirePermission(permission: UserPermission): RequestHandler {
  return (req, res, next) => {
    if (req.auth?.role === "admin") return next();
    if (!req.auth?.user.permissions[permission]) return sendApiError(res, 403, "forbidden", "Your account does not have permission for this action.");
    next();
  };
}
