import { useState, useEffect } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { users, getAvatarSrc, type UserSummary, type ListSummary } from "../api";

const TABS = ["following", "followers", "lists"] as const;
type Tab = (typeof TABS)[number];

const TITLES: Record<Tab, string> = {
  following: "Following",
  followers: "Followers",
  lists: "Lists",
};

export function UserTab() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const tabFromPath = location.pathname.split("/").pop() ?? "following";
  const currentTab: Tab = TABS.includes(tabFromPath as Tab) ? (tabFromPath as Tab) : "following";
  const [username, setUsername] = useState<string | null>(null);
  const [userItems, setUserItems] = useState<UserSummary[]>([]);
  const [listItems, setListItems] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }
    setLoading(true);
    if (currentTab === "lists") {
      Promise.all([
        users.get(id).then((u) => u.username).catch(() => null),
        users.getLists(id).then((r) => r.items).catch(() => []),
      ]).then(([name, items]) => {
        setUsername(name ?? null);
        setListItems(items);
      }).finally(() => setLoading(false));
    } else {
      const fetcher = currentTab === "following" ? users.getFollowingList(id) : users.getFollowersList(id);
      Promise.all([
        users.get(id).then((u) => u.username).catch(() => null),
        fetcher.then((r) => r.items).catch(() => []),
      ]).then(([name, items]) => {
        setUsername(name ?? null);
        setUserItems(items);
      }).finally(() => setLoading(false));
    }
  }, [id, currentTab, navigate]);

  if (!id) return null;

  const displayName = username ?? "User";

  return (
    <div>
      <div className="mb-6">
        <Link to={`/user/${id}`} className="text-sm text-lbx-muted hover:text-lbx-green transition-colors">
          ← Back to {displayName}&apos;s profile
        </Link>
      </div>
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-lbx-white mb-6 tracking-tight">
        {displayName}&apos;s {TITLES[currentTab]}
      </h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-lbx-card rounded-lg border border-lbx-border p-4 skeleton h-16" />
          ))}
        </div>
      ) : currentTab === "lists" ? (
        listItems.length ? (
          <ul className="space-y-3">
            {listItems.map((list) => (
              <li key={list.id}>
                <Link
                  to={`/lists/${list.id}`}
                  className="flex items-center justify-between gap-4 bg-lbx-card rounded-lg border border-lbx-border p-4 hover:border-lbx-green/50 transition-colors"
                >
                  <div>
                    <span className="font-medium text-lbx-white">{list.title}</span>
                    {list.description && (
                      <p className="text-sm text-lbx-muted mt-0.5 line-clamp-1">{list.description}</p>
                    )}
                  </div>
                  <span className="text-sm text-lbx-muted tabular-nums">{list.itemCount} items</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
            <p className="text-lbx-muted text-sm">No public lists yet</p>
          </div>
        )
      ) : userItems.length ? (
        <ul className="space-y-3">
          {userItems.map((u) => (
            <li key={u.id}>
              <Link
                to={`/user/${u.id}`}
                className="flex items-center gap-4 bg-lbx-card rounded-lg border border-lbx-border p-4 hover:border-lbx-green/50 transition-colors"
              >
                {u.avatarUrl ? (
                  <img
                    src={getAvatarSrc(u.avatarUrl)}
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
          <p className="text-lbx-muted text-sm">No {TITLES[currentTab].toLowerCase()} yet</p>
        </div>
      )}
    </div>
  );
}
