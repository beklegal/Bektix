import crypto from "node:crypto";
import { env } from "../env.js";
const key = () => {
  const value = env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
  if (!value || value.length < 32) throw new Error("Mobile Money is not configured on this deployment.");
  return crypto.createHash("sha256").update(value).digest();
};
export function encryptSecret(value: string) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv); return [iv.toString("base64"), Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64"), cipher.getAuthTag().toString("base64")].join("."); }
export function decryptSecret(value: string) { const [iv, body, tag] = value.split("."); const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64")); return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8"); }
