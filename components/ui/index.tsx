import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export function Card({
  children,
  id,
  className,
  raised = false,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  raised?: boolean;
}) {
  return (
    <div
      id={id}
      className={clsx(
        "licia-card rounded-[var(--radius-lg)] border border-border shadow-sm transition-[box-shadow,border-color] duration-180",
        raised ? "bg-surfaceRaised" : "bg-surface",
        "hover:shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2.5">
      <h2 className="min-w-0 flex-1 font-display text-xl text-text break-words">{children}</h2>
      {action && <div className="min-w-0 max-w-full shrink-0">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "default" | "accent" | "success" | "danger";
  hint?: string;
}) {
  const toneColor = { default: "text-text", accent: "text-accent", success: "text-success", danger: "text-danger" }[
    tone
  ];
  return (
    <div className="licia-stat-motion min-w-0 rounded-xl border border-border bg-surface transition hover:-translate-y-1 hover:shadow-md animate-licia-pop-in">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="shrink-0 rounded-lg bg-accent/10 p-2">
            <Icon size={18} className="text-accent" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs text-textMuted">{label}</p>
          <p className={clsx("truncate font-display text-lg tabular-nums", toneColor)}>{value}</p>
          {hint && <p className="mt-0.5 truncate text-2xs text-textMuted">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export { EmptyState } from "@/components/ui/EmptyState";

export function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "licia-v33-ripple inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-medium text-white shadow-sm transition-[box-shadow,opacity] duration-180 hover:opacity-90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text outline-none transition focus:ring-2 focus:ring-accent/40",
        props.className,
      )}
    />
  );
}

export function SoftButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "licia-v33-ripple inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-textMuted transition-[box-shadow,border-color,color] duration-180 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export { ActionDialog, TextPromptDialog } from "./dialog";
export { ToastProvider, notifyToast } from "./toast";

export { AnimatedNumber } from "./AnimatedNumber";

export function Chip({
  children,
  active = false,
  tone = "default",
  onClick,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  tone?: "default" | "accent" | "danger" | "success";
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <span
      className={clsx(
        "inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border px-3 text-2xs font-semibold transition-colors duration-180",
        active
          ? "border-accent bg-accent text-white"
          : tone === "danger"
            ? "border-danger/20 bg-danger/5 text-danger"
            : tone === "success"
              ? "border-success/20 bg-success/5 text-success"
              : tone === "accent"
                ? "border-accent/20 bg-accent/5 text-accent"
                : "border-border bg-surface text-textMuted",
        className,
      )}
    >
      {children}
    </span>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="shrink-0">
      {body}
    </button>
  ) : (
    body
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("animate-pulse rounded-[var(--radius-md)] bg-bg", className)} />;
}
