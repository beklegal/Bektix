import type { Response } from "express";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

export function sendApiError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
) {
  res.status(status).json({ error: code, message });
}

