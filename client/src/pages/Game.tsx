import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  attractions as attractionsApi,
  game as gameApi,
  type Attraction,
  type DailyGame,
  type GameAnswer,
  type GameClue,
} from "../api";
import { AttractionImage } from "../components/AttractionImage";

/**
 * Daily Detour — a once-a-day, Pinpoint-style guessing game for roadside
 * attractions on the site. One mystery stop per day (same for everyone). Five
 * clues unlock one at a time, broad → giveaway; you get five guesses. The
 * answer is validated server-side and only revealed once the game is over.
 *
 * Progress + streak stats persist in localStorage so a refresh never resets
 * the day, and coming back after midnight ET starts a fresh puzzle.
 */

type GuessRow = { id: string; name: string; correct: boolean };
type Status = "playing" | "won" | "lost";
type Progress = {
  date: string;
  /** Fingerprint of the puzzle this progress belongs to; if the day's answer changes, this won't match. */
  puzzleKey?: string;
  guesses: GuessRow[];
  status: Status;
  revealed: number;
  statsCounted?: boolean;
};
type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  dist: number[]; // dist[n] = games won on the nth guess (1-indexed; dist[0] unused)
  lastDate: string | null;
};

const PROGRESS_KEY = "rt-detour:progress";
const STATS_KEY = "rt-detour:stats";

const EMPTY_STATS: Stats = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  dist: [0, 0, 0, 0, 0, 0],
  lastDate: null,
};

function loadProgress(date: string): Progress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, Progress>;
    return all[date] ?? null;
  } catch {
    return null;
  }
}

function saveProgress(p: Progress) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Progress>) : {};
    // Keep a long history so the archive can show past results / resume games.
    const trimmed: Record<string, Progress> = { [p.date]: p };
    Object.entries(all)
      .filter(([d]) => d !== p.date)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 730)
      .forEach(([d, v]) => (trimmed[d] = v));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };
    return { ...EMPTY_STATS, ...(JSON.parse(raw) as Stats) };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function prevDate(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function recordStats(date: string, won: boolean, guessCount: number): Stats {
  const stats = loadStats();
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    if (guessCount >= 1 && guessCount <= 5) stats.dist[guessCount] += 1;
    stats.currentStreak = stats.lastDate === prevDate(date) ? stats.currentStreak + 1 : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }
  stats.lastDate = date;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
  return stats;
}

/** Live ms until the next midnight in US Eastern time (when the puzzle rolls over). */
function msUntilNextEtMidnight(): number {
  const now = new Date();
  const etNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const next = new Date(etNow);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - etNow.getTime());
}

function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function clueIcon(type: GameClue["type"]): string {
  switch (type) {
    case "category":
      return "🏷️";
    case "state":
      return "🗺️";
    case "description":
      return "📝";
    case "city":
      return "📍";
    case "image":
      return "📸";
    default:
      return "❔";
  }
}

