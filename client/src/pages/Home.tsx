import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AttractionCard } from "../components/AttractionCard";
import { CardGridSkeleton } from "../components/CardSkeleton";
import { StarDisplay } from "../components/StarDisplay";
import { useAuth } from "../context/AuthContext";
import { attractions, friends, checkIns, getAvatarSrc, type Attraction, type Paginated, type FeedCheckIn, type CommentItem } from "../api";
import { SORT_OPTIONS } from "../constants/sortOptions";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80";

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export function Home() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedCheckIn[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [reviewDetailCheckIn, setReviewDetailCheckIn] = useState<FeedCheckIn | null>(null);
  const [reviewComments, setReviewComments] = useState<CommentItem[]>([]);
  const [reviewCommentsLoading, setReviewCommentsLoading] = useState(false);
  const [reviewCommentText, setReviewCommentText] = useState("");
  const [reviewCommentSubmitting, setReviewCommentSubmitting] = useState(false);
  const [data, setData] = useState<Paginated<Attraction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchParams, _setSearchParams] = useSearchParams();
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [sortIndex, setSortIndex] = useState(0);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [heroOpacity, setHeroOpacity] = useState(1);

  const sort = SORT_OPTIONS[sortIndex] ?? SORT_OPTIONS[0];
  const isDistanceSort = sort.value === "distance";

  useEffect(() => {
    const q = searchParams.get("search");
    if (q !== null) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("search")) window.scrollTo(0, 0);
  }, [searchParams]);

  // Fade hero out as user scrolls
  useEffect(() => {
    const fadeDistance = Math.min(400, window.innerHeight * 0.5);
    const onScroll = () => {
      const opacity = Math.max(0, 1 - window.scrollY / fadeDistance);
      setHeroOpacity(opacity);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // When "Closest to me" is selected, request geolocation once
  useEffect(() => {
    if (!isDistanceSort) return;
    if (userCoords != null) return;
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Location not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }) as void,
      () => setLocationError("Location denied or unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [isDistanceSort, userCoords]);

  useEffect(() => {
    if (!user) {
      setFeed([]);
      return;
    }
    setFeedLoading(true);
    friends
      .feed({ limit: 30 })
      .then((r) => setFeed(r.items))
      .catch(() => setFeed([]))
      .finally(() => setFeedLoading(false));
  }, [user]);

  useEffect(() => {
    if (!reviewDetailCheckIn) {
      setReviewComments([]);
      return;
    }
    setReviewCommentsLoading(true);
    checkIns
      .getComments(reviewDetailCheckIn.id)
      .then((r) => setReviewComments(r.items))
      .catch(() => setReviewComments([]))
      .finally(() => setReviewCommentsLoading(false));
  }, [reviewDetailCheckIn?.id]);

  useEffect(() => {
    if (sort.value === "distance" && userCoords == null && !locationError) {
      setLoading(true);
      return;
    }
    if (sort.value === "distance" && userCoords == null) {
      setData({ items: [], total: 0, page: 1, limit: 24 });
      setLoading(false);
      return;
    }
    setLoading(true);
    attractions
      .list({
        page,
        limit: 24,
        state: state || undefined,
        city: city.trim() || undefined,
        category: category.trim() || undefined,
        search: search || undefined,
        sortBy: sort.value,
        sortOrder: sort.order,
        lat: userCoords?.lat,
        lng: userCoords?.lng,
      })
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, limit: 24 }))
      .finally(() => setLoading(false));
  }, [page, state, city, category, search, sortIndex, sort.value, sort.order, userCoords, locationError]);

  return (
    <div>
      {/* Hero: full-bleed, fades out (opacity) as you scroll */}
      <section
        className={`hero-full-bleed sticky top-0 z-0 relative min-h-[88vh] sm:min-h-[92vh] flex items-center justify-center bg-cover bg-center bg-[#161b22] transition-opacity duration-150 ${heroOpacity === 0 ? "pointer-events-none" : ""}`}
        style={{
          backgroundImage: `url(${HERO_IMAGE})`,
          opacity: heroOpacity,
        }}
        aria-hidden={heroOpacity === 0}
      >
        <div className="absolute inset-0 bg-black/65" aria-hidden />
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-2xl mx-auto pointer-events-auto">
          <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white mb-4 sm:mb-5 tracking-tight leading-tight">
            Roadtrippi
          </h1>
          <p className="text-white/95 text-lg sm:text-xl font-medium mb-6 sm:mb-8 space-y-1">
            <span className="block">Track visits you&apos;ve made.</span>
            <span className="block">Save places you want to see.</span>
            <span className="block">Tell your friends what&apos;s good.</span>
          </p>
          {!user && (
            <Link
              to="/signup"
              className="inline-block bg-lbx-green text-lbx-dark font-semibold px-8 py-3.5 rounded-lg text-base hover:opacity-95 transition-opacity shadow-lg"
            >
              Get started — it&apos;s free!
            </Link>
          )}
        </div>
      </section>

      {/* Content that scrolls over the hero — solid bg so it covers the hero as you scroll up */}
      <div className="relative z-10 bg-lbx-dark -mt-px">
        <p className="text-lbx-muted text-center text-sm mb-2 pt-2">
          The social network for roadside attraction lovers.
        </p>

      {/* Feed from people you follow — Letterboxd-style horizontal row */}
      {user && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-xl text-lbx-white tracking-tight">
              From people you follow
            </h2>
            <Link to="/people" className="text-sm text-lbx-muted hover:text-lbx-green transition-colors flex items-center gap-1">
              All activity
              <span aria-hidden>→</span>
            </Link>
          </div>
          {feedLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex-shrink-0 w-[140px] rounded-lg overflow-hidden">
                  <div className="poster-aspect skeleton" />
                  <div className="p-2 h-16 skeleton" />
                </div>
              ))}
            </div>
          ) : feed.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1">
                {feed.map((c) => (
                  <div
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setReviewDetailCheckIn(c); } }}
                    className="flex-shrink-0 w-[140px] bg-lbx-card rounded-lg border border-lbx-border overflow-hidden transition-colors cursor-pointer hover:border-lbx-green/50 focus:outline-none focus:ring-2 focus:ring-lbx-green focus:ring-offset-2 focus:ring-offset-lbx-dark"
                    onClick={() => setReviewDetailCheckIn(c)}
                  >
                    <div className="poster-aspect bg-lbx-border/80 relative overflow-hidden">
                      {c.attraction.imageUrl ? (
                        <img src={c.attraction.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl text-lbx-muted/50">🗿</div>
                      )}
                    </div>
                    <div className="p-2 space-y-1.5 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-lbx-white truncate" title={c.attraction.name}>
                          {c.attraction.name}
                        </p>
                        {(c.attraction.city || c.attraction.state) && (
                          <p className="text-xs text-lbx-muted truncate">
                            {[c.attraction.city, c.attraction.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <Link
                        to={`/user/${c.user.id}`}
                        className="flex items-center gap-2 min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.user.avatarUrl ? (
                          <img src={getAvatarSrc(c.user.avatarUrl)} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-lbx-border" />
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-lbx-border flex items-center justify-center text-[10px] text-lbx-muted font-display flex-shrink-0">
                            {c.user.username.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="text-sm text-lbx-white font-medium hover:text-lbx-green transition-colors truncate min-w-0">
                          {c.user.username}
                        </span>
                      </Link>
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.rating != null && (
                          <StarDisplay value={c.rating} className="text-sm" />
                        )}
                        {!!c.review?.trim() && (
                          <span className="inline-flex flex-col gap-px shrink-0" title="Has written review" aria-hidden>
                            <span className="w-3 h-px bg-lbx-muted rounded-full" />
                            <span className="w-3 h-px bg-lbx-muted rounded-full" />
                            <span className="w-3 h-px bg-lbx-muted rounded-full" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="rounded-lg border border-lbx-border bg-lbx-card p-6 text-center mb-6">
              <p className="text-lbx-muted text-sm mb-2">No recent reviews from people you follow yet.</p>
              <Link to="/people" className="text-lbx-green hover:underline text-sm font-medium">
                Discover people to follow →
              </Link>
            </div>
          )}

          {/* Review detail modal — Letterboxd-style */}
          {reviewDetailCheckIn && (
            <>
              <div
                className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
                onClick={() => setReviewDetailCheckIn(null)}
                aria-hidden
              />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-lbx-dark/95 border border-lbx-border/60 rounded-xl shadow-2xl z-50 p-6 flex gap-6 backdrop-blur-sm">
                <div className="flex-shrink-0 w-36 sm:w-44">
                  {reviewDetailCheckIn.attraction.imageUrl ? (
                    <img
                      src={reviewDetailCheckIn.attraction.imageUrl}
                      alt=""
                      className="w-full rounded-lg object-cover poster-aspect"
                    />
                  ) : (
                    <div className="w-full poster-aspect rounded-lg bg-lbx-border flex items-center justify-center text-4xl text-lbx-muted/50">🗿</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/user/${reviewDetailCheckIn.user.id}`}
                    className="flex items-center gap-2 text-sm text-lbx-muted hover:text-lbx-green transition-colors mb-3"
                  >
                    {reviewDetailCheckIn.user.avatarUrl ? (
                      <img
                        src={reviewDetailCheckIn.user.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover bg-lbx-border"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-lbx-border flex items-center justify-center text-xs text-lbx-muted font-display">
                        {reviewDetailCheckIn.user.username.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="font-medium">Review by {reviewDetailCheckIn.user.username}</span>
                  </Link>
                  <h3 className="font-display font-bold text-xl text-lbx-white mb-1">
                    <Link to={`/attraction/${reviewDetailCheckIn.attraction.id}`} className="hover:text-lbx-green transition-colors">
                      {reviewDetailCheckIn.attraction.name}
                    </Link>
                  </h3>
                  {reviewDetailCheckIn.attraction.city || reviewDetailCheckIn.attraction.state ? (
                    <p className="text-sm text-lbx-muted mb-2">
                      {[reviewDetailCheckIn.attraction.city, reviewDetailCheckIn.attraction.state].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    {reviewDetailCheckIn.rating != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <StarDisplay value={reviewDetailCheckIn.rating} className="text-lg" />
                        <span className="text-sm text-lbx-muted tabular-nums">{reviewDetailCheckIn.rating}/5</span>
                      </span>
                    )}
                    <span className="text-xs text-lbx-muted">
                      Visited {new Date(reviewDetailCheckIn.visitDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="border-t border-lbx-border pt-3">
                    {reviewDetailCheckIn.review?.trim() ? (
                      <p className="text-sm text-lbx-text whitespace-pre-wrap">{reviewDetailCheckIn.review}</p>
                    ) : (
                      <p className="text-sm text-lbx-muted italic">No written review</p>
                    )}
                  </div>
                  {user && (
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-lbx-border/50">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!reviewDetailCheckIn) return;
                          try {
                            const res = reviewDetailCheckIn.likedByMe
                              ? await checkIns.unlike(reviewDetailCheckIn.id)
                              : await checkIns.like(reviewDetailCheckIn.id);
                            setReviewDetailCheckIn((c) => c ? { ...c, likedByMe: res.liked, likeCount: res.likeCount } : null);
                            setFeed((prev) => prev.map((c) => (c.id === reviewDetailCheckIn.id ? { ...c, likedByMe: res.liked, likeCount: res.likeCount } : c)));
                          } catch {
                            // ignore
                          }
                        }}
                        className="inline-flex items-center gap-1 text-sm text-lbx-muted hover:text-lbx-green transition-colors"
                        aria-label={reviewDetailCheckIn.likedByMe ? "Unlike" : "Like"}
                      >
                        <span className={reviewDetailCheckIn.likedByMe ? "text-lbx-green" : ""}>{reviewDetailCheckIn.likedByMe ? "♥" : "♡"}</span>
                        <span>{reviewDetailCheckIn.likeCount}</span>
                      </button>
                    </div>
                  )}
                  {!user && reviewDetailCheckIn.likeCount > 0 && (
                    <p className="text-xs text-lbx-muted mt-3 pt-3 border-t border-lbx-border/50">
                      ♥ {reviewDetailCheckIn.likeCount} like{reviewDetailCheckIn.likeCount !== 1 ? "s" : ""}
                    </p>
                  )}
                  <div className="mt-4 pt-3 border-t border-lbx-border/50">
                    <h4 className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest mb-2">Comments</h4>
                    {reviewCommentsLoading ? (
                      <p className="text-sm text-lbx-muted/80">Loading…</p>
                    ) : reviewComments.length === 0 ? (
                      <p className="text-sm text-lbx-muted/80">No comments yet.</p>
                    ) : (
                      <ul className="space-y-2.5 mb-3">
                        {reviewComments.map((com) => (
                          <li key={com.id} className="flex items-start gap-2 text-sm">
                            <Link
                              to={`/user/${com.user.id}`}
                              className="flex-shrink-0 flex items-center gap-1.5 text-lbx-muted/90 hover:text-lbx-green transition-colors"
                              onClick={() => setReviewDetailCheckIn(null)}
                            >
                              {com.user.avatarUrl ? (
                                <img src={getAvatarSrc(com.user.avatarUrl)} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-lbx-border/80 flex items-center justify-center text-[9px] font-display">
                                  {com.user.username.slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <span className="font-medium text-[13px]">{com.user.username}</span>
                            </Link>
                            <span className="text-lbx-text/90 flex-1 min-w-0 text-[13px]">{com.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {user && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!reviewDetailCheckIn || !reviewCommentText.trim() || reviewCommentSubmitting) return;
                          setReviewCommentSubmitting(true);
                          try {
                            const newComment = await checkIns.addComment(reviewDetailCheckIn.id, reviewCommentText.trim());
                            setReviewComments((prev) => [...prev, newComment]);
                            setReviewCommentText("");
                          } catch {
                            // ignore
                          } finally {
                            setReviewCommentSubmitting(false);
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={reviewCommentText}
                          onChange={(e) => setReviewCommentText(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 min-w-0 px-0 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-sm text-lbx-white placeholder-lbx-muted/70 focus:border-lbx-muted focus:outline-none focus:ring-0 transition-colors"
                          maxLength={2000}
                        />
                        <button
                          type="submit"
                          disabled={!reviewCommentText.trim() || reviewCommentSubmitting}
                          className="flex-shrink-0 text-sm font-medium text-lbx-muted hover:text-lbx-green transition-colors disabled:opacity-40 disabled:hover:text-lbx-muted"
                        >
                          {reviewCommentSubmitting ? "…" : "Post"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDetailCheckIn(null)}
                    className="p-2 rounded-md text-lbx-muted hover:text-lbx-white hover:bg-lbx-card transition-colors"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                  <Link
                    to={`/attraction/${reviewDetailCheckIn.attraction.id}`}
                    className="text-xs text-lbx-muted hover:text-lbx-green transition-colors"
                    onClick={() => setReviewDetailCheckIn(null)}
                  >
                    View attraction
                  </Link>
                  <Link
                    to={`/user/${reviewDetailCheckIn.user.id}`}
                    className="text-xs text-lbx-muted hover:text-lbx-green transition-colors"
                    onClick={() => setReviewDetailCheckIn(null)}
                  >
                    Show {reviewDetailCheckIn.user.username}&apos;s profile
                  </Link>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <div id="all-attractions" className="mb-8 scroll-mt-4">
        <h2 className="font-display font-semibold text-2xl text-lbx-white tracking-tight mb-5">
          All attractions
        </h2>
          {isDistanceSort && userCoords == null && (
            <p className="text-sm text-lbx-muted mb-2">
              {locationError ? (
                <span>{locationError}. Choose another sort or allow location to see closest attractions.</span>
              ) : (
                <span>Getting your location…</span>
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-4 border-b border-lbx-border/60">
            <input
            type="search"
            placeholder="Search attractions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-48 px-0 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-lbx-white placeholder-lbx-muted/80 focus:border-lbx-muted focus:outline-none focus:ring-0 text-sm transition-colors"
            aria-label="Search attractions"
          />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest">State</span>
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(1);
              }}
              className="pl-0 pr-6 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-lbx-white focus:border-lbx-muted focus:outline-none focus:ring-0 text-sm min-w-[88px] appearance-none bg-no-repeat bg-[length:10px] bg-[right_0_center] cursor-pointer transition-colors"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")" }}
              aria-label="Filter by state"
            >
              <option value="">All</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest">City</span>
            <input
              type="text"
              placeholder="Any"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              className="w-24 sm:w-28 px-0 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-lbx-white placeholder-lbx-muted/80 focus:border-lbx-muted focus:outline-none focus:ring-0 text-sm transition-colors"
              aria-label="Filter by city"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest">Type</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="pl-0 pr-6 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-lbx-white focus:border-lbx-muted focus:outline-none focus:ring-0 text-sm min-w-[120px] appearance-none bg-no-repeat bg-[length:10px] bg-[right_0_center] cursor-pointer transition-colors"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")" }}
              aria-label="Filter by type"
            >
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest">Sort by</span>
            <select
              value={sortIndex}
              onChange={(e) => {
                setSortIndex(Number(e.target.value));
                setPage(1);
              }}
              className="pl-0 pr-6 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-lbx-white focus:border-lbx-muted focus:outline-none focus:ring-0 text-sm min-w-[140px] font-medium appearance-none bg-no-repeat bg-[length:10px] bg-[right_0_center] cursor-pointer transition-colors"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")" }}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton count={24} />
      ) : data?.items.length ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {data.items.map((a) => (
              <AttractionCard key={a.id} a={a} />
            ))}
          </div>
          {data.total > data.limit && (
            <nav className="flex justify-center items-center gap-4 mt-10 pt-6 border-t border-lbx-border" aria-label="Pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2.5 bg-lbx-card border border-lbx-border text-lbx-muted rounded-md text-sm font-medium hover:border-lbx-green hover:text-lbx-green disabled:opacity-50 disabled:hover:border-lbx-border disabled:hover:text-lbx-muted transition-colors"
              >
                Previous
              </button>
              <span className="text-lbx-muted text-sm tabular-nums">
                Page {page} of {Math.ceil(data.total / data.limit)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(data.total / data.limit)}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2.5 bg-lbx-card border border-lbx-border text-lbx-muted rounded-md text-sm font-medium hover:border-lbx-green hover:text-lbx-green disabled:opacity-50 disabled:hover:border-lbx-border disabled:hover:text-lbx-muted transition-colors"
              >
                Next
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-lbx-border bg-lbx-card p-12 sm:p-16 text-center">
          <p className="text-lbx-text font-medium mb-1">No attractions found</p>
          <p className="text-lbx-muted text-sm">Try a different search or state filter.</p>
        </div>
      )}
      </div>
    </div>
  );
}
