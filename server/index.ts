import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { migrate } from "./db/migrate";
import { bootstrapSingleShop } from "./db/bootstrap";
import { authRouter } from "./routes/auth";
import { productsRouter } from "./routes/products";
import { usersRouter } from "./routes/users";
import { salesRouter } from "./routes/sales";
import { shopRouter } from "./routes/shop";

export async function createServer() {
  const app = express();

  // Middleware
  // Needed for correct `req.ip` behind platforms like Vercel/Netlify.
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  await migrate();
  await bootstrapSingleShop();

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/shop", shopRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/sales", salesRouter);

  return app;
}
