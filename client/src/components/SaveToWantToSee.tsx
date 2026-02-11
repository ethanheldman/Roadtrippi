import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { lists } from "../api";

const WANT_TO_SEE_TITLE = "Want to see";

type Props = {
  attractionId: string;
  onSaved?: () => void;
  className?: string;
  /** Compact style for cards (icon + label) */
  compact?: boolean;
};

export function SaveToWantToSee({ attractionId, onSaved, className = "", compact = false }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const { items } = await lists.list();
      let wantToSee = items.find((l) => l.title === WANT_TO_SEE_TITLE);
      if (!wantToSee) {
        const created = await lists.create({
          title: WANT_TO_SEE_TITLE,
          description: "Places I want to visit",
          public: true,
        });
        wantToSee = {
          id: created.id,
          title: created.title,
          description: created.description,
          public: created.public,
          createdAt: created.createdAt,
          itemCount: 0,
        };
      }
      await lists.addItem(wantToSee.id, { attractionId });
      setJustSaved(true);
      onSaved?.();
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      // leave button clickable to retry
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (justSaved) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-sm text-lbx-green ${className}`}
        aria-live="polite"
      >
        {compact ? (
          <>
            <span aria-hidden>✓</span>
            <span>Saved</span>
          </>
        ) : (
          <>Saved ✓</>
        )}
      </span>
    );
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSave();
        }}
        disabled={saving}
        className={`inline-flex items-center gap-1.5 text-sm text-lbx-muted hover:text-lbx-green transition-colors disabled:opacity-50 ${className}`}
        aria-label="Add to Want to see list"
        title="Add to your Want to see list"
      >
        <span aria-hidden>🔖</span>
        <span>{saving ? "Saving…" : "Want to see"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      className={`px-3 py-1.5 border border-lbx-border rounded text-sm text-lbx-muted hover:border-lbx-green hover:text-lbx-green transition-colors disabled:opacity-50 ${className}`}
      aria-label="Add to Want to see list"
      title="Add to your Want to see list"
    >
      {saving ? "Saving…" : "Add to Want to see"}
    </button>
  );
}
