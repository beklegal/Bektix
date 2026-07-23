import type { RequestHandler } from "express";
import type { TenantFeature } from "@shared/bektix";
import { sendApiError } from "../http/errors.js";

export function requireFeature(feature: TenantFeature): RequestHandler {
  return (req, res, next) => {
    if (req.auth?.role === "super_admin") {
      return sendApiError(res, 403, "forbidden", "Super admin cannot access tenant workspaces.");
    }

    if (!req.auth?.shop.features[feature]) {
      return sendApiError(res, 403, "forbidden", "This feature is not enabled for this tenant.");
    }

    next();
  };
}
