import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  connections as connApi,
  type ConnectionsGame,
  type ConnTile,
} from "../api";

/**
 * Roadside Connections — find the four groups of four attractions that share a
 * trait (a keyword in the name). Four mistakes allowed. One puzzle per day,
 * locked server-side. Progress + result persist in localStorage and self-heal
 * via the puzzleKey if the day's puzzle ever changes.
 */

const LEVEL_COLORS = ["#f9df6d", "#a0c35a", "#b0c4ef", "#ba81c5"]; // NYT-ish: easy→hard
const LEVEL_EMOJI = ["🟨", "🟩", "🟦", "🟪"];
const PROGRESS_KEY = "rt-connections:progress";

type SolvedGroup = { key: string; label: string; level: number; ids: string[]; names: string[] };
type Status = "playing" | "won" | "lost";
type Progress = {
  date: string;
  puzzleKey: string;
  solved: SolvedGroup[];
  history: string[][]; // each past guess, as 4 tile ids
  mistakes: number;
  status: Status;
};

function loadProgress(date: string): Progress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Record<string, Progress>)[date] ?? null;
  } catch {
    return null;
  }
}
function saveProgress(p: Progress) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Progress>) : {};
    const trimmed: Record<string, Progress> = { [p.date]: p };
    Object.entries(all)
      .filter(([d]) => d !== p.date)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 60)
      .forEach(([d, v]) => (trimmed[d] = v));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export function Connections() {
  const [game, setGame] = useState<ConnectionsGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tiles, setTiles] = useState<ConnTile[]>([]); // unsolved, in display order
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<SolvedGroup[]>([]);
  const [history, setHistory] = useState<string[][]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [status, setStatus] = useState<Status>("playing");

  const [toast, setToast] = useState<string | null>(null);
  const [shakeIds, setShakeIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const maxMistakes = game?.maxMistakes ?? 4;
  const groupSize = game?.groupSize ?? 4;

  // ── Load + restore ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await connApi.today();
        if (cancelled) return;
        setGame(g);
        const saved = loadProgress(g.date);
        if (saved && saved.puzzleKey === g.puzzleKey) {
          setSolved(saved.solved);
          setHistory(saved.history);
          setMistakes(saved.mistakes);
          setStatus(saved.status);
          const solvedIds = new Set(saved.solved.flatMap((s) => s.ids));
          setTiles(g.tiles.filter((t) => !solvedIds.has(t.id)));
        } else {
          setTiles(g.tiles);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the puzzle");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const toggle = (id: string) => {
    if (status !== "playing" || busy) return;
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : sel.length >= groupSize ? sel : [...sel, id]
    );
  };

  const submit = useCallback(async () => {
    if (!game || status !== "playing" || selected.length !== groupSize || busy) return;
    setBusy(true);
    const guessIds = [...selected];
    try {
      const res = await connApi.guess(guessIds);
      const nextHistory = [...history, guessIds];
      setHistory(nextHistory);

      if (res.correct) {
        const names = guessIds.map((id) => tiles.find((t) => t.id === id)?.name ?? "");
        const group: SolvedGroup = {
          key: res.group.key,
          label: res.group.label,
          level: res.group.level,
          ids: res.group.ids,
          names: res.group.ids.map((id) => tiles.find((t) => t.id === id)?.name ?? names[0]),
        };
        const nextSolved = [...solved, group].sort((a, b) => a.level - b.level);
        const nextTiles = tiles.filter((t) => !group.ids.includes(t.id));
        setSolved(nextSolved);
        setTiles(nextTiles);
        setSelected([]);

        if (nextSolved.length === game.groupCount) {
          setStatus("won");
          saveProgress({ date: game.date, puzzleKey: game.puzzleKey, solved: nextSolved, history: nextHistory, mistakes, status: "won" });
        } else {
          saveProgress({ date: game.date, puzzleKey: game.puzzleKey, solved: nextSolved, history: nextHistory, mistakes, status: "playing" });
        }
      } else {
        const nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        setShakeIds(guessIds);
        setTimeout(() => setShakeIds([]), 500);
        if (res.oneAway) flashToast("So close — one away!");
        const lost = nextMistakes >= maxMistakes;
        if (lost) {
          // Reveal the remaining groups.
          try {
            const ans = await connApi.answer();
            const solvedKeys = new Set(solved.map((s) => s.key));
            const reveal = ans.groups
              .filter((g) => !solvedKeys.has(g.key))
              .map((g) => ({ key: g.key, label: g.label, level: g.level, ids: g.tiles.map((t) => t.id), names: g.tiles.map((t) => t.name) }));
            const full = [...solved, ...reveal].sort((a, b) => a.level - b.level);
            setSolved(full);
            setTiles([]);
            setStatus("lost");
            saveProgress({ date: game.date, puzzleKey: game.puzzleKey, solved: full, history: nextHistory, mistakes: nextMistakes, status: "lost" });
          } catch {
            setStatus("lost");
          }
        } else {
          setSelected([]);
          saveProgress({ date: game.date, puzzleKey: game.puzzleKey, solved, history: nextHistory, mistakes: nextMistakes, status: "playing" });
        }
      }
    } catch {
      flashToast("Couldn't check that — try again.");
    } finally {
      setBusy(false);
    }
  }, [game, status, selected, groupSize, busy, history, tiles, solved, mistakes, maxMistakes]);

  const shuffleTiles = () => setTiles((t) => [...t].sort(() => Math.random() - 0.5));

  // Share grid: each past guess as a row of 4 colored squares (by each tile's true group).
  const shareText = useMemo(() => {
    if (!game || status === "playing") return "";
    const levelOf = new Map<string, number>();
    solved.forEach((g) => g.ids.forEach((id) => levelOf.set(id, g.level)));
    const rows = history
      .map((guess) => guess.map((id) => LEVEL_EMOJI[levelOf.get(id) ?? 0]).join(""))
      .join("\n");
    const result = status === "won" ? `solved with ${mistakes} mistake${mistakes === 1 ? "" : "s"}` : "X";
    return `Roadside Connections #${game.number} (${result})\n${rows}\nroadtrippi.com/connections`;
  }, [game, status, history, solved, mistakes]);

  const handleShare = async () => {
    if (!shareText) return;
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* dismissed */
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <div className="skeleton h-9 w-72 mb-6 mx-auto" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !game) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <h1 className="font-display text-2xl text-lbx-white mb-2">Roadside Connections</h1>
        <p className="text-lbx-red">{error ?? "No puzzle available."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-10">
      <div className="text-center mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lbx-white tracking-tight">
          Roadside Connections
        </h1>
        <p className="text-lbx-muted mt-1 text-sm">
          Create four groups of four attractions that share a trait.
        </p>
        <p className="text-lbx-muted/70 mt-2 text-xs uppercase tracking-wider">
          No. {game.number} ·{" "}
          {new Date(game.date + "T00:00:00Z").toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
        <Link to="/game" className="inline-block mt-3 text-xs text-lbx-green hover:underline">
          ↩ Play Daily Detour instead
        </Link>
      </div>

      {/* Solved groups */}
      {solved.length > 0 && (
        <div className="space-y-2 mb-2">
          {solved.map((g) => (
            <div
              key={g.key}
              className="rounded-lg px-4 py-2.5 text-center"
              style={{ backgroundColor: LEVEL_COLORS[g.level] }}
            >
              <div className="font-bold text-sm uppercase tracking-wide text-[#222]">{g.label}</div>
              <div className="text-[#333] text-xs sm:text-sm">{g.names.join(", ")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tile grid */}
      {tiles.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-5">
          {tiles.map((t) => {
            const isSel = selected.includes(t.id);
            const isShake = shakeIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`aspect-square rounded-lg px-1 py-1 flex items-center justify-center text-center leading-tight transition-colors select-none ${
                  isSel
                    ? "bg-lbx-green/90 text-lbx-dark border-2 border-lbx-green"
                    : "bg-lbx-card border border-lbx-border text-lbx-white hover:border-lbx-muted"
                } ${isShake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
                style={{ fontSize: "clamp(8px, 2.3vw, 12px)", fontWeight: 600 }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Mistakes + controls */}
      {status === "playing" && (
        <>
          <div className="flex items-center justify-center gap-2 mb-4 text-sm text-lbx-muted">
            <span>Mistakes left:</span>
            <span className="flex gap-1.5">
              {Array.from({ length: maxMistakes }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full ${i < maxMistakes - mistakes ? "bg-lbx-muted" : "bg-lbx-border"}`}
                />
              ))}
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={shuffleTiles}
              className="px-4 py-2 rounded-full border border-lbx-border text-lbx-white text-sm hover:border-lbx-muted transition-colors"
            >
              Shuffle
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
              className="px-4 py-2 rounded-full border border-lbx-border text-lbx-white text-sm hover:border-lbx-muted transition-colors disabled:opacity-40"
            >
              Deselect all
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={selected.length !== groupSize || busy}
              className="px-5 py-2 rounded-full bg-lbx-green text-lbx-dark font-semibold text-sm hover:opacity-95 transition-opacity disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        </>
      )}

      {/* End state */}
      {status !== "playing" && (
        <div className="mt-5 rounded-xl border border-lbx-border bg-lbx-card p-5 text-center">
          <p className={`font-semibold text-lg ${status === "won" ? "text-lbx-green" : "text-lbx-red"}`}>
            {status === "won"
              ? mistakes === 0
                ? "🏆 Flawless! All four groups, no mistakes."
                : `🎉 Solved with ${mistakes} mistake${mistakes === 1 ? "" : "s"}!`
              : "Out of guesses — here's the solution."}
          </p>
          <button
            type="button"
            onClick={handleShare}
            className="mt-4 w-full bg-lbx-green text-lbx-dark font-semibold py-3 rounded-lg hover:opacity-95 transition-opacity uppercase text-sm tracking-wider"
          >
            {copied ? "Copied to clipboard!" : "Share result"}
          </button>
          <p className="mt-3 text-xs text-lbx-muted">
            New puzzle daily · <Link to="/game" className="text-lbx-green hover:underline">try Daily Detour →</Link>
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-10 z-40 bg-lbx-white text-lbx-dark text-sm font-semibold px-4 py-2 rounded-full shadow-card-hover">
          {toast}
        </div>
      )}
    </div>
  );
}
