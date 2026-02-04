import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { friends, type UserSummary } from "../api";

const TABS = ["friends", "following", "followers"] as const;
type Tab = (typeof TABS)[number];

const FETCHERS = {
  friends: friends.list,
  following: friends.following,
  followers: friends.followers,
};

const TITLES: Record<Tab, string> = {
  friends: "Friends",
  following: "Following",
  followers: "Followers",
};

export function PeopleList() {
  const { tab } = useParams<{ tab: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const currentTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "friends";

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
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

      {loading ? (
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
