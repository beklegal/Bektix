import type { RequestHandler } from "express";
import { sendApiError } from "../http/errors.js";

export const requireTenant: RequestHandler = (req, res, next) => {
  if (req.auth?.role === "super_admin") {
    return sendApiError(res, 403, "forbidden", "Super admin cannot access tenant workspaces.");
  }

  next();
};
