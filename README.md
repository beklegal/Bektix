# BEKTIX Shop Management

BEKTIX is a multi-tenant shop management platform for running daily retail operations from one workspace. It includes inventory, sales, customers, reporting, debtors, creditors, banking, payroll, public storefronts, and role-based administration.

## Features

- Authenticated tenant dashboards and role-based access control
- Inventory and product management
- Sales processing and receipt views
- Customer, debtor, and creditor management
- Reports, banking, and payroll tools
- Public storefronts at `/store/:slug`
- Super-admin platform management
- PostgreSQL-backed API with session authentication
- Vercel-ready SPA and serverless API deployment

## Requirements

- Node.js 20 or later
- pnpm 10
- PostgreSQL

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a local `.env` file. Development defaults are available, but a database connection is still required for normal application use:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bektix?sslmode=disable
   JWT_SECRET=replace-with-a-long-random-string
   SUPER_ADMIN_BOOTSTRAP_EMAIL=admin@example.com
   SUPER_ADMIN_BOOTSTRAP_PASSWORD=replace-with-a-secure-password
   APP_URL=http://localhost:5173
   ```

   Optional payment settings:

   ```env
   PAYMENT_CREDENTIALS_ENCRYPTION_KEY=replace-with-a-secure-key
   PAYMENTS_RECONCILIATION_SECRET=replace-with-a-secure-secret
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:5173](http://localhost:5173).

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm build` | Build the client and server bundles |
| `pnpm build:client` | Build the SPA for deployment |
| `pnpm build:server` | Build the server bundle |
| `pnpm start` | Start the production server bundle |
| `pnpm typecheck` | Run the TypeScript compiler without emitting files |
| `pnpm test` | Run the Vitest test suite |
| `pnpm db:clean-demo` | Remove demo database data |
| `pnpm format.fix` | Format the repository with Prettier |

## Project Structure

```text
client/       React SPA, routes, pages, UI components, and browser state
server/       Express-compatible API, auth, database, and domain logic
shared/       Types and contracts shared by the client and server
api/          Vercel serverless API entry point
netlify/      Netlify function entry point
public/       Static assets
```

Routes are defined in `client/App.tsx`. API handlers live in `server/routes/`, with shared request and response types in `shared/`.

## Database

The application uses PostgreSQL. Set `DATABASE_URL` to a PostgreSQL connection string before running production builds or server commands. Database bootstrap and migration helpers are located in `server/db/`.

In development, the application can fall back to a local PostgreSQL URL when `DATABASE_URL` is not set. Production requires a real database URL and a JWT secret of at least 32 characters.

## Deployment

### Vercel

The repository includes `vercel.json` for SPA hosting and serverless API rewrites:

```bash
pnpm install --frozen-lockfile --prod=false
pnpm build:client
```

Configure the production environment variables in Vercel, especially `DATABASE_URL`, `JWT_SECRET`, `SUPER_ADMIN_BOOTSTRAP_EMAIL`, and `SUPER_ADMIN_BOOTSTRAP_PASSWORD`.

### Other hosts

For a Node-based deployment, build both bundles and start the server:

```bash
pnpm build
pnpm start
```

Do not commit `.env` files or production credentials.
