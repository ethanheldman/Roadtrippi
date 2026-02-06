import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { attractions, checkIns, getAvatarSrc, type AttractionDetail as AttractionDetailType, type RecentCheckIn } from "../api";
import { AddToList } from "../components/AddToList";
import { SaveToWantToSee } from "../components/SaveToWantToSee";
import { EditCheckIn } from "../components/EditCheckIn";
import { StarRating } from "../components/StarRating";

export function AttractionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attraction, setAttraction] = useState<AttractionDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [likeLoadingId, setLikeLoadingId] = useState<string | null>(null);

  const updateCheckInLike = (checkInId: string, liked: boolean, likeCount: number) => {
    setAttraction((prev) => {
      if (!prev) return prev;
      const patch = (c: RecentCheckIn) =>
        c.id === checkInId ? { ...c, likedByMe: liked, likeCount } : c;
      return {
        ...prev,
        recentCheckIns: prev.recentCheckIns?.map(patch) ?? [],
        popularCheckIns: prev.popularCheckIns?.map(patch) ?? [],
      };
    });
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    attractions
      .get(id)
      .then(setAttraction)
      .catch(() => setAttraction(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCheckIn = async () => {
    if (!user || !id) return;
    setCheckingIn(true);
    try {
      await checkIns.create({ attractionId: id, rating, review, visitDate });
      const updated = await attractions.get(id);
      setAttraction(updated);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-6" role="status" aria-label="Loading attraction">
        <div className="h-8 w-24 rounded bg-lbx-border" />
        <div className="aspect-video rounded-lg bg-lbx-border" />
        <div className="space-y-2">
          <div className="h-8 w-3/4 rounded bg-lbx-border" />
          <div className="h-4 w-1/3 rounded bg-lbx-border" />
        </div>
        <div className="h-24 rounded bg-lbx-border" />
      </div>
    );
  }
  if (!id || !attraction) {
    return (
      <div className="max-w-3xl mx-auto rounded-lg border border-lbx-border bg-lbx-card p-12 text-center">
        <p className="text-lbx-text mb-2">Attraction not found.</p>
        <p className="text-lbx-muted text-sm mb-4">The link may be broken or the attraction was removed.</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-lbx-green hover:underline font-medium"
        >
          ← Back to explore
        </button>
      </div>
    );
  }

  const mapUrl =
    attraction.latitude && attraction.longitude
      ? `https://www.google.com/maps?q=${attraction.latitude},${attraction.longitude}`
      : null;

  const recentList = attraction.recentCheckIns ?? [];
  const popularList = attraction.popularCheckIns ?? [];
  const hasRecent = recentList.length > 0;
  const hasPopular = popularList.length > 0;
  const ratingCount = attraction.ratingCount ?? 0;
  const visitCount = attraction.visitCount ?? 0;

  return (
    <div className="max-w-3xl mx-auto text-lbx-text">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-lbx-muted hover:text-lbx-white mb-6 text-sm font-medium transition-colors"
      >
        ← Back to explore
      </button>
      <article className="bg-lbx-card rounded-lg border border-lbx-border overflow-hidden shadow-card">
        <div className="aspect-video w-full bg-lbx-border overflow-hidden flex items-center justify-center">
          {attraction.imageUrl ? (
            <img
              src={attraction.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-8xl sm:text-9xl leading-none select-none text-lbx-muted/30" aria-hidden>
              🗿
            </span>
          )}
        </div>
        <div className="p-6 sm:p-8">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-lbx-white tracking-tight">{attraction.name}</h1>
          {(attraction.city || attraction.state) && (
            <p className="text-lbx-muted mt-1">
              {[attraction.city, attraction.state].filter(Boolean).join(", ")}
            </p>
          )}
          {attraction.address && (
            <p className="text-sm text-lbx-muted mt-1">{attraction.address}</p>
          )}
          {user && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <SaveToWantToSee attractionId={attraction.id} />
              <AddToList attractionId={attraction.id} variant="dropdown" />
            </div>
          )}

          {/* Stats: rating & check-ins */}
          <section className="mt-6 py-4 px-4 rounded-lg bg-lbx-dark/50 border border-lbx-border">
            <h2 className="sr-only">At a glance</h2>
            <div className="flex flex-wrap items-center gap-6">
              {attraction.avgRating != null && attraction.avgRating > 0 ? (
                <div>
                  <p className="text-2xl font-display font-bold text-lbx-green">★ {attraction.avgRating}</p>
                  <p className="text-xs text-lbx-muted">
                    {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-display font-bold text-lbx-muted">—</p>
                  <p className="text-xs text-lbx-muted">No ratings yet</p>
                </div>
              )}
              <div>
                <p className="text-2xl font-display font-bold text-lbx-white">{visitCount}</p>
                <p className="text-xs text-lbx-muted">
                  {visitCount === 1 ? "check-in" : "check-ins"}
                </p>
              </div>
            </div>
          </section>

          {attraction.description && (
            <section className="mt-6">
              <h2 className="font-display font-semibold text-base text-lbx-white mb-2">About</h2>
              <p className="text-lbx-text leading-relaxed whitespace-pre-line">{attraction.description}</p>
            </section>
          )}
          {Array.isArray(attraction.categories) && attraction.categories.length > 0 && (
            <div className="mt-4">
              <h2 className="font-display font-semibold text-base text-lbx-white mb-2">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {attraction.categories.map((c) => (
                  <span
                    key={c.id}
                    className="px-2 py-1 bg-lbx-border rounded text-sm text-lbx-muted"
                  >
                    {c.icon} {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user && (
            <AddToList attractionId={attraction.id} variant="section" />
          )}

          {/* Popular reviews (most likes) */}
          <section className="mt-8 pt-8 border-t border-lbx-border">
            <h2 className="font-display font-semibold text-lg text-lbx-white mb-4">
              Popular reviews
              {ratingCount > 0 && (
                <span className="font-normal text-lbx-muted text-base ml-2">
                  ({ratingCount} {ratingCount === 1 ? "review" : "reviews"})
                </span>
              )}
            </h2>
            {hasPopular ? (
              <ul className="space-y-4">
                {popularList.map((c) => (
                  <li
                    key={c.id}
                    className="bg-lbx-dark/50 rounded-lg border border-lbx-border p-4"
                  >
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {c.user && (
                        <Link
                          to={`/user/${c.user.id}`}
                          className="flex items-center gap-2 hover:text-lbx-green transition-colors"
                        >
                          {c.user.avatarUrl ? (
                            <img
                              src={getAvatarSrc(c.user.avatarUrl)}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover bg-lbx-border"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted text-sm font-medium">
                              {(c.user.username || "?").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium text-lbx-white">{c.user.username || "User"}</span>
                        </Link>
                      )}
                      {user && c.user?.id !== user.id ? (
                        <button
                          type="button"
                          disabled={likeLoadingId === c.id}
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!user || likeLoadingId) return;
                            setLikeLoadingId(c.id);
                            try {
                              const res = c.likedByMe
                                ? await checkIns.unlike(c.id)
                                : await checkIns.like(c.id);
                              updateCheckInLike(c.id, res.liked, res.likeCount);
                            } finally {
                              setLikeLoadingId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-sm text-lbx-muted hover:text-lbx-green transition-colors disabled:opacity-50"
                          aria-label={c.likedByMe ? "Unlike" : "Like"}
                        >
                          <span className={c.likedByMe ? "text-lbx-green" : ""}>{c.likedByMe ? "♥" : "♡"}</span>
                          <span>{c.likeCount ?? 0}</span>
                        </button>
                      ) : (
                        <span className="text-lbx-muted text-sm">
                          ♥ {c.likeCount ?? 0}
                        </span>
                      )}
                    </div>
                    {user && c.user?.id === user.id ? (
                      <EditCheckIn
                        checkInId={c.id}
                        rating={c.rating ?? null}
                        review={c.review ?? null}
                        visitDate={c.visitDate}
                        onSaved={async () => {
                          if (id) {
                            const updated = await attractions.get(id);
                            setAttraction(updated);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          {c.rating != null && (
                            <span className="text-lbx-green text-sm font-medium">★ {c.rating}/5</span>
                          )}
                          <span className="text-lbx-muted text-sm">
                            {new Date(c.visitDate).toLocaleDateString()}
                          </span>
                        </div>
                        {c.review ? (
                          <p className="text-lbx-text text-sm whitespace-pre-wrap mt-1">{c.review}</p>
                        ) : (
                          <p className="text-lbx-muted text-sm italic mt-1">No written review</p>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-lbx-border bg-lbx-dark/30 py-6 px-6 text-center">
                <p className="text-lbx-muted text-sm">No reviews yet.</p>
              </div>
            )}
          </section>

          {/* Recent reviews (newest first) */}
          <section className="mt-8 pt-8 border-t border-lbx-border">
            <h2 className="font-display font-semibold text-lg text-lbx-white mb-4">
              Recent reviews
            </h2>
            {hasRecent ? (
              <ul className="space-y-4">
                {recentList.map((c) => (
                  <li
                    key={c.id}
                    className="bg-lbx-dark/50 rounded-lg border border-lbx-border p-4"
                  >
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {c.user && (
                        <Link
                          to={`/user/${c.user.id}`}
                          className="flex items-center gap-2 hover:text-lbx-green transition-colors"
                        >
                          {c.user.avatarUrl ? (
                            <img
                              src={getAvatarSrc(c.user.avatarUrl)}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover bg-lbx-border"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted text-sm font-medium">
                              {(c.user.username || "?").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium text-lbx-white">{c.user.username || "User"}</span>
                        </Link>
                      )}
                      {user && c.user?.id !== user.id ? (
                        <button
                          type="button"
                          disabled={likeLoadingId === c.id}
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!user || likeLoadingId) return;
                            setLikeLoadingId(c.id);
                            try {
                              const res = c.likedByMe
                                ? await checkIns.unlike(c.id)
                                : await checkIns.like(c.id);
                              updateCheckInLike(c.id, res.liked, res.likeCount);
                            } finally {
                              setLikeLoadingId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-sm text-lbx-muted hover:text-lbx-green transition-colors disabled:opacity-50"
                          aria-label={c.likedByMe ? "Unlike" : "Like"}
                        >
                          <span className={c.likedByMe ? "text-lbx-green" : ""}>{c.likedByMe ? "♥" : "♡"}</span>
                          <span>{c.likeCount ?? 0}</span>
                        </button>
                      ) : (
                        <span className="text-lbx-muted text-sm">
                          ♥ {c.likeCount ?? 0}
                        </span>
                      )}
                    </div>
                    {user && c.user?.id === user.id ? (
                      <EditCheckIn
                        checkInId={c.id}
                        rating={c.rating ?? null}
                        review={c.review ?? null}
                        visitDate={c.visitDate}
                        onSaved={async () => {
                          if (id) {
                            const updated = await attractions.get(id);
                            setAttraction(updated);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          {c.rating != null && (
                            <span className="text-lbx-green text-sm font-medium">★ {c.rating}/5</span>
                          )}
                          <span className="text-lbx-muted text-sm">
                            {new Date(c.visitDate).toLocaleDateString()}
                          </span>
                        </div>
                        {c.review ? (
                          <p className="text-lbx-text text-sm whitespace-pre-wrap mt-1">{c.review}</p>
                        ) : (
                          <p className="text-lbx-muted text-sm italic mt-1">No written review</p>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-lbx-border bg-lbx-dark/30 py-6 px-6 text-center">
                <p className="text-lbx-muted text-sm">No reviews yet.</p>
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-3 mt-6">
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-4 py-2.5 bg-lbx-green text-lbx-dark font-medium rounded-md hover:opacity-90 transition-opacity text-sm"
              >
                View on map →
              </a>
            )}
            {attraction.sourceUrl && (
              <a
                href={attraction.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-4 py-2.5 border border-lbx-border text-lbx-muted rounded-md hover:border-lbx-green hover:text-lbx-white transition-colors text-sm"
              >
                Read more at Roadside America →
              </a>
            )}
          </div>

          {user && (
            <section className="mt-10 pt-8 border-t border-lbx-border">
              <h2 className="font-display font-semibold text-lg text-lbx-white mb-4">Check in</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-lbx-muted mb-1">Rating</label>
                  <StarRating value={rating} onChange={setRating} aria-label="Choose rating" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-lbx-muted mb-1">Visit date</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-lbx-muted mb-1">Review (optional)</label>
                  <textarea
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm resize-none"
                    placeholder="What did you think?"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={checkingIn || rating < 1}
                  className="w-full px-4 py-2.5 bg-lbx-green text-lbx-dark font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
                >
                  {checkingIn ? "Saving..." : "Check in"}
                </button>
              </div>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
