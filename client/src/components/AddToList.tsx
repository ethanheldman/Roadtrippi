import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { lists, type ListSummary } from "../api";

type AddToListProps = {
  attractionId: string;
  onAdded?: () => void;
  className?: string;
  variant?: "button" | "dropdown" | "section";
};

export function AddToList({ attractionId, onAdded, className = "", variant = "button" }: AddToListProps) {
  const { user } = useAuth();
  const [listsList, setListsList] = useState<ListSummary[]>([]);
  const [loading, _setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    lists
      .list()
      .then((r) => setListsList(r.items))
      .catch(() => setListsList([]));
  }, [user]);

  const handleAdd = async (listId: string) => {
    if (adding) return;
    setAdding(listId);
    try {
      await lists.addItem(listId, { attractionId });
      setOpen(false);
      onAdded?.();
    } catch {
      // leave dropdown open
    } finally {
      setAdding(null);
    }
  };

  if (!user) return null;
  if (listsList.length === 0 && !loading) {
    return (
      <Link
        to="/lists"
        className={className || "text-sm text-lbx-muted hover:text-lbx-green transition-colors"}
      >
        Create a list to save places
      </Link>
    );
  }

  if (variant === "section") {
    return (
      <section className="mt-6 pt-6 border-t border-lbx-border">
        <h2 className="font-display font-semibold text-base text-lbx-white mb-2">Save to a list</h2>
        <p className="text-sm text-lbx-muted mb-3">Add this attraction to one of your lists.</p>
        {listsList.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {listsList.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => handleAdd(list.id)}
                disabled={adding === list.id}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-lbx-border bg-lbx-dark/50 text-sm text-lbx-white hover:border-lbx-green hover:bg-lbx-green/10 transition-colors disabled:opacity-50"
              >
                {adding === list.id ? "Adding…" : `+ ${list.title}`}
                <span className="text-lbx-muted">({list.itemCount})</span>
              </button>
            ))}
            <Link
              to="/lists"
              className="inline-flex items-center px-3 py-2 rounded-lg border border-dashed border-lbx-border text-sm text-lbx-muted hover:border-lbx-green hover:text-lbx-green transition-colors"
            >
              + New list
            </Link>
          </div>
        ) : (
          <Link
            to="/lists"
            className="inline-flex items-center px-4 py-2 rounded-lg border border-lbx-border text-sm text-lbx-green hover:border-lbx-green hover:bg-lbx-green/10 transition-colors"
          >
            Create your first list →
          </Link>
        )}
      </section>
    );
  }

  if (variant === "dropdown") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-3 py-1.5 border border-lbx-border rounded text-sm text-lbx-muted hover:border-lbx-green hover:text-lbx-green transition-colors"
        >
          Add to list ▾
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <ul className="absolute top-full left-0 mt-1 py-1 bg-lbx-card border border-lbx-border rounded-md shadow-lg z-20 min-w-[180px] max-h-60 overflow-auto">
              {listsList.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(list.id)}
                    disabled={adding === list.id}
                    className="w-full text-left px-3 py-2 text-sm text-lbx-white hover:bg-lbx-border transition-colors disabled:opacity-50"
                  >
                    {adding === list.id ? "Adding…" : list.title}
                    <span className="text-lbx-muted ml-1">({list.itemCount})</span>
                  </button>
                </li>
              ))}
              <li className="border-t border-lbx-border mt-1 pt-1">
                <Link
                  to="/lists"
                  className="block px-3 py-2 text-sm text-lbx-green hover:bg-lbx-border transition-colors"
                  onClick={() => setOpen(false)}
                >
                  + New list
                </Link>
              </li>
            </ul>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-4 py-2.5 border border-lbx-border rounded-md text-sm text-lbx-muted hover:border-lbx-green hover:text-lbx-green transition-colors"
      >
        Add to list ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute top-full left-0 mt-1 py-1 bg-lbx-card border border-lbx-border rounded-md shadow-lg z-20 min-w-[200px] max-h-60 overflow-auto">
            {listsList.map((list) => (
              <li key={list.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(list.id)}
                  disabled={adding === list.id}
                  className="w-full text-left px-3 py-2 text-sm text-lbx-white hover:bg-lbx-border transition-colors disabled:opacity-50"
                >
                  {adding === list.id ? "Adding…" : list.title}
                  <span className="text-lbx-muted ml-1">({list.itemCount})</span>
                </button>
              </li>
            ))}
            <li className="border-t border-lbx-border mt-1 pt-1">
              <Link
                to="/lists"
                className="block px-3 py-2 text-sm text-lbx-green hover:bg-lbx-border transition-colors"
                onClick={() => setOpen(false)}
              >
                + Create new list
              </Link>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
