import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { checkIns, friends, users } from "../api";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 2;

function isImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}
import { AttractionCard } from "../components/AttractionCard";
import { EditRating } from "../components/EditRating";

type CheckInItem = {
  id: string;
  rating: number | null;
  review: string | null;
  visitDate: string;
  attraction: { id: string; name: string; city: string | null; state: string; imageUrl?: string | null };
};

type SocialCounts = { followersCount: number; followingCount: number; friendsCount: number };

export function Profile() {
  const { user, token, refresh } = useAuth();
  const navigate = useNavigate();
  const [checkInList, setCheckInList] = useState<CheckInItem[]>([]);
  const [social, setSocial] = useState<SocialCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [podiumOrderIds, setPodiumOrderIds] = useState<string[]>([]);
  const [ratingBarSelected, setRatingBarSelected] = useState<number | null>(null);

  // Top 3 from check-ins: by rating (highest first), then by visit date (newest)
  const podiumCheckIns = [...checkInList]
    .sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra;
      return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
    })
    .slice(0, 3);

  const loadData = useCallback(() => {
    if (!token) return;
    Promise.all([
      checkIns.my().then((r) => (r.items as CheckInItem[]) ?? []),
      friends.socialCounts().catch(() => null),
    ]).then(([checkInsList, counts]) => {
      setCheckInList(checkInsList);
      setSocial(counts ?? null);
    }).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    loadData();
  }, [token, navigate, loadData]);

  useEffect(() => {
    if (user) {
      setEditAvatarUrl(user.avatarUrl ?? "");
      setEditBio(user.bio ?? "");
      setEditLocation(user.location ?? "");
    }
  }, [user, editOpen]);

  // Sync podium order when the set of top 3 check-ins changes (e.g. after new check-in)
  const defaultPodiumIdsKey =
    podiumCheckIns.length === 3
      ? [podiumCheckIns[0].id, podiumCheckIns[1].id, podiumCheckIns[2].id].sort().join(",")
      : "";
  useEffect(() => {
    if (podiumCheckIns.length !== 3) return;
    const defaultIds = [podiumCheckIns[1].id, podiumCheckIns[0].id, podiumCheckIns[2].id];
    setPodiumOrderIds((prev) => {
      if (prev.length !== 3) return defaultIds;
      const defaultSet = new Set(defaultIds);
      if ([...defaultSet].some((id) => !prev.includes(id))) return defaultIds;
      return prev;
    });
  }, [defaultPodiumIdsKey]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setAvatarError(null);
    try {
      await users.updateMe({
        avatarUrl: editAvatarUrl.trim() || null,
        bio: editBio.trim() || null,
        location: editLocation.trim() || null,
      });
      await refresh();
      setEditOpen(false);
    } catch {
      // leave modal open
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (file: File | null) => {
    if (!file) return;
    setAvatarError(null);
    if (!isImageFile(file)) {
      setAvatarError("Please use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setAvatarError(`Image must be under ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploadingAvatar(true);
    try {
      const { avatarUrl } = await users.uploadAvatar(file);
      setEditAvatarUrl(avatarUrl);
      await refresh();
    } catch (e) {
      setAvatarError((e as Error).message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleAvatarFile(file);
  };

  const onAvatarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(true);
  };

  const onAvatarDragLeave = () => setAvatarDragOver(false);

  if (!user) return null;

  const defaultPodiumIds =
    podiumCheckIns.length === 3
      ? [podiumCheckIns[1].id, podiumCheckIns[0].id, podiumCheckIns[2].id]
      : [];
  const orderedIds =
    podiumOrderIds.length === 3 &&
    defaultPodiumIds.length === 3 &&
    defaultPodiumIds.every((id) => podiumOrderIds.includes(id))
      ? podiumOrderIds
      : defaultPodiumIds;
  const idToCheckIn = Object.fromEntries(checkInList.map((c) => [c.id, c]));
  const PLACES = [2, 1, 3] as const;
  const HEIGHTS = ["h-32 sm:h-40", "h-36 sm:h-44", "h-28 sm:h-36"] as const;
  const canReorderPodium = orderedIds.length === 3;
  const bannerImage = idToCheckIn[orderedIds[1]]?.attraction?.imageUrl ?? podiumCheckIns[0]?.attraction?.imageUrl;
  const topRated = [...checkInList]
    .filter((c) => c.rating != null && c.rating >= 4)
    .sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra; // 5 first, then 4.5, then 4
      return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
    })
    .slice(0, 6);

  // Rating distribution (1, 1.5, … 5) for bar chart – half-star buckets so 4, 4.5, 5 are distinct
  const halfStarValues = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
  const ratingBuckets = halfStarValues.map((star) => ({
    star,
    count: checkInList.filter((c) => c.rating != null && c.rating === star).length,
  }));
  const totalRatings = ratingBuckets.reduce((sum, b) => sum + b.count, 0);
  const maxBucketCount = Math.max(1, ...ratingBuckets.map((b) => b.count));

  return (
    <div className="max-w-4xl">
      {/* Banner */}
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
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-lbx-dark shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-lbx-card border-2 border-lbx-dark flex items-center justify-center text-lg sm:text-xl text-lbx-muted shadow-lg">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight truncate drop-shadow-md">
              {user.username}
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5 truncate">{user.email}</p>
            {(user.bio || user.location) && (
              <p className="text-white/90 text-xs sm:text-sm mt-1 line-clamp-2">
                {[user.bio, user.location].filter(Boolean).join(" · ")}
              </p>
            )}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="mt-2 px-3 py-1.5 rounded border border-white/30 bg-black/30 text-xs sm:text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
              Edit profile
            </button>
          </div>
        </div>
      </header>

      {/* Stats — all clickable */}
      <div className="flex flex-wrap gap-2 mb-6">
        <a
          href="#recent-check-ins"
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors block"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">{user.checkInCount ?? 0}</span>
          <p className="text-xs text-lbx-muted mt-0.5">Check-ins</p>
        </a>
        <Link
          to="/profile/friends"
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">
            {social ? social.friendsCount : "—"}
          </span>
          <p className="text-xs text-lbx-muted mt-0.5">Friends</p>
        </Link>
        <Link
          to="/profile/following"
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">
            {social ? social.followingCount : "—"}
          </span>
          <p className="text-xs text-lbx-muted mt-0.5">Following</p>
        </Link>
        <Link
          to="/profile/followers"
          className="bg-lbx-card rounded-lg border border-lbx-border px-4 py-3 min-w-[80px] hover:border-lbx-green/50 transition-colors"
        >
          <span className="text-xl font-display font-bold text-lbx-green tabular-nums">
            {social ? social.followersCount : "—"}
          </span>
          <p className="text-xs text-lbx-muted mt-0.5">Followers</p>
        </Link>
      </div>

      {/* Ratings breakdown (Letterboxd-style) */}
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
                    title={count > 0 ? `${star}★: ${count} — click to see attractions` : `${star}★`}
                    aria-pressed={isSelected}
                    aria-label={count > 0 ? `Show ${count} attractions rated ${star} stars` : `No ratings at ${star} stars`}
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
                Attractions you rated {ratingBarSelected}★
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

      {/* Podium: top 3 from check-ins — only visible when user has at least 3 check-ins */}
      {podiumCheckIns.length >= 3 && (
        <section className="mb-6">
          <h2 className="font-display font-semibold text-base text-lbx-white mb-1">My top 3</h2>
          <p className="text-lbx-muted text-xs mb-3">From your check-ins—drag to reorder, click to visit</p>
          {loading ? (
            <div className="flex justify-center items-end gap-2 h-40">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-16 sm:w-20 skeleton rounded-t-lg flex-1 max-w-[110px]" style={{ height: i === 2 ? "100%" : i === 1 ? "90%" : "80%" }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto items-end">
              {[0, 1, 2].map((slotIndex) => {
                const checkInId = orderedIds[slotIndex];
                const c = idToCheckIn[checkInId];
                const place = PLACES[slotIndex];
                const height = HEIGHTS[slotIndex];
                const handleDragOver = (e: React.DragEvent) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("ring-2", "ring-lbx-green/50");
                };
                const handleDragLeave = (e: React.DragEvent) => {
                  e.currentTarget.classList.remove("ring-2", "ring-lbx-green/50");
                };
                const handleDrop = (e: React.DragEvent) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-lbx-green/50");
                  if (!canReorderPodium) return;
                  const raw = e.dataTransfer.getData("application/x-podium");
                  if (!raw) return;
                  const { sourceIndex } = JSON.parse(raw) as { checkInId: string; sourceIndex: number };
                  const targetIndex = slotIndex;
                  if (sourceIndex === targetIndex) return;
                  setPodiumOrderIds((prev) => {
                    const next = [...prev];
                    const [moved] = next.splice(sourceIndex, 1);
                    next.splice(targetIndex, 0, moved);
                    return next;
                  });
                };
                return (
                  <div
                    key={slotIndex}
                    className="rounded-lg min-w-0 transition-shadow"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    data-slot={slotIndex}
                  >
                    {c ? (
                      <Link
                        to={`/attraction/${c.attraction.id}`}
                        className={`group flex flex-col items-center ${height} transition-transform hover:scale-[1.02] min-w-0 block`}
                        draggable={canReorderPodium}
                        onDragStart={(e) => {
                          if (!canReorderPodium) return;
                          e.dataTransfer.setData(
                            "application/x-podium",
                            JSON.stringify({ checkInId: c.id, sourceIndex: slotIndex })
                          );
                          e.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        <div className={`relative w-full flex-1 min-h-0 rounded-t-lg overflow-hidden border border-lbx-border bg-lbx-card group-hover:border-lbx-green/60 transition-colors ${canReorderPodium ? "cursor-grab active:cursor-grabbing" : ""}`}>
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
          )}
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
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-lbx-card rounded-lg overflow-hidden">
                <div className="poster-aspect skeleton" />
                <div className="p-2 h-14 skeleton" />
              </div>
            ))}
          </div>
        ) : checkInList.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {checkInList.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="group relative bg-lbx-card rounded-lg border border-lbx-border overflow-hidden hover:border-lbx-green/50 transition-colors"
              >
                <div className="relative poster-aspect bg-lbx-border/80 overflow-hidden">
                  <Link to={`/attraction/${c.attraction.id}`} className="absolute inset-0 z-0">
                    {c.attraction.imageUrl ? (
                      <img
                        src={c.attraction.imageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-lbx-muted/50">🗿</div>
                    )}
                  </Link>
                  <div
                    className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditRating
                      checkInId={c.id}
                      rating={c.rating}
                      onSaved={loadData}
                      className="!p-0 !bg-transparent !border-0 text-xs text-lbx-green font-medium hover:!underline"
                    />
                  </div>
                </div>
                <Link to={`/attraction/${c.attraction.id}`} className="block p-2">
                  <p className="font-medium text-lbx-white text-sm line-clamp-2 group-hover:text-lbx-green transition-colors">
                    {c.attraction.name}
                  </p>
                  <p className="text-xs text-lbx-muted truncate">
                    {[c.attraction.city, c.attraction.state].filter(Boolean).join(", ")}
                  </p>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
            <p className="text-lbx-text font-medium mb-1">No check-ins yet</p>
            <p className="text-lbx-muted text-sm">Explore attractions and check in when you visit.</p>
            <Link to="/" className="text-lbx-green hover:underline text-sm mt-2 inline-block">Explore</Link>
          </div>
        )}
      </section>

      {/* Edit profile modal */}
      {editOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setEditOpen(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-lbx-card border border-lbx-border rounded-xl shadow-xl z-50 p-6">
            <h3 className="font-display font-semibold text-lg text-lbx-white mb-4">Edit profile</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-lbx-muted mb-2">Profile picture</label>
                <div
                  onDrop={onAvatarDrop}
                  onDragOver={onAvatarDragOver}
                  onDragLeave={onAvatarDragLeave}
                  className={`relative rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center py-8 px-4 min-h-[140px] ${
                    avatarDragOver
                      ? "border-lbx-green bg-lbx-green/10"
                      : "border-lbx-border bg-lbx-dark/50 hover:border-lbx-muted"
                  } ${uploadingAvatar ? "pointer-events-none opacity-70" : ""}`}
                >
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAvatarFile(f);
                      e.target.value = "";
                    }}
                    disabled={uploadingAvatar}
                  />
                  {uploadingAvatar ? (
                    <p className="text-sm text-lbx-muted">Uploading…</p>
                  ) : (
                    <>
                      {editAvatarUrl ? (
                        <img
                          src={editAvatarUrl}
                          alt=""
                          className="w-16 h-16 rounded-full object-cover border-2 border-lbx-border mb-2"
                        />
                      ) : (
                        <span className="text-3xl text-lbx-muted mb-2" aria-hidden>📷</span>
                      )}
                      <p className="text-sm text-lbx-muted text-center">
                        {avatarDragOver ? "Drop image here" : "Drag a photo here or click to choose"}
                      </p>
                      <p className="text-xs text-lbx-muted mt-1">JPEG, PNG or WebP · max {MAX_SIZE_MB}MB</p>
                    </>
                  )}
                </div>
                {avatarError && (
                  <p className="text-sm text-red-400 mt-2" role="alert">{avatarError}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowUrlInput((s) => !s)}
                  className="text-xs text-lbx-muted hover:text-lbx-green mt-2 transition-colors"
                >
                  {showUrlInput ? "Hide URL" : "Or paste image URL"}
                </button>
                {showUrlInput && (
                  <input
                    type="url"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-2 w-full px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-lbx-muted mb-1">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Road trip enthusiast..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm resize-none"
                />
                <p className="text-xs text-lbx-muted mt-1">{editBio.length}/500</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-lbx-muted mb-1">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Austin, TX"
                  maxLength={200}
                  className="w-full px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 rounded-md border border-lbx-border text-sm text-lbx-muted hover:text-lbx-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-lbx-green text-lbx-dark text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
