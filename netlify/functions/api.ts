import serverless from "serverless-http";

import { createServer } from "../../server";

let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (cachedHandler) return cachedHandler;
  const app = await createServer();
  cachedHandler = serverless(app);
  return cachedHandler;
}

export const handler = async (event: any, context: any) => {
  const fn = await getHandler();
  return fn(event, context);
};
