import type { RequestHandler } from "express";
import { pool } from "../db/pool.js";
import { serializeShop, serializeUser } from "../domain/serializers.js";
import { sendApiError } from "../http/errors.js";
import { clearUserSessionCookie, getUserSession } from "./session.js";

type JoinedRow = {
  shop_id: string;
  shop_name: string;
  shop_business_type: string;
  shop_status: string;
  shop_created_at: unknown;
  shop_preferences: unknown;
  shop_features: unknown;
  shop_session_version: number;
};

type UserRow = {
  user_id: string;
  user_shop_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  user_status: string;
  user_created_at: unknown;
  user_session_version: number;
  user_permissions: unknown;
};

export const requireUser: RequestHandler = async (req, res, next) => {
  const session = getUserSession(req);
  if (!session) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Not authenticated.");
  }

  const shopResult = await pool.query<JoinedRow>(
    `
      SELECT
        s.id AS shop_id,
        s.name AS shop_name,
        s.business_type AS shop_business_type,
        s.status AS shop_status,
        s.created_at AS shop_created_at,
        s.preferences AS shop_preferences,
        s.features AS shop_features,
        s.session_version AS shop_session_version
      FROM shops s
      WHERE s.id = $1
      LIMIT 1
    `,
    [session.shopId],
  );

  const shopRow = shopResult.rows[0];
  if (!shopRow) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Session expired.");
  }

  if (shopRow.shop_status !== "active") {
    clearUserSessionCookie(res);
    return sendApiError(res, 403, "forbidden", "This shop is inactive.");
  }

  if (session.shopSessionVersion !== shopRow.shop_session_version) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Session revoked.");
  }

  const userResult = await pool.query<UserRow>(
    `
      SELECT
        u.id AS user_id,
        u.shop_id AS user_shop_id,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role,
        u.status AS user_status,
        u.created_at AS user_created_at,
        u.session_version AS user_session_version
        ,u.permissions AS user_permissions
      FROM users u
      WHERE u.id = $1 AND u.shop_id = $2
      LIMIT 1
    `,
    [session.userId, session.shopId],
  );

  const userRow = userResult.rows[0];
  if (!userRow) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Session expired.");
  }

  if (userRow.user_status !== "active") {
    clearUserSessionCookie(res);
    return sendApiError(res, 403, "forbidden", "This user is inactive.");
  }

  if (session.userSessionVersion !== userRow.user_session_version) {
    clearUserSessionCookie(res);
    return sendApiError(res, 401, "unauthorized", "Session revoked.");
  }

  const user = serializeUser({
    id: userRow.user_id,
    shop_id: userRow.user_shop_id,
    name: userRow.user_name,
    email: userRow.user_email,
    role: userRow.user_role,
    status: userRow.user_status,
    created_at: userRow.user_created_at,
    permissions: userRow.user_permissions,
  });

  const shop = serializeShop({
    id: shopRow.shop_id,
    name: shopRow.shop_name,
    business_type: shopRow.shop_business_type,
    status: shopRow.shop_status,
    created_at: shopRow.shop_created_at,
    features: shopRow.shop_features,
    preferences: shopRow.shop_preferences,
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
