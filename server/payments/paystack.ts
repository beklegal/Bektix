import crypto from "node:crypto";
export type MobileNetwork = "mtn" | "atl" | "vod";
export function normalizeGhanaPhone(value: string) { const digits = value.replace(/\D/g, "").replace(/^233/, "0"); if (!/^0\d{9}$/.test(digits)) throw new Error("The customer's phone number is invalid."); return digits; }
export function maskPhone(phone: string) { return `${phone.slice(0, 3)}****${phone.slice(-3)}`; }
async function call(secret: string, path: string, init?: RequestInit) { const res = await fetch(`https://api.paystack.co${path}`, { ...init, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init?.headers || {}) } }); const body = await res.json().catch(() => ({})); if (!res.ok || !body.status) throw new Error(typeof body.message === "string" ? body.message : "Payment provider is temporarily unavailable."); return body.data; }
export async function requestPaystackMomo(secret: string, input: { reference: string; email: string; amount: number; phone: string; network: MobileNetwork }) { return call(secret, "/charge", { method: "POST", body: JSON.stringify({ reference: input.reference, email: input.email, amount: input.amount, currency: "GHS", mobile_money: { phone: input.phone, provider: input.network } }) }); }
export const verifyPaystack = (secret: string, reference: string) => call(secret, `/transaction/verify/${encodeURIComponent(reference)}`);
export const testPaystack = (secret: string) => call(secret, "/balance");
export function validSignature(raw: Buffer, signature: string | undefined, secret: string) { if (!signature) return false; const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex"); return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); }
