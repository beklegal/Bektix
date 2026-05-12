import pg from "pg";
import { env } from "../env.js";

const { Pool, types } = pg;

// node-postgres returns NUMERIC as string by default. For prices/taxes in this app,
// parsing as number is acceptable and simplifies the client model.
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));

const shouldUseSsl = /\bsslmode=(require|verify-ca|verify-full|no-verify)\b/i.test(
  env.DATABASE_URL,
)
  || /\bssl=true\b/i.test(env.DATABASE_URL)
  || /\bneon\.tech\b/i.test(env.DATABASE_URL);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
});
