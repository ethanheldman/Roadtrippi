import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { attractions, type Attraction } from "../api";
import { AttractionCard } from "../components/AttractionCard";
import { CardGridSkeleton } from "../components/CardSkeleton";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

function stateFromSlug(slug: string): { code: string; name: string } | null {
  const lower = slug.toLowerCase().replace(/-/g, " ");
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    if (name.toLowerCase() === lower || code.toLowerCase() === lower) {
      return { code, name };
    }
  }
  return null;
}

function stateSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function BestOfState() {
  const { state } = useParams<{ state: string }>();
  const stateInfo = state ? stateFromSlug(state) : null;
  const [items, setItems] = useState<Attraction[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stateInfo) return;
    let cancelled = false;
    attractions
      .list({
        state: stateInfo.code,
        limit: 25,
        sortBy: "rating",
        sortOrder: "desc",
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [stateInfo?.code]);

  // Page-title + meta updates for the SPA-side render. The server already
  // injects these for crawlers — this just keeps things tidy on client nav.
  useEffect(() => {
    if (!stateInfo) return;
    const year = new Date().getFullYear();
    document.title = `The 25 Best Roadside Attractions in ${stateInfo.name} (${year}) — Roadtrippi`;
    return () => {
      document.title = "Roadtrippi";
    };
  }, [stateInfo?.name]);

  if (state && !stateInfo) {
    // Unknown state slug — bounce to homepage
    return <Navigate to="/" replace />;
  }
  if (!stateInfo) return null;

  const year = new Date().getFullYear();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <Link to="/" className="text-sm text-lbx-muted hover:text-lbx-green transition-colors">
          ← Back to home
        </Link>
      </div>

      <header className="mb-8 max-w-3xl">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lbx-white leading-tight">
          The 25 Best Roadside Attractions in {stateInfo.name} ({year})
        </h1>
        <p className="mt-3 text-lbx-muted">
          Ranked by Roadtrippi users — the people who&apos;ve actually been there.
          {total != null && total > 25 && (
            <>
              {" "}
              {stateInfo.name} has {total} attractions total.
            </>
          )}
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-400">Couldn&apos;t load attractions: {error}</p>
      )}

      {!items ? (
        <CardGridSkeleton count={12} />
      ) : items.length === 0 ? (
        <p className="text-lbx-muted">
          No attractions in {stateInfo.name} yet. Submit one!
        </p>
      ) : (
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((a, i) => (
            <li key={a.id} className="relative">
              <span
                aria-hidden
                className="absolute top-2 left-2 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full bg-lbx-dark/80 backdrop-blur-sm border border-lbx-border text-lbx-white font-display font-bold text-sm"
              >
                {i + 1}
              </span>
              <AttractionCard a={a} />
            </li>
          ))}
        </ol>
      )}

      {total != null && total > 25 && (
        <div className="mt-10 text-center">
          <Link
            to={`/?state=${stateInfo.code}`}
            className="inline-flex items-center px-5 py-2.5 border border-lbx-border text-lbx-muted hover:border-lbx-green hover:text-lbx-white transition-colors rounded-md text-sm"
          >
            See all {total} attractions in {stateInfo.name} →
          </Link>
        </div>
      )}

      <nav className="mt-16 pt-8 border-t border-lbx-border">
        <h2 className="text-sm font-semibold text-lbx-white mb-4 uppercase tracking-wide">
          More state guides
        </h2>
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-sm">
          {Object.values(STATE_NAMES)
            .filter((n) => n !== stateInfo.name)
            .map((n) => (
              <li key={n}>
                <Link
                  to={`/best-roadside-attractions/${stateSlug(n)}`}
                  className="text-lbx-muted hover:text-lbx-green transition-colors"
                >
                  {n}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}
