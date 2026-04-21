import { useEffect, useState } from "react";
import { users } from "../api";

type EarnedBadge = { slug: string; title: string; description: string; emoji: string };

/**
 * Small badge shelf for a profile. Fetches /api/users/:id/badges and shows
 * earned badges with hover tooltips. If none are earned yet, renders nothing
 * rather than cluttering the profile with empty state.
 */
export function BadgeShelf({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [items, setItems] = useState<EarnedBadge[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    users
      .badges(userId)
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!items || items.length === 0) return null;

  return (
    <section className={compact ? "mt-4" : "mt-6"}>
      <h3 className="font-display font-semibold text-sm text-lbx-white mb-2 tracking-tight">
        Badges
      </h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((b) => (
          <li
            key={b.slug}
            title={`${b.title} — ${b.description}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lbx-card border border-lbx-border text-xs text-lbx-text hover:border-lbx-green/60 transition-colors cursor-default"
          >
            <span aria-hidden className="text-sm leading-none">{b.emoji}</span>
            <span className="font-medium">{b.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
