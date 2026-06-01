import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { attractions as attractionsApi, type Attraction } from "../api";
import { AttractionCard } from "../components/AttractionCard";

/**
 * Featured Lists — curated "Top" collections of attractions (by type and by
 * state), each a horizontal row that links to the full filtered/sorted grid on
 * Explore. Ranking is highest-rated (sort index 1 on Explore).
 */

const SHOWN = 18; // cards per row
const RATING_SORT = 1; // index into SORT_OPTIONS = "Highest rated"

type Collection = {
  title: string;
  blurb: string;
  params: { category?: string; state?: string };
};

const COLLECTIONS: Collection[] = [
  { title: "Top 25 Roadside Attractions", blurb: "The highest-rated stops in the whole country.", params: {} },
  { title: "Mighty Muffler Men", blurb: "Towering fiberglass giants from coast to coast.", params: { category: "muffler-man" } },
  { title: "World's Largest Everything", blurb: "Record-breaking oversized oddities.", params: { category: "worlds-largest" } },
  { title: "Marvelous Museums", blurb: "Gloriously niche roadside museums.", params: { category: "museums" } },
  { title: "Mystery Spots & Gravity Hills", blurb: "Where physics seems to take a day off.", params: { category: "mystery-spots" } },
  { title: "Giant Big Things", blurb: "Supersized statues and colossal curiosities.", params: { category: "big-things" } },
  { title: "Stupendous Statues", blurb: "Monuments to the weird and wonderful.", params: { category: "statues" } },
  { title: "Best of California", blurb: "The Golden State's greatest roadside hits.", params: { state: "CA" } },
  { title: "Best of Texas", blurb: "Everything's bigger — and stranger.", params: { state: "TX" } },
  { title: "Best of Florida", blurb: "Sunshine State spectacles.", params: { state: "FL" } },
];

function exploreLink(params: { category?: string; state?: string }): string {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.state) q.set("state", params.state);
  q.set("sort", String(RATING_SORT));
  return `/?${q.toString()}`;
}

function Row({ c }: { c: Collection }) {
  const [items, setItems] = useState<Attraction[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    attractionsApi
      .list({ ...c.params, sortBy: "rating", sortOrder: "desc", limit: 30 })
      .then((res) => {
        if (cancelled) return;
        const withImg = res.items.filter((a) => a.imageUrl && a.imageUrl.length > 0);
        setItems((withImg.length >= 6 ? withImg : res.items).slice(0, SHOWN));
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [c]);

  const to = exploreLink(c.params);
  return (
    <section className="mb-10">
      <div className="flex items-end justify-between mb-3 gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl text-lbx-white font-semibold">{c.title}</h2>
          <p className="text-lbx-muted text-sm">{c.blurb}</p>
        </div>
        <Link to={to} className="text-lbx-green text-sm hover:underline shrink-0">
          See all →
        </Link>
      </div>

      {!items ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-36 shrink-0 poster-aspect skeleton rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-lbx-muted text-sm">Nothing here yet — check back soon.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
          {items.map((a) => (
            <div key={a.id} className="w-36 sm:w-40 shrink-0 snap-start">
              <AttractionCard a={a} />
            </div>
          ))}
          <Link
            to={to}
            className="w-36 sm:w-40 shrink-0 poster-aspect rounded-lg border border-dashed border-lbx-border flex items-center justify-center text-lbx-green text-sm hover:border-lbx-green/60 transition-colors"
          >
            See all →
          </Link>
        </div>
      )}
    </section>
  );
}

export function FeaturedLists() {
  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-lbx-white tracking-tight">
          Featured Lists
        </h1>
        <p className="text-lbx-muted mt-1">
          Hand-picked collections of America's best roadside attractions.
        </p>
      </div>
      {COLLECTIONS.map((c) => (
        <Row key={c.title} c={c} />
      ))}
    </div>
  );
}
