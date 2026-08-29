import { z } from "zod";

function optionalEnvValue(value: unknown, placeholders: string[]) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (placeholders.some((p) => trimmed.includes(p))) return undefined;
  return trimmed;
}

const baseSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SUPER_ADMIN_BOOTSTRAP_EMAIL: z.preprocess(
    (v) => optionalEnvValue(v, ["__SUPER_ADMIN_EMAIL__"]),
    z.string().email().optional(),
  ),
  SUPER_ADMIN_BOOTSTRAP_PASSWORD: z.preprocess(
    (v) => optionalEnvValue(v, ["__SUPER_ADMIN_PASSWORD__"]),
    z.string().min(8).optional(),
  ),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  PAYMENT_CREDENTIALS_ENCRYPTION_KEY: z.string().optional(),
  PAYMENTS_RECONCILIATION_SECRET: z.string().optional(),
  APP_URL: z.string().url().optional(),
});

const strictSchema = baseSchema.extend({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (v) => !v.includes("__NEON_DATABASE_URL__"),
      "DATABASE_URL must be set to a real Neon connection string.",
    )
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must start with postgres:// or postgresql://",
    ),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine(
      (v) => !v.includes("__CHANGE_ME_TO_A_LONG_RANDOM_SECRET__"),
      "JWT_SECRET must be set to a long random secret.",
    ),
  SUPER_ADMIN_BOOTSTRAP_EMAIL: z.string().email(),
  SUPER_ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8),
  PAYMENT_CREDENTIALS_ENCRYPTION_KEY: z.string().min(32),
  PAYMENTS_RECONCILIATION_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
});

const devSchema = baseSchema.extend({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must start with postgres:// or postgresql://",
    ),
});

function getEnv() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const databaseUrl = optionalEnvValue(process.env.DATABASE_URL ?? process.env.POSTGRES_URL, [
    "__NEON_DATABASE_URL__",
  ]);
  const jwtSecret = optionalEnvValue(process.env.JWT_SECRET, ["__CHANGE_ME_TO_A_LONG_RANDOM_SECRET__"]);

  const envValue = {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    SUPER_ADMIN_BOOTSTRAP_EMAIL: process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL,
    SUPER_ADMIN_BOOTSTRAP_PASSWORD: process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD,
    NODE_ENV: nodeEnv as "development" | "production" | "test",
    PAYMENT_CREDENTIALS_ENCRYPTION_KEY: process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY,
    PAYMENTS_RECONCILIATION_SECRET: process.env.PAYMENTS_RECONCILIATION_SECRET,
    APP_URL: process.env.APP_URL,
  };

  if (nodeEnv === "development") {
    return devSchema.parse({
      ...envValue,
      DATABASE_URL:
        envValue.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/bektix?sslmode=disable",
      JWT_SECRET: envValue.JWT_SECRET || "dev-secret-change-me-to-a-long-random-string-1234",
      PAYMENT_CREDENTIALS_ENCRYPTION_KEY: envValue.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || "dev-payment-encryption-key-change-me-32!",
    });
  }

  return strictSchema.parse(envValue);
}

export const env = getEnv();
