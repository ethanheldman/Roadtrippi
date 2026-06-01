import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { game as gameApi, type ArchivePuzzle } from "../api";

/**
 * Daily Detour — Archive. Lists every past puzzle (newest first) and lets you
 * play any of them. Each card shows your result for that day (read from the
 * same localStorage the game writes), so solved/missed/in-progress is visible
 * at a glance. Archive plays don't affect your daily streak.
 */

const PROGRESS_KEY = "rt-detour:progress";

type SavedStatus = "won" | "lost" | "playing";
type SavedProgress = { status: SavedStatus; guesses: { correct: boolean }[] };

function loadAllProgress(): Record<string, SavedProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SavedProgress>) : {};
  } catch {
    return {};
  }
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function GameArchive() {
  const [items, setItems] = useState<ArchivePuzzle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progress = useMemo(loadAllProgress, []);

  useEffect(() => {
    let cancelled = false;
    gameApi
      .archive()
      .then((res) => !cancelled && setItems(res.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the archive"));
    return () => {
      cancelled = true;
    };
  }, []);

  const playedCount = useMemo(
    () => (items ? items.filter((p) => progress[p.date]?.status === "won").length : 0),
    [items, progress]
  );

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lbx-white tracking-tight">
          Detour Archive
        </h1>
        <p className="text-lbx-muted mt-1 text-sm">
          Catch up on every past puzzle. Replays don&apos;t affect your streak.
        </p>
        <Link to="/game" className="inline-block mt-3 text-sm text-lbx-green hover:underline">
          ← Play today&apos;s puzzle
        </Link>
      </div>

      {error && <p className="text-center text-lbx-red">{error}</p>}

      {!items && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <p className="text-center text-lbx-muted text-sm">
          No past puzzles yet — today&apos;s is the very first. Check back tomorrow!
        </p>
      )}

      {items && items.length > 0 && (
        <>
          <p className="text-center text-lbx-muted/70 text-xs uppercase tracking-wider mb-4">
            {playedCount} of {items.length} solved
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((p) => {
              const saved = progress[p.date];
              const status = saved?.status;
              const guessCount = saved?.guesses?.length ?? 0;
              let badge: { text: string; cls: string };
              if (status === "won") {
                badge = { text: `Solved ${guessCount}/5`, cls: "text-lbx-green bg-lbx-green/10" };
              } else if (status === "lost") {
                badge = { text: "Missed", cls: "text-lbx-red bg-lbx-red/10" };
              } else if (status === "playing" && guessCount > 0) {
                badge = { text: "In progress", cls: "text-amber-400 bg-amber-400/10" };
              } else {
                badge = { text: "Play", cls: "text-lbx-muted bg-lbx-border/60" };
              }
              return (
                <li key={p.date}>
                  <Link
                    to={`/game/${p.date}`}
                    className="block rounded-lg border border-lbx-border bg-lbx-card p-4 hover:border-lbx-green/50 hover:bg-lbx-border/30 transition-colors h-full"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-lg text-lbx-white font-semibold">
                        No. {p.number}
                      </span>
                      {status === "won" && <span aria-hidden>✅</span>}
                    </div>
                    <div className="text-lbx-muted text-xs mt-0.5">{formatDate(p.date)}</div>
                    <span
                      className={`inline-block mt-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.cls}`}
                    >
                      {badge.text}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
