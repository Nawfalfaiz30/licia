// Skeleton ringan (V55). Menghormati prefers-reduced-motion lewat motion-safe.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-xl bg-border/60 motion-safe:animate-pulse ${className}`} />;
}

export function PageSkeleton({ title = "Memuat…", variant = "list" }: { title?: string; variant?: "list" | "cards" | "calendar" | "form" }) {
  return (
    <main className="licia-main space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{title}</span>
      <Skeleton className="h-8 w-48" />
      {variant === "cards" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      )}
      {variant === "list" && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}
      {variant === "calendar" && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        </div>
      )}
      {variant === "form" && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}
    </main>
  );
}
