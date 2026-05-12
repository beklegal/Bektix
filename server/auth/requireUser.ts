import type { RequestHandler } from "express";
import { pool } from "../db/pool";
import { serializeShop, serializeUser } from "../domain/serializers";
import { sendApiError } from "../http/errors";
import { clearUserSessionCookie, getUserSession } from "./session";

type JoinedRow = {
  user_id: string;
  user_shop_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  user_status: string;
  user_created_at: unknown;
  user_session_version: number;
  shop_id: string;
  shop_name: string;
  shop_business_type: string;
  shop_status: string;
  shop_created_at: unknown;
  shop_preferences: unknown;
  shop_session_version: number;
};

export const requireUser: RequestHandler = async (req, res, next) => {
  const session = getUserSession(req);
  if (!session) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Not authenticated.");
  }

  const result = await pool.query<JoinedRow>(
    `
      SELECT
        u.id AS user_id,
        u.shop_id AS user_shop_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        u.status AS user_status,
        u.created_at AS user_created_at,
        u.session_version AS user_session_version,
        s.id AS shop_id,
        s.name AS shop_name,
        s.business_type AS shop_business_type,
        s.status AS shop_status,
        s.created_at AS shop_created_at,
        s.preferences AS shop_preferences,
        s.session_version AS shop_session_version
      FROM users u
      JOIN shops s ON s.id = u.shop_id
      WHERE u.id = $1 AND s.id = $2
      LIMIT 1
    `,
    [session.userId, session.shopId],
  );

  const row = result.rows[0];
  if (!row) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Session expired.");
  }

  if (row.shop_status !== "active") {
    clearUserSessionCookie(res);
    return sendApiError(res, 403, "forbidden", "This shop is inactive.");
  }

  if (row.user_status !== "active") {
    clearUserSessionCookie(res);
    return sendApiError(res, 403, "forbidden", "This user is inactive.");
  }

  if (
    session.userSessionVersion !== row.user_session_version ||
    session.shopSessionVersion !== row.shop_session_version
  ) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Session revoked.");
  }

  const user = serializeUser({
    id: row.user_id,
    shop_id: row.user_shop_id,
    name: row.user_name,
    email: row.user_email,
    role: row.user_role,
    status: row.user_status,
    created_at: row.user_created_at,
  });

  const shop = serializeShop({
    id: row.shop_id,
    name: row.shop_name,
    business_type: row.shop_business_type,
    status: row.shop_status,
    created_at: row.shop_created_at,
    preferences: row.shop_preferences,
  });

  req.auth = {
    userId: user.id,
    shopId: shop.id,
    role: user.role,
    user,
    shop,
  };

  next();
};
