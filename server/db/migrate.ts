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
        features jsonb NOT NULL DEFAULT '{}'::jsonb,
        preferences jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name text NOT NULL,
        title text NOT NULL,
        pay_type text NOT NULL,
        base_pay numeric NOT NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS employees_shop_name_idx
      ON employees(shop_id, name ASC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES employees(id),
        period_start date NOT NULL,
        period_end date NOT NULL,
        pay_date date NOT NULL,
        gross_pay numeric NOT NULL,
        allowances numeric NOT NULL DEFAULT 0,
        deductions numeric NOT NULL DEFAULT 0,
        net_pay numeric NOT NULL,
        payment_method text NOT NULL,
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS payroll_runs_shop_pay_date_idx
      ON payroll_runs(shop_id, pay_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name text NOT NULL,
        contact_name text NULL,
        phone text NULL,
        email text NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS suppliers_shop_name_idx
      ON suppliers(shop_id, name ASC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        supplier_id uuid NOT NULL REFERENCES suppliers(id),
        order_number text NOT NULL,
        order_date date NOT NULL,
        expected_date date NULL,
        status text NOT NULL DEFAULT 'draft',
        total numeric NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_shop_order_number_uq
      ON purchase_orders(shop_id, order_number);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_line_items (
        id uuid PRIMARY KEY,
        purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id),
        product_name text NOT NULL,
        quantity integer NOT NULL,
        unit_cost numeric NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS purchase_order_line_items_order_id_idx
      ON purchase_order_line_items(purchase_order_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        supplier_id uuid NOT NULL REFERENCES suppliers(id),
        purchase_order_id uuid NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
        invoice_number text NOT NULL,
        invoice_date date NOT NULL,
        due_date date NULL,
        subtotal numeric NOT NULL,
        amount_paid numeric NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'unpaid',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS purchase_invoices_shop_invoice_number_uq
      ON purchase_invoices(shop_id, invoice_number);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS purchase_invoices_shop_invoice_date_idx
      ON purchase_invoices(shop_id, invoice_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_line_items (
        id uuid PRIMARY KEY,
        purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id),
        product_name text NOT NULL,
        quantity integer NOT NULL,
        unit_cost numeric NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS purchase_invoice_line_items_invoice_id_idx
      ON purchase_invoice_line_items(purchase_invoice_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_payments (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        supplier_id uuid NOT NULL REFERENCES suppliers(id),
        purchase_invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        payment_date date NOT NULL,
        amount numeric NOT NULL,
        payment_method text NOT NULL,
        reference text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS supplier_payments_shop_payment_date_idx
      ON supplier_payments(shop_id, payment_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_deposits (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        deposit_date date NOT NULL,
        bank_name text NOT NULL,
        reference text NULL,
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bank_deposits_shop_deposit_date_idx
      ON bank_deposits(shop_id, deposit_date DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_deposit_line_items (
        id uuid PRIMARY KEY,
        bank_deposit_id uuid NOT NULL REFERENCES bank_deposits(id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_reference text NULL,
        description text NOT NULL,
        payment_method text NOT NULL,
        amount numeric NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bank_deposit_line_items_deposit_id_idx
      ON bank_deposit_line_items(bank_deposit_id);
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
