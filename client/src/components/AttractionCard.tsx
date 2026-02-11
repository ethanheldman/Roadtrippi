import { Link } from "react-router-dom";
import type { Attraction } from "../api";

type AttractionCardProps = {
  a: Attraction;
};

export function AttractionCard({ a }: AttractionCardProps) {
  const imageUrl = a.imageUrl;
  const showRating = a.avgRating != null && a.avgRating > 0;
  const to = `/attraction/${a.id}`;

  return (
    <div className="group relative h-full">
      <Link
        to={to}
        className="block h-full cursor-pointer rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-lbx-green focus-visible:ring-offset-2 focus-visible:ring-offset-lbx-dark"
        aria-label={`View ${a.name}`}
      >
        <div className="h-full flex flex-col bg-lbx-card rounded-lg overflow-hidden border border-lbx-border hover:border-lbx-green/50 hover:shadow-card-hover transition-all duration-200 shadow-card">
          <div className="poster-aspect flex-shrink-0 w-full bg-lbx-border/80 relative overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center min-h-0 bg-lbx-border/80 text-lbx-muted/50">
                <span className="text-7xl sm:text-8xl md:text-9xl leading-none select-none" aria-hidden>🗿</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-3 py-2.5 flex items-center justify-between">
              {showRating && (
                <span className="text-base font-semibold text-amber-400 drop-shadow-sm">
                  ★ {a.avgRating}
                  {a.ratingCount != null && a.ratingCount > 0 && (
                    <span className="text-white/90 font-normal text-sm"> ({a.ratingCount})</span>
                  )}
                </span>
              )}
              {a.visitCount != null && a.visitCount > 0 && !showRating && (
                <span className="text-sm text-white/90">{a.visitCount} check-in{a.visitCount !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 p-3 min-h-[4.25rem] flex flex-col justify-center">
            <h3 className="font-display font-semibold text-lbx-white text-sm leading-tight line-clamp-2 group-hover:text-lbx-green transition-colors">
              {a.name}
            </h3>
            {/* Location: city, state; distance when user location available */}
            <div className="min-h-[2rem] mt-1.5 flex flex-col gap-0.5">
              {(a.city != null || a.state != null) && (
                <p className="text-xs text-lbx-muted truncate" title="Location">
                  {[a.city, a.state].filter(Boolean).join(", ")}
                </p>
              )}
              {a.distanceMiles != null && a.distanceMiles >= 0 && (
                <p className="text-xs text-lbx-green/90">
                  {a.distanceMiles < 0.1 ? "< 0.1" : a.distanceMiles.toFixed(1)} mi away
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