export function Game() {
  // When present, we're playing an archived puzzle for this date instead of today.
  const { date: archiveDate } = useParams<{ date: string }>();
  const isArchive = !!archiveDate;

  const [daily, setDaily] = useState<DailyGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [revealed, setRevealed] = useState(1);
  const [status, setStatus] = useState<Status>("playing");
  const [answer, setAnswer] = useState<GameAnswer | null>(null);
  const [stats, setStats] = useState<Stats>(loadStats);

  // Autocomplete
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Attraction[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [countdown, setCountdown] = useState(() => msUntilNextEtMidnight());
  const [copied, setCopied] = useState(false);

  // ── Load the puzzle (today or an archive date) + restore saved progress ──
  useEffect(() => {
    // Reset so navigating between archive games doesn't leak prior state.
    setLoading(true);
    setError(null);
    setDaily(null);
    setGuesses([]);
    setRevealed(1);
    setStatus("playing");
    setAnswer(null);
    setQuery("");
    setResults([]);
    let cancelled = false;
    (async () => {
      try {
        const d = await gameApi.daily(archiveDate);
        if (cancelled) return;
        setDaily(d);
        const saved = loadProgress(d.date);
        // Self-heal: only restore progress that belongs to THIS exact puzzle.
        // If the day's answer changed (e.g. the pool shifted during a scrape),
        // the stored puzzleKey won't match — start fresh instead of showing a
        // stale "you won" against a different attraction.
        if (saved && saved.puzzleKey === d.puzzleKey) {
          setGuesses(saved.guesses);
          setRevealed(saved.revealed);
          setStatus(saved.status);
          if (saved.status !== "playing") {
            gameApi.answer(archiveDate).then((a) => !cancelled && setAnswer(a)).catch(() => {});
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load that puzzle");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [archiveDate]);

  // Countdown ticker (only meaningful once the game is over).
  useEffect(() => {
    if (status === "playing") return;
    const id = setInterval(() => setCountdown(msUntilNextEtMidnight()), 1000);
    return () => clearInterval(id);
  }, [status]);

  // ── Autocomplete search (debounced) ─────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await attractionsApi.list({ search: q, limit: 8, sortBy: "name" });
        setResults(res.items);
        setHighlight(0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const alreadyGuessed = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses]);

  const submitGuess = useCallback(
    async (attraction: { id: string; name: string }) => {
      if (!daily || status !== "playing") return;
      if (alreadyGuessed.has(attraction.id)) {
        setQuery("");
        setResults([]);
        return;
      }
      setQuery("");
      setResults([]);

      let correct = false;
      try {
        const res = await gameApi.guess(attraction.id, archiveDate);
        correct = res.correct;
      } catch {
        setError("Couldn't check that guess — try again.");
        return;
      }

      const nextGuesses = [...guesses, { id: attraction.id, name: attraction.name, correct }];
      setGuesses(nextGuesses);

      let nextStatus: Status = "playing";
      let nextRevealed = revealed;
      if (correct) {
        nextStatus = "won";
        nextRevealed = daily.totalClues;
      } else if (nextGuesses.length >= daily.maxGuesses) {
        nextStatus = "lost";
        nextRevealed = daily.totalClues;
      } else {
        nextRevealed = Math.min(daily.totalClues, revealed + 1);
      }
      setRevealed(nextRevealed);
      setStatus(nextStatus);

      const progress: Progress = {
        date: daily.date,
        puzzleKey: daily.puzzleKey,
        guesses: nextGuesses,
        status: nextStatus,
        revealed: nextRevealed,
        statsCounted: nextStatus !== "playing",
      };
      saveProgress(progress);

      if (nextStatus !== "playing") {
        // Streak/stats only count the live daily — archive replays don't.
        if (!isArchive) setStats(recordStats(daily.date, nextStatus === "won", nextGuesses.length));
        gameApi.answer(archiveDate).then(setAnswer).catch(() => {});
      }
    },
    [daily, status, alreadyGuessed, guesses, revealed, archiveDate, isArchive]
  );

  const giveUp = useCallback(() => {
    if (!daily || status !== "playing") return;
    setStatus("lost");
    setRevealed(daily.totalClues);
    saveProgress({
      date: daily.date,
      puzzleKey: daily.puzzleKey,
      guesses,
      status: "lost",
      revealed: daily.totalClues,
      statsCounted: true,
    });
    if (!isArchive) setStats(recordStats(daily.date, false, guesses.length));
    gameApi.answer(archiveDate).then(setAnswer).catch(() => {});
  }, [daily, status, guesses, archiveDate, isArchive]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[highlight] ?? results[0];
      if (pick) submitGuess(pick);
    }
  };

  const shareText = useMemo(() => {
    if (!daily || status === "playing") return "";
    const squares = Array.from({ length: daily.maxGuesses }, (_, i) => {
      const g = guesses[i];
      if (!g) return "⬛";
      return g.correct ? "🟩" : "🟥";
    }).join("");
    const result = status === "won" ? `${guesses.length}/${daily.maxGuesses}` : `X/${daily.maxGuesses}`;
    return `Daily Detour #${daily.number} ${result}\n${squares}\nroadtrippi.com/game`;
  }, [daily, status, guesses]);

  const handleShare = async () => {
    if (!shareText) return;
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed share sheet — ignore */
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="skeleton h-10 w-64 mb-6" />
        <div className="skeleton h-24 w-full mb-3" />
        <div className="skeleton h-24 w-full mb-3" />
        <div className="skeleton h-12 w-full" />
      </div>
    );
  }

  if (error || !daily) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="font-display text-2xl text-lbx-white mb-2">Daily Detour</h1>
        <p className="text-lbx-red">{error ?? "No puzzle available right now."}</p>
      </div>
    );
  }

  const guessesLeft = daily.maxGuesses - guesses.length;
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10">
      {/* Header */}
      <div className="text-center mb-8">
        {isArchive && (
          <div className="mb-3 flex items-center justify-center gap-4 text-xs">
            <Link to="/game/archive" className="text-lbx-muted hover:text-lbx-green transition-colors">
              ← Archive
            </Link>
            <span className="text-lbx-green/80 bg-lbx-green/10 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
              Archive
            </span>
            <Link to="/game" className="text-lbx-muted hover:text-lbx-green transition-colors">
              Today&apos;s puzzle →
            </Link>
          </div>
        )}
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lbx-white tracking-tight">
          Daily Detour
        </h1>
        <p className="text-lbx-muted mt-1 text-sm">
          Guess the mystery roadside attraction. A new clue unlocks with every miss.
        </p>
        <p className="text-lbx-muted/70 mt-2 text-xs uppercase tracking-wider">
          No. {daily.number} ·{" "}
          {new Date(daily.date + "T00:00:00Z").toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
        {!isArchive && (
          <div className="mt-3 flex items-center justify-center gap-4 text-xs">
            <Link to="/game/archive" className="text-lbx-green hover:underline">
              ↩ Past puzzles
            </Link>
            <Link to="/connections" className="text-lbx-green hover:underline">
              Roadside Connections →
            </Link>
          </div>
        )}
      </div>

      {/* Clues */}
      <ol className="space-y-3 mb-6">
        {daily.clues.map((clue, i) => {
          const isRevealed = i < revealed;
          const isLatest = isRevealed && i === revealed - 1 && status === "playing";
          return (
            <li
              key={clue.type}
              className={`rounded-lg border transition-all duration-300 ${
                isRevealed
                  ? isLatest
                    ? "border-lbx-green/60 bg-lbx-card shadow-card"
                    : "border-lbx-border bg-lbx-card"
                  : "border-lbx-border/50 bg-lbx-dark/40"
              }`}
            >
              {isRevealed ? (
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-lbx-muted mb-1.5">
                    <span aria-hidden>{clueIcon(clue.type)}</span>
                    <span>
                      Clue {i + 1} · {clue.label}
                    </span>
                  </div>
                  {clue.type === "image" ? (
                    <div className="rounded-md overflow-hidden border border-lbx-border bg-lbx-dark aspect-video max-h-72 flex items-center justify-center">
                      <AttractionImage
                        imageUrl={clue.value}
                        alt="Mystery attraction"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <p className="text-lbx-white text-lg leading-snug">{clue.value}</p>
                  )}
                </div>
              ) : (
                <div className="p-4 flex items-center gap-2 text-lbx-muted/60 text-sm select-none">
                  <span aria-hidden>🔒</span>
                  <span>Clue {i + 1} — unlocks with your next guess</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Guess input */}
      {status === "playing" && (
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Name that attraction…"
              autoComplete="off"
              aria-label="Guess the attraction"
              className="w-full px-4 py-3 rounded-lg bg-lbx-dark border border-lbx-border text-lbx-white placeholder-lbx-muted focus:outline-none focus:border-lbx-green focus:ring-1 focus:ring-lbx-green/40 transition-colors"
            />
            {(results.length > 0 || (searching && query.trim().length >= 2)) && (
              <ul className="absolute z-30 mt-1 w-full bg-lbx-card border border-lbx-border rounded-lg shadow-card-hover overflow-hidden max-h-72 overflow-y-auto">
                {searching && results.length === 0 && (
                  <li className="px-4 py-2.5 text-sm text-lbx-muted">Searching…</li>
                )}
                {results.map((r, idx) => {
                  const guessed = alreadyGuessed.has(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={guessed}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => submitGuess(r)}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                          idx === highlight ? "bg-lbx-border/70" : ""
                        } ${guessed ? "opacity-40 cursor-not-allowed" : "hover:bg-lbx-border/70"}`}
                      >
                        <span className="text-lbx-white text-sm truncate">{r.name}</span>
                        <span className="text-lbx-muted text-xs shrink-0">
                          {r.city ? `${r.city}, ` : ""}
                          {r.state}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Guesses-left dots */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5" aria-label={`${guessesLeft} guesses left`}>
              {Array.from({ length: daily.maxGuesses }, (_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${
                    i < guesses.length ? "bg-lbx-red/70" : "bg-lbx-border"
                  }`}
                />
              ))}
              <span className="text-xs text-lbx-muted ml-2">
                {guessesLeft} {guessesLeft === 1 ? "guess" : "guesses"} left
              </span>
            </div>
            <button
              type="button"
              onClick={giveUp}
              className="text-xs text-lbx-muted hover:text-lbx-red transition-colors"
            >
              Give up
            </button>
          </div>
        </div>
      )}

      {/* Previous (wrong) guesses */}
      {guesses.length > 0 && (
        <ul className="space-y-2 mb-6">
          {guesses.map((g, i) => (
            <li
              key={`${g.id}-${i}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm ${
                g.correct
                  ? "border-lbx-green/50 bg-lbx-green/10 text-lbx-white"
                  : "border-lbx-border bg-lbx-card text-lbx-muted"
              }`}
            >
              <span aria-hidden>{g.correct ? "✅" : "❌"}</span>
              <span className={g.correct ? "text-lbx-white" : "line-through"}>{g.name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* End state: reveal + share + stats */}
      {status !== "playing" && (
        <div className="rounded-xl border border-lbx-border bg-lbx-card overflow-hidden">
          <div className="p-5 text-center border-b border-lbx-border">
            {status === "won" ? (
              <p className="text-lbx-green font-semibold text-lg">
                🎉 Got it in {guesses.length} {guesses.length === 1 ? "guess" : "guesses"}!
              </p>
            ) : (
              <p className="text-lbx-red font-semibold text-lg">
                Out of guesses — {isArchive ? "try another!" : "better luck tomorrow!"}
              </p>
            )}
          </div>

          {answer ? (
            <Link
              to={`/attraction/${answer.id}`}
              className="flex items-center gap-4 p-5 hover:bg-lbx-border/30 transition-colors"
            >
              <div className="h-20 w-20 shrink-0 rounded-md overflow-hidden border border-lbx-border bg-lbx-dark">
                <AttractionImage
                  imageUrl={answer.imageUrl}
                  alt={answer.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-lbx-muted mb-0.5">
                  {isArchive ? "The attraction" : "Today's attraction"}
                </p>
                <p className="font-display text-xl text-lbx-white font-semibold truncate">
                  {answer.name}
                </p>
                <p className="text-lbx-muted text-sm">
                  {answer.city ? `${answer.city}, ` : ""}
                  {answer.state}
                </p>
                <span className="text-lbx-green text-sm">View full page →</span>
              </div>
            </Link>
          ) : (
            <div className="p-5 text-lbx-muted text-sm">Loading the reveal…</div>
          )}

          {/* Share */}
          <div className="px-5 pb-5">
            <button
              type="button"
              onClick={handleShare}
              className="w-full bg-lbx-green text-lbx-dark font-semibold py-3 rounded-lg hover:opacity-95 transition-opacity uppercase text-sm tracking-wider"
            >
              {copied ? "Copied to clipboard!" : "Share result"}
            </button>
            {isArchive ? (
              <p className="text-center text-xs mt-3">
                <Link to="/game/archive" className="text-lbx-green hover:underline">
                  ← Back to the archive
                </Link>
              </p>
            ) : (
              <p className="text-center text-lbx-muted text-xs mt-3">
                Next detour in <span className="text-lbx-white font-mono">{formatCountdown(countdown)}</span>
              </p>
            )}
          </div>

          {/* Stats — the streak only tracks the live daily, so hide it on archive replays. */}
          {!isArchive && (
            <div className="border-t border-lbx-border px-5 py-4 grid grid-cols-4 gap-2 text-center">
              <Stat label="Played" value={stats.played} />
              <Stat label="Win %" value={winPct} />
              <Stat label="Streak" value={stats.currentStreak} />
              <Stat label="Max" value={stats.maxStreak} />
            </div>
          )}
        </div>
      )}

      {/* How to play (only while fresh) */}
      {status === "playing" && guesses.length === 0 && (
        <p className="text-center text-lbx-muted/70 text-xs mt-8 max-w-md mx-auto">
          You&apos;ve got one clue and five guesses. Each wrong guess reveals another clue —
          solve it in as few as possible, then share your streak.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold text-lbx-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-lbx-muted">{label}</div>
    </div>
  );
}
