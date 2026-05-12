import "dotenv/config";
import { env } from "../env";
import { pool } from "./pool";

async function cleanDemoData() {
  if (process.env.CLEAN_DEMO_DATA !== "1") {
    console.error(
      "Refusing to clean demo data without explicit confirmation. Set CLEAN_DEMO_DATA=1 and rerun this script.",
    );
    process.exit(1);
  }

  console.log("Connecting to database and cleaning demo data...");
  console.log("Using DATABASE_URL:", env.DATABASE_URL.replace(/(postgres.*@).*?(\/.*)/, "$1***$2"));

  await pool.query("BEGIN");
  try {
    await pool.query("TRUNCATE TABLE shops CASCADE;");
    await pool.query("COMMIT");
    console.log("Demo data cleaned. All shops, products, sales, and user accounts have been removed.");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Failed to clean demo data:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanDemoData().catch((error) => {
  console.error("Unexpected error while cleaning demo data:", error);
  process.exit(1);
});
