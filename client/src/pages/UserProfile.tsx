import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { users, friends } from "../api";

type CheckInItem = {
  id: string;
  rating: number | null;
  review: string | null;
  visitDate: string;
  attraction: { id: string; name: string; city: string | null; state: string; imageUrl?: string | null };
};

export function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { user: me, token } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    avatarUrl?: string | null;
    bio?: string | null;
    location?: string | null;
    createdAt: string;
    checkInCount: number;
    listCount: number;
    followersCount?: number;
    followingCount?: number;
    recentCheckIns: CheckInItem[];
  } | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [ratingBarSelected, setRatingBarSelected] = useState<number | null>(null);

  const isOwnProfile = me?.id === id;

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }
    Promise.all([
      users.get(id).catch(() => null),
      token ? friends.isFollowing(id).then((r) => r.following).catch(() => false) : Promise.resolve(false),
    ]).then(([p, f]) => {
      setProfile(p ?? null);
      setFollowing(token ? f : null);
    }).finally(() => setLoading(false));
  }, [id, token, navigate]);

  const handleFollow = async () => {
    if (!id || !token || followLoading) return;
    setFollowLoading(true);
    try {
      await friends.follow(id);
      setFollowing(true);
    } catch {
      // leave state unchanged
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!id || !token || followLoading) return;
    setFollowLoading(true);
    try {
      await friends.unfollow(id);
      setFollowing(false);
    } catch {
      // leave state unchanged
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="h-36 skeleton rounded-lg" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] skeleton h-14" />
          ))}
        </div>
        <div className="flex justify-center items-end gap-2 h-40">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-16 sm:w-20 skeleton rounded-t-lg flex-1 max-w-[110px]" style={{ height: i === 2 ? "100%" : i === 1 ? "90%" : "80%" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
        <p className="text-lbx-text font-medium">User not found</p>
        <Link to="/" className="text-lbx-green hover:underline mt-2 inline-block">Back to Explore</Link>
      </div>
    );
  }

  const checkInList = profile.recentCheckIns ?? [];
  const podiumCheckIns = [...checkInList]
    .sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra;
      return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
    })
    .slice(0, 3);
  const defaultPodiumIds =
    podiumCheckIns.length === 3
      ? [podiumCheckIns[1].id, podiumCheckIns[0].id, podiumCheckIns[2].id]
      : [];
  const idToCheckIn = Object.fromEntries(checkInList.map((c) => [c.id, c]));
  const PLACES = [2, 1, 3] as const;
  const HEIGHTS = ["h-32 sm:h-40", "h-36 sm:h-44", "h-28 sm:h-36"] as const;
  const bannerImage = idToCheckIn[defaultPodiumIds[1]]?.attraction?.imageUrl ?? podiumCheckIns[0]?.attraction?.imageUrl;
  const topRated = [...checkInList]
    .filter((c) => c.rating != null && c.rating >= 4)
    .sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra; // 5 first, then 4.5, then 4
      return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
    })
    .slice(0, 6);

  const halfStarValues = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
  const ratingBuckets = halfStarValues.map((star) => ({
    star,
    count: checkInList.filter((c) => c.rating != null && c.rating === star).length,
  }));
  const totalRatings = ratingBuckets.reduce((sum, b) => sum + b.count, 0);
  const maxBucketCount = Math.max(1, ...ratingBuckets.map((b) => b.count));

  return (
    <div className="max-w-4xl">
      {/* Banner — same as own profile, no email, no Edit; Follow/Unfollow when not own */}
      <header className="relative rounded-lg overflow-hidden border border-lbx-border mb-4">
        <div
          className="h-28 sm:h-36 bg-cover bg-center"
          style={{
            backgroundImage: bannerImage
              ? `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 100%), url(${bannerImage})`
              : "linear-gradient(135deg, #161b22 0%, #0d1117 50%, #00e05415 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-lbx-dark via-transparent to-transparent pointer-events-none" aria-hidden />
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-shrink-0">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-lbx-dark shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-lbx-card border-2 border-lbx-dark flex items-center justify-center text-lg sm:text-xl text-lbx-muted shadow-lg">
                {profile.username.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight truncate drop-shadow-md">
              {profile.username}
            </h1>
            {(profile.bio || profile.location) && (
              <p className="text-white/90 text-xs sm:text-sm mt-1 line-clamp-2">
                {[profile.bio, profile.location].filter(Boolean).join(" · ")}
              </p>
            )}
            {!isOwnProfile && token && following !== null && (
              <div className="mt-2">
                {following ? (
                  <button
                    type="button"
                    onClick={handleUnfollow}
                    disabled={followLoading}
                    className="px-3 py-1.5 rounded border border-white/30 bg-black/30 text-xs sm:text-sm font-medium text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {followLoading ? "…" : "Unfollow"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFollow}
                    disabled={followLoading}
                    className="px-3 py-1.5 rounded border border-lbx-green bg-lbx-green/20 text-xs sm:text-sm font-medium text-white hover:bg-lbx-green/30 transition-colors disabled:opacity-50"
                  >
                    {followLoading ? "…" : "Follow"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stats — clickable: Check-ins scrolls to section; Following/Followers/Lists go to list pages */}
      <div className="flex flex-wrap gap-2 mb-6">
        <a
          href="#recent-check-ins"
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors block"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">{profile.checkInCount}</span>
          <p className="text-xs text-lbx-muted mt-0.5">Check-ins</p>
        </a>
        <Link
          to={`/user/${profile.id}/following`}
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">{profile.followingCount ?? 0}</span>
          <p className="text-xs text-lbx-muted mt-0.5">Following</p>
        </Link>
        <Link
          to={`/user/${profile.id}/followers`}
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">{profile.followersCount ?? 0}</span>
          <p className="text-xs text-lbx-muted mt-0.5">Followers</p>
        </Link>
        <Link
          to={`/user/${profile.id}/lists`}
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">{profile.listCount}</span>
          <p className="text-xs text-lbx-muted mt-0.5">Lists</p>
        </Link>
      </div>

      {/* Ratings breakdown — same as own profile, read-only labels */}
      {totalRatings > 0 && (
        <section className="mb-6">
          <h2 className="font-display font-semibold text-base text-lbx-white mb-1">Ratings</h2>
          <p className="text-lbx-muted text-xs mb-3">{totalRatings} {totalRatings === 1 ? "rating" : "ratings"}</p>
          <div
            className="grid grid-cols-9 gap-0.5 sm:gap-1 h-14 max-w-md"
            role="img"
            aria-label={`Rating distribution: ${ratingBuckets.map((b) => `${b.count} at ${b.star} stars`).join(", ")}`}
          >
            {ratingBuckets.map(({ star, count }) => {
              const maxBarPx = 48;
              const barPx =
                maxBucketCount > 0 && count > 0
                  ? Math.max((count / maxBucketCount) * maxBarPx, 6)
                  : 0;
              const isSelected = ratingBarSelected === star;
              return (
                <div key={String(star)} className="relative h-full min-h-[48px] flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setRatingBarSelected((prev) => (prev === star ? null : star))}
                    className={`absolute bottom-0 left-0 right-0 rounded-t bg-[#00e054] cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-lbx-green focus:ring-offset-2 focus:ring-offset-lbx-dark ${isSelected ? "ring-2 ring-lbx-green ring-offset-2 ring-offset-lbx-dark opacity-100" : ""}`}
                    style={{ height: `${Math.max(barPx, count > 0 ? 8 : 0)}px` }}
                    title={count > 0 ? `${star}★: ${count}` : `${star}★`}
                    aria-pressed={isSelected}
                    disabled={count === 0}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-lbx-muted text-xs mt-2 flex items-center justify-between max-w-md gap-0.5">
            {halfStarValues.map((star) => (
              <span key={String(star)} className={star === 5 ? "text-lbx-green font-medium" : ""}>
                {star}{star === 5 ? " ★" : ""}
              </span>
            ))}
          </p>
          {ratingBarSelected != null && (
            <div className="mt-3 p-3 rounded-lg border border-lbx-border bg-lbx-dark/50 max-w-md">
              <p className="text-lbx-muted text-xs mb-2">
                Attractions {profile.username} rated {ratingBarSelected}★
              </p>
              <ul className="space-y-1.5">
                {checkInList
                  .filter((c) => c.rating === ratingBarSelected)
                  .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                  .map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/attraction/${c.attraction.id}`}
                        className="text-sm text-lbx-green hover:underline font-medium"
                        onClick={() => setRatingBarSelected(null)}
                      >
                        {c.attraction.name}
                      </Link>
                      {(c.attraction.city || c.attraction.state) && (
                        <span className="text-lbx-muted text-xs ml-1">
                          — {[c.attraction.city, c.attraction.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Podium: their top 3 — only visible when they have at least 3 check-ins */}
      {podiumCheckIns.length >= 3 && (
        <section className="mb-6">
          <h2 className="font-display font-semibold text-base text-lbx-white mb-1">{profile.username}&apos;s top 3</h2>
          <p className="text-lbx-muted text-xs mb-3">From their check-ins—click to visit</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto items-end">
            {[0, 1, 2].map((slotIndex) => {
              const checkInId = defaultPodiumIds[slotIndex];
              const c = idToCheckIn[checkInId];
              const place = PLACES[slotIndex];
              const height = HEIGHTS[slotIndex];
              return (
                <div key={slotIndex} className="rounded-lg min-w-0">
                  {c ? (
                    <Link
                      to={`/attraction/${c.attraction.id}`}
                      className={`group flex flex-col items-center ${height} transition-transform hover:scale-[1.02] min-w-0 block`}
                    >
                      <div className={`relative w-full flex-1 min-h-0 rounded-t-lg overflow-hidden border border-lbx-border bg-lbx-card group-hover:border-lbx-green/60 transition-colors`}>
                        {c.attraction.imageUrl ? (
                          <img src={c.attraction.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none" draggable={false} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl text-lbx-muted/50 bg-lbx-border/80 pointer-events-none" draggable={false}>🗿</div>
                        )}
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-1.5 flex justify-center pointer-events-none">
                          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-lbx-green text-lbx-dark font-display font-bold text-sm flex items-center justify-center">
                            {place}
                          </span>
                        </div>
                        {c.rating != null && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pointer-events-none">
                            <span className="text-xs text-lbx-green font-medium">★ {c.rating}/5</span>
                          </div>
                        )}
                      </div>
                      <div className="w-full bg-lbx-card border border-t-0 border-lbx-border rounded-b-lg px-1.5 py-1.5 text-center min-w-0">
                        <p className="font-medium text-lbx-white text-xs line-clamp-2 group-hover:text-lbx-green transition-colors">
                          {c.attraction.name}
                        </p>
                        {(c.attraction.city || c.attraction.state) && (
                          <p className="text-lbx-muted text-[10px] sm:text-xs truncate mt-0.5">
                            {[c.attraction.city, c.attraction.state].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </Link>
                  ) : (
                    <div className="flex flex-col items-center h-28 sm:h-36 min-w-0">
                      <div className="w-full flex-1 rounded-t-lg border border-dashed border-lbx-border bg-lbx-card/50 flex items-center justify-center min-h-[4rem]">
                        <span className="text-lg text-lbx-muted/50">—</span>
                      </div>
                      <div className="w-full bg-lbx-card/50 border border-t-0 border-lbx-border rounded-b-lg px-1.5 py-1.5 text-center">
                        <p className="text-lbx-muted text-[10px]">No #{place}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top rated (4–5 stars) */}
      {topRated.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display font-semibold text-base text-lbx-white mb-3">Top rated</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {topRated.map((c) => (
              <Link
                key={c.id}
                to={`/attraction/${c.attraction.id}`}
                className="group block bg-lbx-card rounded-lg border border-lbx-border overflow-hidden hover:border-lbx-green/50 transition-colors"
              >
                <div className="poster-aspect bg-lbx-border/80 relative overflow-hidden">
                  {c.attraction.imageUrl ? (
                    <img
                      src={c.attraction.imageUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-lbx-muted/50">🗿</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                    <span className="text-xs text-lbx-green font-medium">★ {c.rating}/5</span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="font-medium text-lbx-white text-sm line-clamp-2 group-hover:text-lbx-green transition-colors">
                    {c.attraction.name}
                  </p>
                  <p className="text-xs text-lbx-muted truncate">
                    {[c.attraction.city, c.attraction.state].filter(Boolean).join(", ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent check-ins — same card grid as Top rated, 6 only */}
      <section id="recent-check-ins">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-lbx-white">Recent check-ins</h2>
          {checkInList.length > 0 && (
            <span className="text-sm text-lbx-muted">{checkInList.length} total</span>
          )}
        </div>
        {checkInList.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {checkInList.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to={`/attraction/${c.attraction.id}`}
                className="group block bg-lbx-card rounded-lg border border-lbx-border overflow-hidden hover:border-lbx-green/50 transition-colors"
              >
                <div className="poster-aspect bg-lbx-border/80 relative overflow-hidden">
                  {c.attraction.imageUrl ? (
                    <img
                      src={c.attraction.imageUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-lbx-muted/50">🗿</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                    <span className="text-xs text-lbx-green font-medium">★ {c.rating ?? "—"}/5</span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="font-medium text-lbx-white text-sm line-clamp-2 group-hover:text-lbx-green transition-colors">
                    {c.attraction.name}
                  </p>
                  <p className="text-xs text-lbx-muted truncate">
                    {[c.attraction.city, c.attraction.state].filter(Boolean).join(", ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
            <p className="text-lbx-muted text-sm">No check-ins yet</p>
          </div>
        )}
      </section>
    </div>
  );
}
