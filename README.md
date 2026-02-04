# Roadtrippi

A Letterboxd-style app for roadside attractions: discover, rate, review, and share visits to America's weirdest roadside oddities.

## Quick start (no Docker or extra installs)

Uses **SQLite** by default—everything runs locally with no database server.

### 1. Backend

```bash
cd server
cp .env.example .env   # optional; .env already points to SQLite
npm install
npx prisma db push     # creates prisma/dev.db
npx prisma db seed     # adds 20 sample attractions
npm run dev
```

The API runs at **http://localhost:3001**.

### 2. Frontend

In a new terminal:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Share with a friend (sendable link)

To get a link your friend can open from anywhere:

1. **Keep the app running**: In one terminal, run `npm run dev` (or run the server and client separately) so the app is at http://localhost:5173.
2. **Start a tunnel**: In a **second terminal** (from the project root), run:
   ```bash
   npm run tunnel
   ```
3. **Copy the URL** it prints (e.g. `https://something.loca.lt`). Send that link to your friend.
4. **First visit**: Your friend may see a “Click to continue” or “Enter password” page. If it asks for a password, get it from the machine where the tunnel is running:
   ```bash
   curl https://loca.lt/mytunnelpassword
   ```
   (Or `wget -q -O - https://loca.lt/mytunnelpassword`.) Share that value with your friend to paste into the prompt.
5. **Link is temporary**: It only works while your dev server and the tunnel are running. Stop the tunnel with `Ctrl+C` when you’re done.

**Alternative:** If you have [ngrok](https://ngrok.com/) installed, run `ngrok http 5173` and use the HTTPS URL it gives you.

## What's included

- **Backend**: Node.js, TypeScript, Fastify, Prisma, SQLite (default), JWT auth
- **Frontend**: React, Vite, TypeScript, React Router, Tailwind CSS — **Letterboxd-style** dark theme, green accent, poster-style grid
- **Features**: Browse attractions, search/filter by state, attraction detail pages, user signup/login, check-ins (rate + review + visit date), profile with recent check-ins
- **Seed data**: 20 sample attractions; optional **scraper** for RoadsideAmerica.com (thousands of attractions)

## Scrape RoadsideAmerica.com data

To fetch **all** attraction data from RoadsideAmerica.com (rate-limited, respectful):

```bash
cd server
npm install   # ensures axios, cheerio
npx prisma db push   # apply schema (adds imageUrl if needed)
npm run scrape       # writes scripts/data/scraped.json (~thousands of attractions)
npm run scrape -- --db   # same, then imports into database
```

Scraping is slow (~4.5s per page). Check the site’s Terms of Service before running at scale; consider contacting them for a data partnership.

## Scripts (from repo root)

| Command | Description |
|--------|-------------|
| `npm run dev` | Run backend and frontend together |
| `npm run dev:server` | Backend only (port 3001) |
| `npm run dev:client` | Frontend only (port 5173) |
| `npm run db:push` | Apply Prisma schema to DB |
| `npm run db:seed` | Seed sample attractions |
| `npm run db:studio` | Open Prisma Studio |
| `cd server && npm run scrape` | Scrape RoadsideAmerica.com (optional `-- --db` to import) |
| `npm run tunnel` | Expose local app at a public URL (run while `npm run dev` is running) |

## Environment

- **server/.env**: `DATABASE_URL="file:./prisma/dev.db"` (SQLite, default). No other installs needed. For Postgres later, set `DATABASE_URL` to your Postgres URL and switch the Prisma schema provider to `postgresql`.

## Next steps (from spec)

- Social features (follow, activity feed, likes, comments)
- Lists and trip planning (route builder)
- Badges and gamification
- Map view with nearby attractions
- Mobile app (React Native/Expo)
