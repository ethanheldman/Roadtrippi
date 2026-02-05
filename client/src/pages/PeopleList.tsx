import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { friends, users, type UserSummary, type InboxItem, type FeedCheckIn } from "../api";
import { StarDisplay } from "../components/StarDisplay";

const TABS = ["friends", "following", "followers", "activity"] as const;
type Tab = (typeof TABS)[number];

const FETCHERS = {
  friends: friends.list,
  following: friends.following,
  followers: friends.followers,
} as const;

const TITLES: Record<Tab, string> = {
  friends: "Activity",
  following: "Following",
  followers: "Followers",
  activity: "Feed",
};

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

function ActivityRow({ item }: { item: InboxItem & { rating?: number | null } }) {
  const label =
    item.type === "like_review"
      ? "liked your review"
      : item.type === "like_list"
        ? "liked your list"
        : item.type === "comment_review"
          ? "commented on your review"
          : item.type === "comment_list"
            ? "commented on your list"
            : "started following you";
  const target =
    item.attractionId != null ? (
      <Link
        to={`/attraction/${item.attractionId}`}
        onClick={(e) => e.stopPropagation()}
        className="text-lbx-white hover:text-lbx-green transition-colors"
      >
        {item.attractionName ?? "Attraction"}
      </Link>
    ) : item.listId != null ? (
      <Link
        to={`/lists/${item.listId}`}
        onClick={(e) => e.stopPropagation()}
        className="text-lbx-white hover:text-lbx-green transition-colors"
      >
        {item.listTitle ?? "List"}
      </Link>
    ) : null;

  return (
    <li>
      <div className="flex items-center gap-4 bg-lbx-card rounded-lg border border-lbx-border p-4 hover:border-lbx-green/50 transition-colors">
        <Link to={`/user/${item.actor.id}`} className="shrink-0">
          {item.actor.avatarUrl ? (
            <img
              src={item.actor.avatarUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover bg-lbx-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted font-display text-lg">
              {(item.actor.username || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-lbx-white">
            <Link to={`/user/${item.actor.id}`} className="hover:text-lbx-green transition-colors">
              {item.actor.username}
            </Link>
          </p>
          <p className="text-sm text-lbx-muted flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{label}</span>
            {item.type === "like_review" && item.rating != null && (
              <span className="inline-flex">
                <StarDisplay value={item.rating} className="text-xs" />
              </span>
            )}
            {target && (
              <>
                <span>·</span>
                <span className="truncate max-w-[200px] sm:max-w-none">{target}</span>
              </>
            )}
          </p>
          {(item.type === "comment_review" || item.type === "comment_list") && item.commentSnippet && (
            <p className="text-sm text-lbx-muted mt-1 truncate max-w-md">{item.commentSnippet}</p>
          )}
        </div>
        <time
          dateTime={item.createdAt}
          className="text-lbx-muted text-xs shrink-0 tabular-nums"
        >
          {formatTime(item.createdAt)}
        </time>
      </div>
    </li>
  );
}

function FeedRow({ c }: { c: FeedCheckIn }) {
  return (
    <li>
      <div className="flex items-center gap-4 bg-lbx-card rounded-lg border border-lbx-border p-4 hover:border-lbx-green/50 transition-colors">
        <Link to={`/user/${c.user.id}`} className="shrink-0">
          {c.user.avatarUrl ? (
            <img
              src={c.user.avatarUrl}
              alt=""
              className="w-12 h-12 rounded-full object-cover bg-lbx-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted font-display text-lg">
              {(c.user.username || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-lbx-white">
            <Link to={`/user/${c.user.id}`} className="hover:text-lbx-green transition-colors">
              {c.user.username}
            </Link>
          </p>
          <p className="text-sm text-lbx-muted">
            checked in at{" "}
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
          </p>
        </div>
        <time
          dateTime={c.createdAt}
          className="text-lbx-muted text-xs shrink-0 tabular-nums"
        >
          {formatTime(c.createdAt)}
        </time>
      </div>
    </li>
  );
}

export function PeopleList() {
  const { tab } = useParams<{ tab: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [feed, setFeed] = useState<FeedCheckIn[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const currentTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "friends";

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    if (currentTab === "activity") {
      setActivityLoading(true);
      Promise.all([
        users.inbox({ limit: 50 }),
        friends.feed({ limit: 30 }),
      ])
        .then(([inboxRes, feedRes]) => {
          setInboxItems(inboxRes.items);
          setFeed(feedRes.items);
        })
        .catch(() => {
          setInboxItems([]);
          setFeed([]);
        })
        .finally(() => setActivityLoading(false));
      return;
    }
    setLoading(true);
    FETCHERS[currentTab]()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token, navigate, currentTab]);

  if (!token) return null;

  return (
    <div>
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-lbx-white mb-6 tracking-tight">
        {TITLES[currentTab]}
      </h1>

      <nav className="flex gap-4 mb-8 border-b border-lbx-border pb-2">
        {TABS.map((t) => (
          <Link
            key={t}
            to={`/profile/${t}`}
            className={`font-medium capitalize ${
              currentTab === t ? "text-lbx-green" : "text-lbx-muted hover:text-lbx-white transition-colors"
            }`}
          >
            {TITLES[t]}
          </Link>
        ))}
      </nav>

      {currentTab === "activity" ? (
        activityLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-lbx-card rounded-lg border border-lbx-border p-4 skeleton h-20" />
            ))}
          </div>
        ) : inboxItems.length === 0 && feed.length === 0 ? (
          <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
            <p className="text-lbx-text font-medium mb-1">No activity yet</p>
            <p className="text-lbx-muted text-sm">
              When someone follows you, likes or comments on your reviews or lists, or when people you follow check in, it will show up here.
            </p>
            <p className="text-lbx-muted text-sm mt-2">
              <Link to="/people" className="text-lbx-green hover:underline">Find people to follow</Link>
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {inboxItems.length > 0 && (
              <section>
                <h2 className="font-display font-semibold text-lg text-lbx-white mb-3 tracking-tight">
                  Likes & comments on your content
                </h2>
                <ul className="space-y-3">
                  {inboxItems.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            )}
            {feed.length > 0 && (
              <section>
                <h2 className="font-display font-semibold text-lg text-lbx-white mb-3 tracking-tight">
                  From people you follow
                </h2>
                <ul className="space-y-3">
                  {feed.map((c) => (
                    <FeedRow key={c.id} c={c} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-lbx-card rounded-lg border border-lbx-border p-4 skeleton h-16" />
          ))}
        </div>
      ) : items.length ? (
        <ul className="space-y-3">
          {items.map((u) => (
            <li key={u.id}>
              <Link
                to={`/user/${u.id}`}
                className="flex items-center gap-4 bg-lbx-card rounded-lg border border-lbx-border p-4 hover:border-lbx-green/50 transition-colors"
              >
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover bg-lbx-border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-lbx-border flex items-center justify-center text-lbx-muted font-display text-lg">
                    {u.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="font-medium text-lbx-white">{u.username}</span>
                  {(u.bio || u.location) && (
                    <p className="text-sm text-lbx-muted truncate max-w-md">
                      {[u.bio, u.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
          <p className="text-lbx-text font-medium mb-1">No {TITLES[currentTab].toLowerCase()} yet</p>
          <p className="text-lbx-muted text-sm">
            {currentTab === "friends" && "Follow people and have them follow you back to see friends here."}
            {currentTab === "following" && "Visit someone's profile and click Follow to see them here."}
            {currentTab === "followers" && "When others follow you, they'll show up here."}
          </p>
        </div>
      )}
    </div>
  );
}
