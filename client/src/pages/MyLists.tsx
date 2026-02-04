import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { lists, type ListSummary } from "../api";

export function MyLists() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingWantToSee, setCreatingWantToSee] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    lists
      .list()
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token, navigate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const list = await lists.create({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        public: true,
      });
      setNewTitle("");
      setNewDescription("");
      setItems((prev) => [{ id: list.id, title: list.title, description: list.description, public: list.public, createdAt: list.createdAt, itemCount: 0 }, ...prev]);
      navigate(`/lists/${list.id}`);
    } catch {
      // leave form as is
    } finally {
      setCreating(false);
    }
  };

  const handleCreateWantToSee = async () => {
    if (creatingWantToSee) return;
    setCreatingWantToSee(true);
    try {
      const list = await lists.create({
        title: "Want to see",
        description: "Places I want to visit",
        public: true,
      });
      setItems((prev) => [{ id: list.id, title: list.title, description: list.description, public: list.public, createdAt: list.createdAt, itemCount: 0 }, ...prev]);
      navigate(`/lists/${list.id}`);
    } catch {
      // leave as is
    } finally {
      setCreatingWantToSee(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-lbx-white mb-2 tracking-tight">
        Saved places
      </h1>
      <p className="text-lbx-muted text-sm mb-8">
        Save places you want to see and come back to them anytime. Create lists to organize by trip, theme, or anything you like.
      </p>

      <form onSubmit={handleCreate} className="mb-10 p-6 bg-lbx-card rounded-lg border border-lbx-border">
        <h2 className="font-display font-semibold text-lg text-lbx-white mb-4">Create a new list</h2>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-lbx-muted mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Route 66 road trip"
              className="w-full px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-lbx-muted mb-1">Description (optional)</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What's this list about?"
              rows={2}
              className="w-full px-4 py-2.5 bg-lbx-dark border border-lbx-border rounded-md text-lbx-white placeholder-lbx-muted focus:border-lbx-green focus:ring-1 focus:ring-lbx-green focus:outline-none text-sm resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newTitle.trim()}
            className="px-4 py-2.5 bg-lbx-green text-lbx-dark font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
          >
            {creating ? "Creating…" : "Create list"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-lbx-card rounded-lg border border-lbx-border p-4 skeleton h-20" />
          ))}
        </div>
      ) : items.length ? (
        <ul className="space-y-3">
          {items.map((list) => (
            <li key={list.id}>
              <Link
                to={`/lists/${list.id}`}
                className="flex items-center justify-between bg-lbx-card rounded-lg border border-lbx-border p-4 hover:border-lbx-green/50 transition-colors"
              >
                <div>
                  <span className="font-medium text-lbx-white">{list.title}</span>
                  {list.description && (
                    <p className="text-sm text-lbx-muted mt-0.5 line-clamp-1">{list.description}</p>
                  )}
                </div>
                <span className="text-sm text-lbx-muted tabular-nums">{list.itemCount} places</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-lbx-border bg-lbx-card p-10 text-center">
          <p className="text-lbx-text font-medium mb-1">No saved places yet</p>
          <p className="text-lbx-muted text-sm mb-4">Click &quot;Save&quot; on any attraction to add it to &quot;Want to see&quot;, or create a list below.</p>
          <button
            type="button"
            onClick={handleCreateWantToSee}
            disabled={creatingWantToSee}
            className="px-4 py-2.5 bg-lbx-green text-lbx-dark font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
          >
            {creatingWantToSee ? "Creating…" : "Create Want to see list"}
          </button>
        </div>
      )}
    </div>
  );
}
