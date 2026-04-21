/**
 * Badge catalogue. Badges are derived from a user's existing check-ins, so we don't
 * need a new table or award-write pipeline — just compute what's earned each time
 * a profile is loaded.
 *
 * Adding a new badge: add an entry here with a `check(ctx)` fn. The ctx is shaped
 * in routes/users.ts; keep it compact so new badges don't force N+1 queries.
 */

export type BadgeContext = {
  totalCheckIns: number;
  distinctStates: number;
  distinctCategories: number;
  fiveStarCheckIns: number;
  reviewedCheckIns: number; // check-ins that include a written review
  maxCheckInsInDay: number;
  earliestVisitYearsAgo: number | null;
};

export type BadgeDef = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  check: (ctx: BadgeContext) => boolean;
};

export const BADGES: BadgeDef[] = [
  {
    slug: "first-check-in",
    title: "First Check-in",
    description: "You checked in to your first attraction.",
    emoji: "📍",
    check: (c) => c.totalCheckIns >= 1,
  },
  {
    slug: "ten-check-ins",
    title: "On the Road",
    description: "Checked in at 10 attractions.",
    emoji: "🚗",
    check: (c) => c.totalCheckIns >= 10,
  },
  {
    slug: "fifty-check-ins",
    title: "Seasoned Tripper",
    description: "Checked in at 50 attractions.",
    emoji: "🛣️",
    check: (c) => c.totalCheckIns >= 50,
  },
  {
    slug: "hundred-check-ins",
    title: "Centurion",
    description: "Checked in at 100 attractions.",
    emoji: "💯",
    check: (c) => c.totalCheckIns >= 100,
  },
  {
    slug: "three-states",
    title: "Border Crosser",
    description: "Checked in across 3 states.",
    emoji: "🗺️",
    check: (c) => c.distinctStates >= 3,
  },
  {
    slug: "ten-states",
    title: "Coast to Coast",
    description: "Checked in across 10 states.",
    emoji: "🌎",
    check: (c) => c.distinctStates >= 10,
  },
  {
    slug: "reviewer",
    title: "Reviewer",
    description: "Wrote 5 reviews.",
    emoji: "✍️",
    check: (c) => c.reviewedCheckIns >= 5,
  },
  {
    slug: "critic",
    title: "Critic",
    description: "Wrote 25 reviews.",
    emoji: "📝",
    check: (c) => c.reviewedCheckIns >= 25,
  },
  {
    slug: "five-star-fan",
    title: "Five-Star Fan",
    description: "Gave 10 five-star ratings.",
    emoji: "⭐",
    check: (c) => c.fiveStarCheckIns >= 10,
  },
  {
    slug: "variety-seeker",
    title: "Variety Seeker",
    description: "Visited 5 different categories of attraction.",
    emoji: "🎯",
    check: (c) => c.distinctCategories >= 5,
  },
  {
    slug: "road-warrior-day",
    title: "Road Warrior",
    description: "3 check-ins in a single day.",
    emoji: "⚡",
    check: (c) => c.maxCheckInsInDay >= 3,
  },
  {
    slug: "veteran",
    title: "Veteran",
    description: "Earliest check-in is over a year old.",
    emoji: "🏅",
    check: (c) => c.earliestVisitYearsAgo != null && c.earliestVisitYearsAgo >= 1,
  },
];

export function computeEarnedBadges(ctx: BadgeContext): BadgeDef[] {
  return BADGES.filter((b) => b.check(ctx));
}
