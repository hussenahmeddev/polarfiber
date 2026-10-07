import type { LucideIcon } from "lucide-react";
import { cn } from "@/frontend/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  variant?: "default" | "primary" | "warning" | "success" | "accent";
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  trend,
  variant = "default",
  onClick,
  className,
}: StatCardProps) {
  const isInteractive = !!onClick;

  const variantStyles = {
    default: "bg-card text-card-foreground border-border",
    primary:
      "bg-gradient-to-br from-primary/10 via-card to-card text-card-foreground border-primary/30",
    accent:
      "bg-water text-deep-foreground border-transparent shadow-soft",
    warning:
      "bg-amber-500/10 text-card-foreground border-amber-500/30",
    success:
      "bg-emerald-500/10 text-card-foreground border-emerald-500/30",
  };

  const iconStyles = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/20 text-primary",
    accent: "bg-white/20 text-white",
    warning: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    success: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border p-5 transition-all duration-200",
        variantStyles[variant],
        isInteractive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            variant === "accent" ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
            iconStyles[variant],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3">
        <div
          className={cn(
            "font-display text-2xl font-bold tracking-tight md:text-3xl",
            variant === "accent" ? "text-white" : "text-foreground",
          )}
        >
          {value}
        </div>
        {(subtext || trend) && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            {trend && (
              <span
                className={cn(
                  "font-medium",
                  trend.positive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {trend.value}
              </span>
            )}
            {subtext && (
              <span
                className={
                  variant === "accent" ? "text-white/70" : "text-muted-foreground"
                }
              >
                {subtext}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
