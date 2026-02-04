/** Read-only star display for ratings (e.g. ★★★★☆ with half-fill). */
type Props = {
  value: number;
  max?: number;
  className?: string;
  "aria-label"?: string;
};

const FILLED = "★";
const EMPTY = "☆";

export function StarDisplay({ value, max = 5, className = "", "aria-label": ariaLabel }: Props) {
  const filledColor = "text-amber-400";
  const emptyColor = "text-lbx-border/80";

  return (
    <span
      className={`inline-flex items-center gap-px ${className}`}
      aria-label={ariaLabel ?? `Rated ${value} out of ${max}`}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const fillAmount = Math.min(1, Math.max(0, value - i));
        if (fillAmount >= 1) {
          return <span key={i} className={filledColor} aria-hidden>{FILLED}</span>;
        }
        if (fillAmount >= 0.5) {
          return (
            <span key={i} className="relative inline-flex items-center justify-center shrink-0" aria-hidden>
              <span className={emptyColor}>{EMPTY}</span>
              <span className={`absolute inset-0 flex justify-start items-center overflow-hidden ${filledColor}`} style={{ width: "50%" }}>
                {FILLED}
              </span>
            </span>
          );
        }
        return <span key={i} className={emptyColor} aria-hidden>{EMPTY}</span>;
      })}
    </span>
  );
}
