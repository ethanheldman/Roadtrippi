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
    reviewedCheckIns: number;
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
export declare const BADGES: BadgeDef[];
export declare function computeEarnedBadges(ctx: BadgeContext): BadgeDef[];
