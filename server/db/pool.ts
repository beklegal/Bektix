import pg from "pg";
import { env } from "../env.js";

const { Pool, types } = pg;

// node-postgres returns NUMERIC as string by default. For prices/taxes in this app,
// parsing as number is acceptable and simplifies the client model.
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));

function normalizeDatabaseUrl(value: string) {
  const url = new URL(value);
  const sslMode = url.searchParams.get("sslmode");

  if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode.toLowerCase())) {
    url.searchParams.set("sslmode", "verify-full");
  }

  if (!sslMode && /\bneon\.tech$/i.test(url.hostname)) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

const connectionString = normalizeDatabaseUrl(env.DATABASE_URL);

export const pool = new Pool({
  connectionString,
});
