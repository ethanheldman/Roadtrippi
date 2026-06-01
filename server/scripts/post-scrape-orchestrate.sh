#!/bin/zsh
# Waits for the full RoadsideAmerica scrape to finish, then runs the post-scrape
# cleanup: dedup (name-based + source+basename) and a best-effort geocode pass.
# Launched in the background; logs to /tmp/post-scrape.log.
set -u
cd /Users/eheldman/Desktop/RoadsideBOXD/server

LOG=/tmp/post-scrape.log
echo "=== orchestrator started $(date) — waiting for scrape to finish ===" >>"$LOG"

# Poll until the scrape process is gone.
while pgrep -f "scripts/scrape.ts" >/dev/null 2>&1; do
  sleep 120
done

echo "=== scrape finished $(date) — running post-process ===" >>"$LOG"
echo "--- counts before ---" >>"$LOG"
node scripts/_count.mjs >>"$LOG" 2>&1 || true

echo "--- clean logo / junk images ---" >>"$LOG"
node scripts/clean-logo-images.mjs >>"$LOG" 2>&1 || echo "clean-logo failed" >>"$LOG"

echo "--- dedupe-attractions (name+state+city) ---" >>"$LOG"
npx tsx scripts/dedupe-attractions.ts >>"$LOG" 2>&1 || echo "dedupe-attractions failed" >>"$LOG"

echo "--- dedupe-by-source-basename ---" >>"$LOG"
npx tsx scripts/dedupe-by-source-basename.ts >>"$LOG" 2>&1 || echo "dedupe-by-source failed" >>"$LOG"

echo "--- classify every attraction into one correct type ---" >>"$LOG"
node scripts/classify-attractions.mjs >>"$LOG" 2>&1 || echo "classify failed" >>"$LOG"

echo "--- derive-state-from-image (any new US rows) ---" >>"$LOG"
node scripts/derive-state-from-image.mjs >>"$LOG" 2>&1 || echo "derive-state failed" >>"$LOG"

echo "--- geocode-with-city (best effort; Nominatim may 429) ---" >>"$LOG"
npx tsx scripts/geocode-with-city.ts >>"$LOG" 2>&1 || echo "geocode failed" >>"$LOG"

echo "--- counts after ---" >>"$LOG"
node scripts/_count.mjs >>"$LOG" 2>&1 || true
echo "=== orchestrator done $(date) ===" >>"$LOG"
