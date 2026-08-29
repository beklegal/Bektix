import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { migrate } from "./db/migrate.js";
import { bootstrapSuperAdmin } from "./db/bootstrap.js";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { usersRouter } from "./routes/users.js";
import { salesRouter } from "./routes/sales.js";
import { shopRouter } from "./routes/shop.js";
import { debtorsRouter } from "./routes/debtors.js";
import { payrollRouter } from "./routes/payroll.js";
import { creditorsRouter } from "./routes/creditors.js";
import { bankingRouter } from "./routes/banking.js";
import { platformRouter } from "./routes/platform.js";
import { paymentsRouter } from "./routes/payments.js";
import { commerceRouter } from "./routes/commerce.js";
import {
  apiRateLimit,
  rejectCrossOriginWrites,
  requestErrorHandler,
  securityHeaders,
} from "./http/security.js";

export async function createServer() {
  const app = express();

  // Middleware
  // Needed for correct `req.ip` behind platforms like Vercel/Netlify.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(securityHeaders());
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb", verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); } }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));
  app.use(requestErrorHandler);
  app.use("/api", rejectCrossOriginWrites(), apiRateLimit);

  await migrate();
  await bootstrapSuperAdmin();

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/platform", platformRouter);
  app.use("/api/shop", shopRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/debtors", debtorsRouter);
  app.use("/api/payroll", payrollRouter);
  app.use("/api/creditors", creditorsRouter);
  app.use("/api/banking", bankingRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/commerce", commerceRouter);

  return app;
}
