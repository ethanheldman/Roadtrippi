import { useState } from "react";

type AttractionImageProps = {
  imageUrl: string | null | undefined;
  alt?: string;
  className?: string;
  /** Optional placeholder when no image or load fails. Defaults to the Roadtrippi muffler-man. */
  placeholder?: React.ReactNode;
};

/**
 * Branded placeholder: uses the site's existing muffler-man logo at ~40% opacity on a
 * dimmed card background. Replaces the 🗿 emoji which felt generic and off-brand.
 * Accepts any ReactNode via `placeholder` for callers that want a larger / custom fallback.
 */
export function AttractionPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full h-full flex items-center justify-center min-h-0 bg-lbx-border/60 ${className}`}>
      <img
        src="/roadtrippi-logo.png"
        alt=""
        aria-hidden
        className="w-1/2 max-w-[80px] opacity-30 mix-blend-luminosity select-none"
        draggable={false}
      />
    </div>
  );
}

/**
 * Renders an attraction image with referrerPolicy="no-referrer" so external hosts
 * (e.g. Wikimedia, Flickr) don't block the request, and falls back to placeholder on error.
 */
export function AttractionImage({ imageUrl, alt = "", className, placeholder }: AttractionImageProps) {
  const [error, setError] = useState(false);
  const showPlaceholder = !imageUrl || error;

  if (showPlaceholder) {
    return <>{placeholder ?? <AttractionPlaceholder />}</>;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}
