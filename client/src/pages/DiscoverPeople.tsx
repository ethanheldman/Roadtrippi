import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { users, friends, getAvatarSrc, type UserSummary } from "../api";

export function DiscoverPeople() {
  const { user: me, token, refresh } = useAuth();
  const [items, setItems] = useState<UserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);

  const limit = 20;

  useEffect(() => {
    if (token) {
      friends.following().then((r) => setFollowingIds(new Set(r.items.map((u) => u.id)))).catch(() => {});
    } else {
      setFollowingIds(new Set());
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    users
      .list({ page, limit, search: search || undefined })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  const handleFollow = async (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token || followLoadingId) return;
    setFollowError(null);
    setFollowLoadingId(userId);
    try {
      await friends.follow(userId);
      setFollowingIds((prev) => new Set(prev).add(userId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn’t follow. Try again.";
      setFollowError(message);
      if (message === "Unauthorized") refresh();
    } finally {
      setFollowLoadingId(null);
    }
  };

  const handleUnfollow = async (userId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token || followLoadingId) return;
    setFollowError(null);
    setFollowLoadingId(userId);
    try {
      await friends.unfollow(userId);
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn’t unfollow. Try again.";
      setFollowError(message);
      if (message === "Unauthorized") refresh();
    } finally {
      setFollowLoadingId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-lbx-white mb-2 tracking-tight">
        Discover people
      </h1>
      <p className="text-lbx-muted text-sm mb-2">
        Find other travelers to follow and see their check-ins and reviews.
      </p>
      <p className="text-lbx-muted text-xs mb-6">
        To test following: sign up a second account (e.g. in an incognito window), then from one account click Follow on the other. Your own row won’t show a Follow button.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8 max-w-md">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by username..."
          className="flex-1 px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-lbx-green text-lbx-dark font-medium rounded-md hover:opacity-90 transition-opacity text-sm"
        >
          Search
        </button>
      </form>

      {followError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-sm">
          {followError}
          <button
            type="button"
            onClick={() => setFollowError(null)}
            className="ml-2 underline hover:no-underline"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-lbx-card rounded-lg border border-lbx-border p-4 skeleton h-16" />
          ))}
        </div>
      ) : items.length ? (
        <>
          <ul className="space-y-3">
            {items.map((u) => {
              const isFollowing = followingIds.has(u.id);
              const isLoading = followLoadingId === u.id;
              const isOwn = me?.id === u.id;
              return (
                <li key={u.id}>
                  <div className="flex items-center gap-4 bg-lbx-card rounded-lg border border-lbx-border p-4 hover:border-lbx-green/30 transition-colors">
                    <Link
                      to={`/user/${u.id}`}
                      className="flex items-center gap-4 min-w-0 flex-1"
                    >
                      {u.avatarUrl ? (
                        <img
                          src={getAvatarSrc(u.avatarUrl)}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover bg-lbx-border shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted font-display text-lg shrink-0">
                          {u.username.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-lbx-white">{u.username}</span>
                        <p className="text-sm text-lbx-muted">
                          {(u.followersCount ?? 0)} follower{(u.followersCount ?? 0) === 1 ? "" : "s"}
                          {" · "}
                          {(u.checkInCount ?? 0)} check-in{(u.checkInCount ?? 0) === 1 ? "" : "s"}
                        </p>
                        {(u.bio || u.location) && (
                          <p className="text-sm text-lbx-muted truncate">
                            {[u.bio, u.location].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </Link>
                    {token && me && !isOwn && (
                      <div className="shrink-0 relative z-10">
                        {isFollowing ? (
                          <button
                            type="button"
                            onClick={(e) => handleUnfollow(u.id, e)}
                            disabled={isLoading}
                            className="bg-lbx-card border border-lbx-border text-lbx-text px-4 py-2 rounded-md font-medium hover:border-lbx-muted transition-colors disabled:opacity-50 text-sm cursor-pointer"
                          >
                            {isLoading ? "…" : "Unfollow"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleFollow(u.id, e)}
                            disabled={isLoading}
                            className="bg-lbx-green text-lbx-dark px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 text-sm cursor-pointer"
                          >
                            {isLoading ? "…" : "Follow"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-lbx-border rounded text-sm text-lbx-muted hover:text-lbx-white disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-lbx-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-lbx-border rounded text-sm text-lbx-muted hover:text-lbx-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
          <p className="text-lbx-text font-medium mb-1">No users found</p>
          <p className="text-lbx-muted text-sm">
            {search ? "Try a different search." : "No one has signed up yet."}
          </p>
        </div>
      )}
    </div>
  );
}
