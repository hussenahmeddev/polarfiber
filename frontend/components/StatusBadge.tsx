import { cn } from "@/frontend/utils";
import type { OrderStatus, QuoteStatus } from "@/shared/data";

type StatusType = OrderStatus | QuoteStatus | string;

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // Order statuses
  Pending: {
    bg: "bg-amber-500/15 border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "Pending",
  },
  Confirmed: {
    bg: "bg-sky-500/15 border-sky-500/30",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    label: "Confirmed",
  },
  "In Production": {
    bg: "bg-indigo-500/15 border-indigo-500/30",
    text: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500 animate-pulse",
    label: "In Production",
  },
  Delivered: {
    bg: "bg-emerald-500/15 border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Delivered",
  },
  Cancelled: {
    bg: "bg-rose-500/15 border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Cancelled",
  },
  // Quote statuses
  New: {
    bg: "bg-amber-500/15 border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "New",
  },
  Replied: {
    bg: "bg-emerald-500/15 border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    label: "Replied",
  },
  Closed: {
    bg: "bg-zinc-500/15 border-zinc-500/30",
    text: "text-zinc-700 dark:text-zinc-300",
    dot: "bg-zinc-400",
    label: "Closed",
  },
};

export function StatusBadge({
  s,
  className,
  showDot = true,
}: {
  s: StatusType;
  className?: string;
  showDot?: boolean;
}) {
  const cfg = statusConfig[s] ?? {
    bg: "bg-muted border-border",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    label: s,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
        cfg.bg,
        cfg.text,
        className,
      )}
    >
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} aria-hidden="true" />}
      {cfg.label}
    </span>
  );
}
