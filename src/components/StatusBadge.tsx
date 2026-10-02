const tone: Record<string, string> = {
  Pending: "bg-warning/20 text-foreground",
  New: "bg-warning/20 text-foreground",
  Confirmed: "bg-secondary text-secondary-foreground",
  Replied: "bg-secondary text-secondary-foreground",
  "In Production": "bg-accent/30 text-accent-foreground",
  Delivered: "bg-success/20 text-success",
  Closed: "bg-muted text-muted-foreground",
  Cancelled: "bg-destructive/15 text-destructive",
};
export function StatusBadge({ s }: { s: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[s] ?? "bg-muted"}`}>{s}</span>;
}
