# Data recovery: getting all attractions back

**What happened:** The app used to show ~170 pages of attractions (24 per page ≈ 4,000+). That data lived in:

1. **Database:** `prisma/dev.db` (SQLite)
2. **Source file:** `scripts/data/scraped.json` (used by `import-scraped`)

If the database was reset, or `scraped.json` was overwritten by a smaller run (e.g. one state or `--limit 200`), you end up with only a few hundred attractions and ~11 pages.

**Current state:**  
- `scraped.json` in this repo has only **169** entries (likely from a limited or single-state scrape).  
- We imported that into the DB, so you see ~11 pages until the full scrape is run again.

---

## How to get ~170 pages back (full Roadside America dataset)

Re-scrape **all states** and write straight into the database. From the **server** directory:

```bash
cd server
npm run scrape:full
```

- **What it does:** Hits every state on RoadsideAmerica.com, fetches every story/tip, and saves each attraction into the DB as it goes. Also overwrites `scripts/data/scraped.json` with the full list when done.
- **Time:** Rate limit is ~4.5 s per request. For ~4,000+ items this can take **5+ hours**. Run it in a terminal you can leave open (or in `screen`/`tmux`).
- **Backup first (optional):** Copy `prisma/dev.db` and `scripts/data/scraped.json` somewhere safe before running, in case you need to revert.

After it finishes:

- The app will show all attractions (full page count).
- Attractions without coordinates won’t appear on the **map** until you geocode them:

  ```bash
  npm run geocode-attractions
  ```

  (Or run with `STATE=...` for specific states; see `geocode-attractions.ts`.)

---

## If you have a backup

- **Backup of `prisma/dev.db`:** Stop the app, replace `server/prisma/dev.db` with your backup, then restart. No need to re-import.
- **Backup of `scraped.json`** (with thousands of entries): Put it at `server/scripts/data/scraped.json`, then from `server` run:

  ```bash
  SKIP_GEOCODE=1 npm run import-scraped
  ```

  Then run `npm run geocode-attractions` (optionally with `STATE=...`) to fill in coordinates for the map.
