import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { lists, type ListDetail as ListDetailType, type ListItemWithAttraction, type CommentItem } from "../api";
import { AttractionCard } from "../components/AttractionCard";
import { SORT_OPTIONS } from "../constants/sortOptions";

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function ListDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<ListDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sortIndex, setSortIndex] = useState(0);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [listComments, setListComments] = useState<CommentItem[]>([]);
  const [listCommentsLoading, setListCommentsLoading] = useState(false);
  const [listCommentText, setListCommentText] = useState("");
  const [listCommentSubmitting, setListCommentSubmitting] = useState(false);

  const sort = SORT_OPTIONS[sortIndex] ?? SORT_OPTIONS[0];
  const isDistanceSort = sort.value === "distance";

  useEffect(() => {
    if (!id || !token) {
      if (!token) navigate("/login");
      return;
    }
    lists
      .get(id)
      .then(setList)
      .catch(() => setList(null))
      .finally(() => setLoading(false));
  }, [id, token, navigate]);

  useEffect(() => {
    if (!id || !list?.public) {
      setListComments([]);
      return;
    }
    setListCommentsLoading(true);
    lists
      .getComments(id)
      .then((r) => setListComments(r.items))
      .catch(() => setListComments([]))
      .finally(() => setListCommentsLoading(false));
  }, [id, list?.public]);

  useEffect(() => {
    if (!isDistanceSort) return;
    if (userCoords != null) return;
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Location not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("Location denied or unavailable"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [isDistanceSort, userCoords]);

  const sortedItems = useMemo((): ListItemWithAttraction[] => {
    if (!list?.items.length) return [];
    const items = [...list.items];
    const { value, order } = sort;
    const mult = order === "asc" ? 1 : -1;
    if (value === "distance" && userCoords) {
      return items
        .map((item) => {
          const a = item.attraction;
          const lat = a.latitude != null ? parseFloat(a.latitude) : null;
          const lng = a.longitude != null ? parseFloat(a.longitude) : null;
          const dist =
            lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng)
              ? distanceMiles(userCoords.lat, userCoords.lng, lat, lng)
              : Infinity;
          return { item, dist };
        })
        .sort((a, b) => mult * (a.dist - b.dist))
        .map((x) => ({
          ...x.item,
          attraction: {
            ...x.item.attraction,
            distanceMiles: x.dist === Infinity ? undefined : x.dist,
          },
        }));
    }
    if (value === "name") {
      items.sort((a, b) => mult * ((a.attraction.name ?? "").localeCompare(b.attraction.name ?? "")));
      return items;
    }
    if (value === "state") {
      items.sort((a, b) => mult * ((a.attraction.state ?? "").localeCompare(b.attraction.state ?? "")));
      return items;
    }
    if (value === "city") {
      items.sort((a, b) => mult * ((a.attraction.city ?? "").localeCompare(b.attraction.city ?? "")));
      return items;
    }
    if (value === "visitCount") {
      items.sort((a, b) => mult * ((a.attraction.visitCount ?? 0) - (b.attraction.visitCount ?? 0)));
      return items;
    }
    if (value === "rating") {
      items.sort((a, b) => {
        const ra = a.attraction.avgRating ?? 0;
        const rb = b.attraction.avgRating ?? 0;
        return mult * (ra - rb);
      });
      return items;
    }
    if (value === "createdAt") {
      items.sort((a, b) => mult * (a.position - b.position));
      return items;
    }
    return items;
  }, [list?.items, sort, userCoords]);

  const handleRemove = async (attractionId: string) => {
    if (!id || removing) return;
    setRemoving(attractionId);
    try {
      await lists.removeItem(id, attractionId);
      setList((prev) =>
        prev
          ? { ...prev, items: prev.items.filter((i) => i.attractionId !== attractionId) }
          : null
      );
    } catch {
      // leave state
    } finally {
      setRemoving(null);
    }
  };

  if (!token) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 skeleton rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="poster-aspect skeleton rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="rounded-lg border border-lbx-border bg-lbx-card p-12 text-center">
        <p className="text-lbx-text font-medium">List not found</p>
        <Link to="/lists" className="text-lbx-green hover:underline mt-2 inline-block">Back to my lists</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/lists" className="text-sm text-lbx-muted hover:text-lbx-green mb-4 inline-block">
        ← Back to my lists
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-lbx-white tracking-tight">
            {list.title}
          </h1>
          {list.description && (
            <p className="text-lbx-muted mt-1">{list.description}</p>
          )}
          <p className="text-sm text-lbx-muted mt-1">{list.items.length} places</p>
        </div>
        {list.items.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest">Sort by</span>
            <select
              value={sortIndex}
              onChange={(e) => setSortIndex(Number(e.target.value))}
              className="pl-0 pr-6 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-lbx-white focus:border-lbx-muted focus:outline-none focus:ring-0 text-sm min-w-[140px] font-medium appearance-none bg-no-repeat bg-[length:10px] bg-[right_0_center] cursor-pointer transition-colors"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")" }}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isDistanceSort && userCoords == null && list.items.length > 0 && (
        <p className="text-sm text-lbx-muted mb-2">
          {locationError ? (
            <span>{locationError}. Choose another sort or allow location to see closest first.</span>
          ) : (
            <span>Getting your location…</span>
          )}
        </p>
      )}

      {sortedItems.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sortedItems.map((item) => (
            <div key={item.id} className="group relative">
              <AttractionCard a={item.attraction} />
              <button
                type="button"
                onClick={() => handleRemove(item.attractionId)}
                disabled={removing === item.attractionId}
                className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/70 flex items-center justify-center text-sm hover:bg-red-900/80 transition z-10 backdrop-blur-sm disabled:opacity-50"
                title="Remove from list"
                aria-label="Remove from list"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
          <p className="text-lbx-text font-medium mb-1">No attractions in this list</p>
          <p className="text-lbx-muted text-sm mb-4">
            Browse attractions and add them to this list from their page.
          </p>
          <Link
            to="/"
            className="inline-flex px-4 py-2.5 bg-lbx-green text-lbx-dark font-medium rounded-md hover:opacity-90 transition-opacity text-sm"
          >
            Explore attractions
          </Link>
        </div>
      )}

      {list.public && (
        <section className="mt-10 pt-8 border-t border-lbx-border/60">
          <h2 className="text-[11px] font-medium text-lbx-muted/90 uppercase tracking-widest mb-3">Comments</h2>
          {listCommentsLoading ? (
            <p className="text-sm text-lbx-muted/80">Loading…</p>
          ) : listComments.length === 0 ? (
            <p className="text-sm text-lbx-muted/80">No comments yet.</p>
          ) : (
            <ul className="space-y-2.5 mb-4">
              {listComments.map((com) => (
                <li key={com.id} className="flex items-start gap-2 text-sm">
                  <Link
                    to={`/user/${com.user.id}`}
                    className="flex-shrink-0 flex items-center gap-2 text-lbx-muted/90 hover:text-lbx-green transition-colors"
                  >
                    {com.user.avatarUrl ? (
                      <img src={com.user.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-lbx-border/80 flex items-center justify-center text-[10px] font-display">
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
                if (!id || !listCommentText.trim() || listCommentSubmitting) return;
                setListCommentSubmitting(true);
                try {
                  const newComment = await lists.addComment(id, listCommentText.trim());
                  setListComments((prev) => [...prev, newComment]);
                  setListCommentText("");
                } catch {
                  // ignore
                } finally {
                  setListCommentSubmitting(false);
                }
              }}
              className="flex items-center gap-2 max-w-md"
            >
              <input
                type="text"
                value={listCommentText}
                onChange={(e) => setListCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 min-w-0 px-0 py-2 bg-transparent border-0 border-b border-lbx-border/50 rounded-none text-sm text-lbx-white placeholder-lbx-muted/70 focus:border-lbx-muted focus:outline-none focus:ring-0 transition-colors"
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={!listCommentText.trim() || listCommentSubmitting}
                className="flex-shrink-0 text-sm font-medium text-lbx-muted hover:text-lbx-green transition-colors disabled:opacity-40 disabled:hover:text-lbx-muted"
              >
                {listCommentSubmitting ? "…" : "Post"}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
