import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { attractions, type Attraction } from "../api";

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
};

function stateSlug(stateCode: string): string {
  const name = STATE_NAMES[stateCode.toUpperCase()];
  if (!name) return stateCode.toLowerCase();
  return name.toLowerCase().replace(/\s+/g, "-");
}

type Props = {
  currentId: string;
  state?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  categories?: { id: string; name: string; slug: string }[];
};

/**
 * Renders "More in [State]" + "Nearby attractions" + "More [Category]" sections.
 *
 * The links here are first-class React Router links so they're crawled by
 * Google and clickable for users. This is the highest-leverage internal
 * linking on the site for SEO crawl-depth and per-page time.
 */
export function RelatedAttractions({
  currentId,
  state,
  latitude,
  longitude,
  categories,
}: Props) {
  const [nearby, setNearby] = useState<Attraction[] | null>(null);
  const [sameCategory, setSameCategory] = useState<Attraction[] | null>(null);
  const [moreInState, setMoreInState] = useState<Attraction[] | null>(null);

  const lat = latitude != null ? Number(latitude) : null;
  const lng = longitude != null ? Number(longitude) : null;

  useEffect(() => {
    let cancelled = false;
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      attractions
        .nearby(lat, lng, 50)
        .then((res) => {
          if (cancelled) return;
          setNearby(res.items.filter((a) => a.id !== currentId).slice(0, 6));
        })
        .catch(() => setNearby([]));
    } else {
      setNearby([]);
    }
    return () => {
      cancelled = true;
    };
  }, [currentId, lat, lng]);

  useEffect(() => {
    let cancelled = false;
    if (categories && categories.length > 0) {
      attractions
        .list({ category: categories[0].slug, limit: 8, sortBy: "rating", sortOrder: "desc" })
        .then((res) => {
          if (cancelled) return;
          setSameCategory(res.items.filter((a) => a.id !== currentId).slice(0, 6));
        })
        .catch(() => setSameCategory([]));
    } else {
      setSameCategory([]);
    }
    return () => {
      cancelled = true;
    };
  }, [currentId, categories]);

  useEffect(() => {
    let cancelled = false;
    if (state) {
      attractions
        .list({ state, limit: 8, sortBy: "rating", sortOrder: "desc" })
        .then((res) => {
          if (cancelled) return;
          setMoreInState(res.items.filter((a) => a.id !== currentId).slice(0, 6));
        })
        .catch(() => setMoreInState([]));
    } else {
      setMoreInState([]);
    }
    return () => {
      cancelled = true;
    };
  }, [currentId, state]);

  const stateName = state ? STATE_NAMES[state.toUpperCase()] ?? state : null;
  const primaryCategory = categories && categories.length > 0 ? categories[0] : null;

  // Don't render the whole section if every list is empty/loading.
  const anything =
    (nearby && nearby.length > 0) ||
    (sameCategory && sameCategory.length > 0) ||
    (moreInState && moreInState.length > 0);

  if (!anything) return null;

  return (
    <aside className="mt-12 pt-8 border-t border-lbx-border space-y-10">
      {nearby && nearby.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-lbx-white mb-4">
            Nearby roadside attractions
          </h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {nearby.map((a) => (
              <li key={a.id} className="text-sm">
                <Link
                  to={`/attraction/${a.id}`}
                  className="text-lbx-muted hover:text-lbx-green transition-colors"
                >
                  <span className="text-lbx-white">{a.name}</span>
                  {a.city && (
                    <span className="text-lbx-muted">
                      {" "}— {a.city}
                      {a.state ? `, ${a.state}` : ""}
                    </span>
                  )}
                  {a.distanceMiles != null && (
                    <span className="text-lbx-muted">
                      {" · "}
                      {a.distanceMiles.toFixed(1)} mi
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sameCategory && sameCategory.length > 0 && primaryCategory && (
        <section>
          <h2 className="text-lg font-semibold text-lbx-white mb-4">
            More {primaryCategory.name.toLowerCase()} attractions
          </h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {sameCategory.map((a) => (
              <li key={a.id} className="text-sm">
                <Link
                  to={`/attraction/${a.id}`}
                  className="text-lbx-muted hover:text-lbx-green transition-colors"
                >
                  <span className="text-lbx-white">{a.name}</span>
                  {a.city && (
                    <span className="text-lbx-muted">
                      {" "}— {a.city}
                      {a.state ? `, ${a.state}` : ""}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {moreInState && moreInState.length > 0 && stateName && (
        <section>
          <h2 className="text-lg font-semibold text-lbx-white mb-4">
            More in {stateName}
          </h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {moreInState.map((a) => (
              <li key={a.id} className="text-sm">
                <Link
                  to={`/attraction/${a.id}`}
                  className="text-lbx-muted hover:text-lbx-green transition-colors"
                >
                  <span className="text-lbx-white">{a.name}</span>
                  {a.city && (
                    <span className="text-lbx-muted">
                      {" "}— {a.city}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link
              to={`/best-roadside-attractions/${stateSlug(state!)}`}
              className="text-lbx-green hover:underline"
            >
              The best roadside attractions in {stateName} →
            </Link>
          </p>
        </section>
      )}
    </aside>
  );
}
