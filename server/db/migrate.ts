import { pool } from "./pool.js";

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7182026051901)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        business_type text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        session_version integer NOT NULL DEFAULT 0,
        preferences jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name text NOT NULL,
        email text NOT NULL,
        email_lower text NOT NULL,
        role text NOT NULL,
        status text NOT NULL,
        session_version integer NOT NULL DEFAULT 0,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uq
      ON users(email_lower);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS users_shop_id_idx ON users(shop_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name text NOT NULL,
        category text NOT NULL,
        quantity integer NOT NULL,
        cost_price numeric NOT NULL,
        selling_price numeric NOT NULL,
        expiry_date date NULL,
        size text NULL,
        color text NULL,
        warranty text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS products_shop_id_idx ON products(shop_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        receipt_number text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        cashier_user_id uuid NOT NULL REFERENCES users(id),
        cashier_name text NOT NULL,
        subtotal numeric NOT NULL,
        tax numeric NOT NULL,
        total numeric NOT NULL,
        amount_paid numeric NOT NULL,
        change numeric NOT NULL,
        payment_method text NOT NULL,
        payer_type text NOT NULL DEFAULT 'walkIn'
      );
    `);

    await client.query(`
      ALTER TABLE sales
      ADD COLUMN IF NOT EXISTS payer_type text NOT NULL DEFAULT 'walkIn';
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_receipt_number_uq
      ON sales(shop_id, receipt_number);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS sales_shop_created_at_idx
      ON sales(shop_id, created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_line_items (
        id uuid PRIMARY KEY,
        sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id),
        name text NOT NULL,
        quantity integer NOT NULL,
        unit_price numeric NOT NULL,
        unit_cost numeric NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS sale_line_items_sale_id_idx
      ON sale_line_items(sale_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS debtors (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name text NOT NULL,
        date date NOT NULL,
        invoice_number text NOT NULL,
        amount numeric NOT NULL,
        status text NOT NULL DEFAULT 'unpaid',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS debtors_shop_date_idx
      ON debtors(shop_id, date DESC);
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
