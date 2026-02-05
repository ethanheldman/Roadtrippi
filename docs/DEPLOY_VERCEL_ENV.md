# Setting up Database and Secrets for Vercel

## 1. JWT_SECRET (do this first)

Use a long random string (at least 32 characters). You can generate one:

- **Terminal:** `openssl rand -base64 32`
- **Or:** use a password generator and paste 32+ random characters

You’ll add this in Vercel in step 3 below.

---

## 2. Choose a database

### Option A: Neon (Postgres) – recommended

1. Go to [neon.tech](https://neon.tech) and sign up (free tier is enough).
2. Create a new project (e.g. name: `roadtrippi`).
3. On the project dashboard, copy the **connection string** (looks like):
   ```text
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Your app is currently on **SQLite**. To use Neon you need to switch the schema to Postgres and run a migration (see “Neon schema change” below). After that, use this URL as `DATABASE_URL` in Vercel.

### Option B: Turso (hosted SQLite)

1. Go to [turso.tech](https://turso.tech) and sign up.
2. Install the Turso CLI (or use the dashboard) and create a database, e.g.:
   ```bash
   brew install tursodatabase/tap/turso   # macOS
   turso auth login
   turso db create roadtrippi
   turso db show roadtrippi --url
   ```
3. The URL is like: `libsql://roadtrippi-org-name.turso.io`.
4. Get a token for the app:
   ```bash
   turso db tokens create roadtrippi
   ```
5. Your `DATABASE_URL` for Turso should look like:
   ```text
   file:local.db
   ```
   Turso uses the libSQL driver. For Prisma you’d use the `@prisma/adapter-libsql` and set the Turso URL and token via env (e.g. `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`). So Turso is a bit more setup with Prisma; Neon is simpler for a first deploy.

---

## 3. Add environment variables in Vercel

1. Open [vercel.com](https://vercel.com) → your project (**roadtrippi**).
2. Go to **Settings** → **Environment Variables**.
3. Add:

   | Name                     | Value                    | Environments      |
   |--------------------------|--------------------------|-------------------|
   | `DATABASE_URL`           | Your Neon (or DB) URL    | Production, Preview (optional) |
   | `JWT_SECRET`             | Your long random string  | Production, Preview (optional) |
   | `BLOB_READ_WRITE_TOKEN`  | (optional) From Vercel Blob store | Production, Preview (optional) |

4. **Profile pictures (Vercel Blob):** To persist avatar uploads on Vercel, create a Blob store: Vercel Dashboard → your project → **Storage** → **Create** → **Blob**. The store creates `BLOB_READ_WRITE_TOKEN` automatically. Add it to Environment Variables (or link the store so the token is available). Without it, avatar uploads are stored in `/tmp` and are not persisted.

5. Click **Save**.
6. **Redeploy** the app (Deployments → … on latest → Redeploy) so the new env vars are used.

---

## 4. Neon schema change (if you chose Option A)

Your Prisma schema is currently SQLite. To use Neon:

1. In `server/prisma/schema.prisma`, change the datasource to:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. From the repo root (or from `server/`):

   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   ```

   Use the **same** `DATABASE_URL` you set in Vercel (your Neon URL). That creates the tables in Neon.

3. **Seed Neon (do this whenever you add or change seed data, including attractions):**  
   Set `server/.env` so `DATABASE_URL` is your **Neon** connection string (same as in Vercel). Then from the repo root:

   ```bash
   npm run db:seed
   ```
   or `npm run db:seed:neon`. This seeds categories, sample attractions, and all Maine attractions into Neon so the live site has them.

4. Commit the schema change and redeploy on Vercel. The serverless function will use `DATABASE_URL` and `JWT_SECRET` from the project’s Environment Variables.

---

## 5. Seed Neon (always after adding or changing attractions)

Whenever you add or update seed data (e.g. Maine attractions in `server/prisma/seed.ts`), run the seed **against Neon** so the live site has the data:

1. In `server/.env`, set `DATABASE_URL` to your **Neon** connection string (same value as in Vercel).
2. From the repo root run:
   ```bash
   npm run db:seed
   ```
   or `npm run db:seed:neon`. Existing records are skipped; new ones (e.g. new Maine attractions) are inserted.

---

## Quick checklist

- [ ] Generate JWT_SECRET (e.g. `openssl rand -base64 32`).
- [ ] Create a Neon (or Turso) database and copy the URL.
- [ ] If using Neon: change `provider` to `postgresql` in `schema.prisma`, then `prisma generate` and `prisma db push` (with Neon `DATABASE_URL`).
- [ ] In Vercel: add `DATABASE_URL` and `JWT_SECRET` under Settings → Environment Variables.
- [ ] **Run `npm run db:seed` with Neon as `DATABASE_URL` in server/.env** so production has categories and attractions (including Maine).
- [ ] Redeploy the project.
