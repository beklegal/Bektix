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
    await client.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription jsonb NOT NULL DEFAULT '{"status":"trial","plan":"Starter","reminderDays":7}'::jsonb;`);

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
      CREATE TABLE IF NOT EXISTS branches (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        name text NOT NULL,
        location text NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS branches_shop_id_idx
      ON branches(shop_id, created_at DESC);
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{"manage_inventory":false,"collect_payments":false}'::jsonb;`);

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
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS products_shop_branch_id_idx ON products(shop_id, branch_id);`);

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
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS sales_shop_branch_created_at_idx ON sales(shop_id, branch_id, created_at DESC);`);

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

    await client.query(`CREATE TABLE IF NOT EXISTS payment_accounts (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, provider text NOT NULL, mode text NOT NULL, encrypted_secret text NOT NULL, secret_key_suffix text NOT NULL, currency text NOT NULL DEFAULT 'GHS', enabled boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(shop_id, provider))`);
    await client.query(`CREATE TABLE IF NOT EXISTS checkout_reservations (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL, user_id uuid NOT NULL REFERENCES users(id), idempotency_key text NOT NULL, status text NOT NULL DEFAULT 'active', expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(shop_id, idempotency_key))`);
    await client.query(`CREATE TABLE IF NOT EXISTS checkout_reservation_items (id uuid PRIMARY KEY, reservation_id uuid NOT NULL REFERENCES checkout_reservations(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id), name text NOT NULL, quantity integer NOT NULL, unit_price numeric NOT NULL, unit_cost numeric NOT NULL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS payment_transactions (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL, payment_account_id uuid NOT NULL REFERENCES payment_accounts(id), reservation_id uuid NOT NULL REFERENCES checkout_reservations(id), sale_id uuid NULL REFERENCES sales(id), provider text NOT NULL, reference text NOT NULL UNIQUE, provider_transaction_id text NULL, customer_phone text NOT NULL, customer_email text NOT NULL, amount_pesewas bigint NOT NULL, currency text NOT NULL, network text NOT NULL, status text NOT NULL, failure_reason text NULL, provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb, expires_at timestamptz NOT NULL, completed_at timestamptz NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(shop_id, reservation_id))`);
    await client.query(`CREATE INDEX IF NOT EXISTS payment_transactions_shop_status_idx ON payment_transactions(shop_id, status, created_at DESC)`);
    await client.query(`CREATE TABLE IF NOT EXISTS payment_audit_events (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL, payment_id uuid NULL REFERENCES payment_transactions(id) ON DELETE CASCADE, reservation_id uuid NULL REFERENCES checkout_reservations(id) ON DELETE CASCADE, event text NOT NULL, status text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS customers (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, name text NOT NULL, phone text NULL, email text NULL, consent_marketing boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE INDEX IF NOT EXISTS customers_shop_name_idx ON customers(shop_id, name)`);
    await client.query(`CREATE TABLE IF NOT EXISTS orders (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL, customer_id uuid NULL REFERENCES customers(id) ON DELETE SET NULL, sale_id uuid NULL UNIQUE REFERENCES sales(id) ON DELETE SET NULL, source text NOT NULL DEFAULT 'pos', status text NOT NULL DEFAULT 'fulfilled', subtotal numeric NOT NULL, tax numeric NOT NULL DEFAULT 0, total numeric NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS order_items (id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id uuid NULL REFERENCES products(id) ON DELETE SET NULL, name text NOT NULL, quantity integer NOT NULL, unit_price numeric NOT NULL, unit_cost numeric NOT NULL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS payment_allocations (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, sale_id uuid NULL REFERENCES sales(id) ON DELETE CASCADE, order_id uuid NULL REFERENCES orders(id) ON DELETE CASCADE, payment_transaction_id uuid NULL REFERENCES payment_transactions(id) ON DELETE SET NULL, method text NOT NULL, amount numeric NOT NULL, currency text NOT NULL DEFAULT 'GHS', created_at timestamptz NOT NULL DEFAULT now(), CHECK (sale_id IS NOT NULL OR order_id IS NOT NULL))`);
    await client.query(`CREATE TABLE IF NOT EXISTS inventory_movements (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL, product_id uuid NOT NULL REFERENCES products(id), movement_type text NOT NULL, quantity_delta integer NOT NULL, unit_cost numeric NULL, reference_type text NOT NULL, reference_id uuid NULL, created_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements(shop_id, product_id, created_at DESC)`);
    await client.query(`CREATE TABLE IF NOT EXISTS sales_returns (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, sale_id uuid NOT NULL REFERENCES sales(id), status text NOT NULL DEFAULT 'completed', reason text NULL, created_by_user_id uuid NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS sales_return_items (id uuid PRIMARY KEY, sales_return_id uuid NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id), quantity integer NOT NULL CHECK (quantity > 0))`);
    await client.query(`CREATE TABLE IF NOT EXISTS audit_events (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL, user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL, entity_type text NOT NULL, entity_id uuid NULL, action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS outbox_events (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, topic text NOT NULL, aggregate_type text NOT NULL, aggregate_id uuid NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz NULL)`);
    await client.query(`CREATE INDEX IF NOT EXISTS outbox_events_pending_idx ON outbox_events(status, available_at)`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES customers(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key text NULL`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_idempotency_uq ON sales(shop_id, idempotency_key) WHERE idempotency_key IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS sales_shop_customer_created_idx ON sales(shop_id, customer_id, created_at DESC)`);
    await client.query(`CREATE TABLE IF NOT EXISTS journal_entries (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL, source_type text NOT NULL, source_id uuid NOT NULL, description text NOT NULL, entry_date date NOT NULL DEFAULT current_date, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(shop_id, source_type, source_id))`);
    await client.query(`CREATE TABLE IF NOT EXISTS journal_lines (id uuid PRIMARY KEY, journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE, account_code text NOT NULL, debit numeric NOT NULL DEFAULT 0 CHECK (debit >= 0), credit numeric NOT NULL DEFAULT 0 CHECK (credit >= 0), CHECK ((debit = 0) <> (credit = 0)))`);
    // `branch_id` intentionally remains nullable for shops that do not use
    // branches. A primary key would silently make it NOT NULL, so use a
    // null-aware unique index for the daily aggregate key instead.
    await client.query(`CREATE TABLE IF NOT EXISTS daily_metrics (shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL, metric_date date NOT NULL, sales_count integer NOT NULL DEFAULT 0, revenue numeric NOT NULL DEFAULT 0, gross_profit numeric NOT NULL DEFAULT 0, items_sold integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`ALTER TABLE daily_metrics DROP CONSTRAINT IF EXISTS daily_metrics_pkey`);
    await client.query(`ALTER TABLE daily_metrics ALTER COLUMN branch_id DROP NOT NULL`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS daily_metrics_shop_branch_date_uq ON daily_metrics (shop_id, branch_id, metric_date) NULLS NOT DISTINCT`);
    await client.query(`CREATE TABLE IF NOT EXISTS storefronts (id uuid PRIMARY KEY, shop_id uuid NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE, slug text NOT NULL UNIQUE, enabled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS integration_accounts (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, provider text NOT NULL, category text NOT NULL, status text NOT NULL DEFAULT 'disconnected', encrypted_credentials text NULL, settings jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(shop_id, provider))`);
    await client.query(`CREATE TABLE IF NOT EXISTS product_modifier_groups (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, name text NOT NULL, required boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE IF NOT EXISTS product_modifier_options (id uuid PRIMARY KEY, group_id uuid NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE, name text NOT NULL, price_delta numeric NOT NULL DEFAULT 0)`);
    await client.query(`CREATE TABLE IF NOT EXISTS product_batches (id uuid PRIMARY KEY, shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE, batch_number text NOT NULL, expiry_date date NULL, quantity integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(shop_id, product_id, batch_number))`);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
