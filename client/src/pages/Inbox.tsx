import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { users, friends, type InboxItem, type FeedCheckIn } from "../api";
import { StarDisplay } from "../components/StarDisplay";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffWeeks < 4) return `${diffWeeks}w`;
  if (diffMonths < 12) return `${diffMonths}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

type Tab = "incoming" | "friends" | "you";

function InboxRow({ item }: { item: InboxItem & { rating?: number | null } }) {
  const label =
    item.type === "like_review"
      ? "liked your review"
      : item.type === "like_list"
        ? "liked your list"
        : item.type === "comment_review"
          ? "commented on your review"
          : "commented on your list";
  const target =
    item.attractionId != null ? (
      <Link
        to={`/attraction/${item.attractionId}`}
        className="text-lbx-white hover:text-lbx-green transition-colors"
      >
        {item.attractionName ?? "Attraction"}
      </Link>
    ) : item.listId != null ? (
      <Link
        to={`/lists/${item.listId}`}
        className="text-lbx-white hover:text-lbx-green transition-colors"
      >
        {item.listTitle ?? "List"}
      </Link>
    ) : null;

  return (
    <>
      <li className="flex items-center gap-3 py-3 border-b border-lbx-border/40">
        <Link to={`/user/${item.actor.id}`} className="shrink-0">
          {item.actor.avatarUrl ? (
            <img
              src={item.actor.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover bg-lbx-border"
            />
          ) : (
            <span className="w-8 h-8 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted text-xs font-medium">
              {(item.actor.username || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1 flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-sm">
          <Link
            to={`/user/${item.actor.id}`}
            className="font-medium text-lbx-white hover:text-lbx-green transition-colors"
          >
            {item.actor.username}
          </Link>
          <span className="text-lbx-muted">{label}</span>
          {item.type === "like_review" && item.rating != null && (
            <span className="inline-flex">
              <StarDisplay value={item.rating} className="text-xs" />
            </span>
          )}
          {target && (
            <>
              <span className="text-lbx-muted">·</span>
              <span className="min-w-0 truncate max-w-[180px] sm:max-w-none">{target}</span>
            </>
          )}
        </div>
        <time
          dateTime={item.createdAt}
          className="text-lbx-muted text-xs shrink-0 tabular-nums"
        >
          {formatTime(item.createdAt)}
        </time>
      </li>
      {(item.type === "comment_review" || item.type === "comment_list") &&
        item.commentSnippet && (
          <li className="py-1.5 pl-11 text-sm text-lbx-muted border-b border-lbx-border/40">
            {item.commentSnippet}
          </li>
        )}
    </>
  );
}

function FriendsRow({ c }: { c: FeedCheckIn }) {
  return (
    <li className="flex items-center gap-3 py-3 border-b border-lbx-border/40">
      <Link to={`/user/${c.user.id}`} className="shrink-0">
        {c.user.avatarUrl ? (
          <img
            src={c.user.avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover bg-lbx-border"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted text-xs font-medium">
            {(c.user.username || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <Link
          to={`/user/${c.user.id}`}
          className="font-medium text-lbx-white hover:text-lbx-green transition-colors"
        >
          {c.user.username}
        </Link>
        <span className="text-lbx-muted"> checked in at </span>
        <Link
          to={`/attraction/${c.attraction.id}`}
          className="text-lbx-white hover:text-lbx-green transition-colors"
        >
          {c.attraction.name}
        </Link>
        {c.rating != null && (
          <span className="ml-1.5 inline-flex">
            <StarDisplay value={c.rating} className="text-xs" />
          </span>
        )}
      </div>
      <time
        dateTime={c.createdAt}
        className="text-lbx-muted text-xs shrink-0 tabular-nums"
      >
        {formatTime(c.createdAt)}
      </time>
    </li>
  );
}

export function Inbox() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("incoming");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [feed, setFeed] = useState<FeedCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    users
      .inbox({ limit: 50 })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token, navigate]);

  useEffect(() => {
    if (tab !== "friends" || !token) return;
    setFeedLoading(true);
    friends
      .feed({ limit: 50 })
      .then((r) => setFeed(r.items))
      .catch(() => setFeed([]))
      .finally(() => setFeedLoading(false));
  }, [tab, token]);

  if (!user) return null;

  const tabClass = (t: Tab) =>
    `pb-3 text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors border-b-2 -mb-px ${
      tab === t
        ? "text-lbx-white border-lbx-green"
        : "text-lbx-muted border-transparent hover:text-lbx-white"
    }`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 text-lbx-text">
      <div className="flex items-center gap-8 border-b border-lbx-border mb-6">
        <button
          type="button"
          className={tabClass("incoming")}
          onClick={() => setTab("incoming")}
        >
          Incoming
        </button>
        <button
          type="button"
          className={tabClass("friends")}
          onClick={() => setTab("friends")}
        >
          Friends
        </button>
        <button
          type="button"
          className={tabClass("you")}
          onClick={() => setTab("you")}
        >
          You
        </button>
      </div>

      {tab === "incoming" && (
        loading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 border-b border-lbx-border/40 animate-pulse rounded"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lbx-muted text-sm">No activity yet.</p>
            <p className="text-lbx-muted text-xs mt-2">
              When someone likes or comments on your reviews or lists, it will show up here.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-0">
              {items.map((item) => (
                <InboxRow key={item.id} item={item} />
              ))}
            </ul>
            <p className="text-lbx-muted text-xs text-center py-6">
              End of recent activity
            </p>
          </>
        )
      )}

      {tab === "friends" && (
        feedLoading ? (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 border-b border-lbx-border/40 animate-pulse rounded"
              />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lbx-muted text-sm">No recent check-ins from people you follow.</p>
            <p className="text-lbx-muted text-xs mt-2">
              <Link to="/people" className="text-lbx-green hover:underline">
                Find people to follow
              </Link>
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-0">
              {feed.map((c) => (
                <FriendsRow key={c.id} c={c} />
              ))}
            </ul>
            <p className="text-lbx-muted text-xs text-center py-6">
              End of recent activity
            </p>
          </>
        )
      )}

      {tab === "you" && (
        <div className="py-16 text-center">
          <p className="text-lbx-muted text-sm">Your activity across Roadtrippi.</p>
          <p className="text-lbx-muted text-xs mt-2">
            <Link to="/profile" className="text-lbx-green hover:underline">
              View your profile
            </Link>
            {" "}to see your check-ins and lists.
          </p>
        </div>
      )}
    </div>
  );
}
