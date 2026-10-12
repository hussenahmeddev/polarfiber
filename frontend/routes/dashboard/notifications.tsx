import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState } from "@/frontend/components/EmptyState";
import { Bell, CheckCheck, Clock } from "lucide-react";
import { useStore } from "@/frontend/store";
import { getMyNotifications } from "@/backend/api.functions";
import { cn } from "@/frontend/utils";

export const Route = createFileRoute("/dashboard/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Customer Dashboard | Polar Fiber" },
      { name: "description", content: "View all your order and account notifications." },
    ],
  }),
  component: DashboardNotificationsPage,
});

interface CustomerNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: "order" | "quote" | "system";
}

const INITIAL_NOTIFICATIONS: CustomerNotification[] = [
  {
    id: "notif-1",
    title: "Order Received",
    message:
      "Thank you for choosing Polar Fiber. Your order has been registered and is being reviewed by engineering.",
    date: "Just now",
    read: false,
    type: "order",
  },
  {
    id: "notif-2",
    title: "Catalog Updated",
    message:
      "New heavy-duty corrugated fiberglass roof sheets and vertical water tankers are now available in catalog.",
    date: "1 day ago",
    read: true,
    type: "system",
  },
];

function DashboardNotificationsPage() {
  const { user } = useStore();
  const fetchNotifications = useServerFn(getMyNotifications);

  const notificationsQuery = useQuery({
    queryKey: ["customer", "notifications", user?.user_id],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
  });

  const [localNotifications, setLocalNotifications] =
    React.useState<CustomerNotification[]>(INITIAL_NOTIFICATIONS);

  const displayNotifications = React.useMemo(() => {
    if (!notificationsQuery.data || !notificationsQuery.data.length) {
      return localNotifications;
    }
    const dbNotifs: CustomerNotification[] = notificationsQuery.data.map((n) => ({
      id: `db-notif-${n.id}`,
      title: n.title,
      message: n.body,
      date: n.created_at || "Recent",
      read: Boolean(n.is_read),
      type: (n.type.includes("order")
        ? "order"
        : n.type.includes("quote")
          ? "quote"
          : "system") as CustomerNotification["type"],
    }));
    return [...dbNotifs, ...localNotifications];
  }, [notificationsQuery.data, localNotifications]);

  const unreadCount = displayNotifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Account Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time updates regarding your fiberglass orders, quotes, and fabrication milestones
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            className="text-xs text-primary border-primary/20 gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {displayNotifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="When your orders update or quotes are generated, notifications will appear here."
          icon={Bell}
        />
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-xs overflow-hidden">
          {displayNotifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "p-4.5 flex items-start gap-4 transition-colors",
                !n.read ? "bg-primary/5" : "hover:bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  !n.read
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm",
                      !n.read ? "font-bold text-foreground" : "font-medium text-foreground/80",
                    )}
                  >
                    {n.title}
                  </p>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60 shrink-0">
                    <Clock className="h-3 w-3" />
                    {n.date}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {n.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
