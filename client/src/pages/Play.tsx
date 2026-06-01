import { Link } from "react-router-dom";

/**
 * Play hub — the landing page for Roadtrippi's daily games. Both games live
 * here under "Play" (no separate top-nav entry per game).
 */

type GameCard = {
  to: string;
  emoji: string;
  title: string;
  blurb: string;
  cta: string;
  secondary?: { to: string; label: string };
};

const GAMES: GameCard[] = [
  {
    to: "/game",
    emoji: "📸",
    title: "Daily Detour",
    blurb: "Guess today's mystery roadside attraction. A new clue unlocks with every miss — solve it in as few guesses as you can.",
    cta: "Play today's puzzle",
    secondary: { to: "/game/archive", label: "Past puzzles" },
  },
  {
    to: "/connections",
    emoji: "🧩",
    title: "Roadside Connections",
    blurb: "Sort 16 attractions into four groups of four that share a trait. Watch for the red herrings — you get four mistakes.",
    cta: "Play today's puzzle",
  },
  {
    to: "/geo",
    emoji: "🌎",
    title: "Where in the USA?",
    blurb: "See an attraction and drop a pin on the map where you think it is. Five rounds, scored by distance — how well do you know the country?",
    cta: "Start guessing",
  },
];

export function Play() {
  return (
    <div className="max-w-3xl mx-auto py-8 sm:py-12">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lbx-white tracking-tight">
          Play
        </h1>
        <p className="text-lbx-muted mt-1 text-sm">
          Daily games built from real roadside attractions on the site.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {GAMES.map((g) => (
          <div
            key={g.to}
            className="rounded-xl border border-lbx-border bg-lbx-card p-6 flex flex-col"
          >
            <div className="text-4xl mb-3" aria-hidden>
              {g.emoji}
            </div>
            <h2 className="font-display text-xl text-lbx-white font-semibold">{g.title}</h2>
            <p className="text-lbx-muted text-sm mt-1 flex-1">{g.blurb}</p>
            <div className="mt-4 flex items-center gap-4">
              <Link
                to={g.to}
                className="bg-lbx-green text-lbx-dark font-semibold px-4 py-2 rounded-lg hover:opacity-95 transition-opacity text-sm"
              >
                {g.cta}
              </Link>
              {g.secondary && (
                <Link to={g.secondary.to} className="text-lbx-green text-sm hover:underline">
                  {g.secondary.label} →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
