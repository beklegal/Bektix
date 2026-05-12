import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "../server/index";

let appPromise: ReturnType<typeof createServer> | null = null;

async function getApp() {
  if (!appPromise) appPromise = createServer();
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  if (typeof req.url === "string" && !req.url.startsWith("/api/")) {
    req.url = req.url.startsWith("/") ? `/api${req.url}` : `/api/${req.url}`;
  }
  return app(req as any, res as any);
}
