import type { CookieOptions, Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../env.js";

const USER_COOKIE = "jilkem_session";

type UserSessionToken = {
  typ: "user";
  userId: string;
  shopId: string;
  userSessionVersion: number;
  shopSessionVersion: number;
};

function cookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
  };
}

export function setUserSessionCookie(res: Response, token: string) {
  res.cookie(USER_COOKIE, token, cookieOptions());
}

export function clearUserSessionCookie(res: Response) {
  res.clearCookie(USER_COOKIE, { ...cookieOptions(), maxAge: 0 });
}

export function signUserSession(
  payload: Omit<UserSessionToken, "typ">,
  options?: Pick<SignOptions, "expiresIn">,
) {
  const full: UserSessionToken = { typ: "user", ...payload };
  return jwt.sign(full, env.JWT_SECRET, { expiresIn: options?.expiresIn ?? "7d" });
}

export function getUserSession(req: Request): UserSessionToken | null {
  const token = (req.cookies?.[USER_COOKIE] as string | undefined) ?? null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as unknown as UserSessionToken;
    if (decoded?.typ !== "user") return null;
    if (!decoded.userId || !decoded.shopId) return null;
    if (typeof decoded.userSessionVersion !== "number") return null;
    if (typeof decoded.shopSessionVersion !== "number") return null;
    return decoded;
  } catch {
    return null;
  }
}
