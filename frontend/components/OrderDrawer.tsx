import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOrderStatusHistory,
  getOrderMessages,
  sendOrderMessage,
  getGuestOrderStatus,
  getGuestOrderThread,
  sendGuestOrderMessage,
  getOrderDelivery,
  getOrderInternalNotes,
  addOrderInternalNote,
} from "@/backend/api.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { ORDER_STATUSES, etb, type Order, type OrderStatus } from "@/shared/data";
import { canTransition } from "@/shared/order-status";
import {
  CheckCircle2,
  Clock,
  Factory,
  Truck,
  XCircle,
  MapPin,
  ShoppingBag,
  RotateCcw,
  User,
  FileText,
  History,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/frontend/utils";
import { Can } from "@/frontend/components/Can";
import { usePermissions } from "@/frontend/hooks/usePermissions";

interface OrderDrawerProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "customer" | "admin" | "guest";
  onReorder?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onStatusChange?: (orderId: number, status: OrderStatus) => void;
  statusUpdating?: boolean;
  onAddNote?: (orderId: number, note: string) => Promise<void>;
  /** Restrict the status dropdown to a specific set (e.g. staff-valid transitions). */
  allowedStatuses?: OrderStatus[];
  /** Guest tracking mode: hides staff-only sections and shows the reply box. */
  guestOrderId?: number;
  onDispatch?: (orderId: number) => void;
  onCompleteDelivery?: (orderId: number) => void;
}

interface DrawerMessage {
  id: number;
  sender_type: string;
  sender_name: string;
  kind: string;
  body: string | null;
  status_from: string | null;
  status_to: string | null;
  created_at: string;
}

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "Pending", label: "Pending", icon: Clock },
  { status: "Confirmed", label: "Confirmed", icon: CheckCircle2 },
  { status: "In Production", label: "In Production", icon: Factory },
  { status: "Out for Delivery", label: "Out for Delivery", icon: Truck },
  { status: "Delivered", label: "Delivered", icon: CheckCircle2 },
];

const STEP_INDEX_MAP: Record<OrderStatus, number> = {
  Pending: 0,
  Confirmed: 1,
  "In Production": 2,
  "Out for Delivery": 3,
  Delivered: 4,
  Cancelled: -1,
};

export function OrderDrawer({
  order,
  open,
  onOpenChange,
  mode = "customer",
  onReorder,
  onCancel,
  onStatusChange,
  statusUpdating = false,
  onAddNote,
  allowedStatuses,
  guestOrderId,
  onDispatch,
  onCompleteDelivery,
}: OrderDrawerProps) {
  const [noteInput, setNoteInput] = React.useState("");
  const [noteSubmitting, setNoteSubmitting] = React.useState(false);
  const [messageInput, setMessageInput] = React.useState("");
  const [messageSubmitting, setMessageSubmitting] = React.useState(false);
  const { hasPermission } = usePermissions();
  const showFinancials = mode !== "admin" || hasPermission("revenue.view");

  const fetchOrderHistory = useServerFn(getOrderStatusHistory);
  const { data: statusHistory } = useQuery({
    queryKey: ["order-status-history", order?.order_id],
    queryFn: () => fetchOrderHistory({ data: { order_id: order!.order_id } }),
    enabled: mode === "admin" && !!order?.order_id,
  });

  // Customer communication thread — shared by the staff modal and the guest
  // tracking page. Polling keeps it live without a page refresh.
  const fetchMessages = useServerFn(getOrderMessages);
  const threadOrderId = mode === "admin" ? order?.order_id : guestOrderId;
  const messagesQuery = useQuery({
    queryKey: ["order-messages", threadOrderId, mode],
    queryFn: () => fetchMessages({ data: { order_id: threadOrderId! } }),
    enabled: open && !!threadOrderId,
    refetchInterval: open && !!threadOrderId ? 10000 : false,
  });
  const messages = (messagesQuery.data?.messages ?? []) as DrawerMessage[];
  const customerContact = messagesQuery.data?.customer as
    | { name: string | null; email: string | null; phone: string | null; address: string }
    | undefined;

  const sendMessage = useServerFn(sendOrderMessage);
  const fetchInternalNotes = useServerFn(getOrderInternalNotes);
  const pushInternalNote = useServerFn(addOrderInternalNote);
  const fetchDelivery = useServerFn(getOrderDelivery);

  // Guest tracking: the verified session proves ownership, so the thread is
  // read and replied to with the same order-scoped session.
  const fetchGuestThread = useServerFn(getGuestOrderThread);
  const sendGuestMessage = useServerFn(sendGuestOrderMessage);
  const guestMessagesQuery = useQuery({
    queryKey: ["guest-order-thread", guestOrderId],
    queryFn: () => fetchGuestThread({ data: { order_id: guestOrderId! } }),
    enabled: mode === "guest" && !!guestOrderId,
    refetchInterval: mode === "guest" && !!guestOrderId ? 10000 : false,
  });
  const guestMessages = (guestMessagesQuery.data?.messages ?? []) as DrawerMessage[];

  async function submitGuestMessage() {
    const text = messageInput.trim();
    if (!text || !guestOrderId) return;
    setMessageSubmitting(true);
    try {
      await sendGuestMessage({ data: { order_id: guestOrderId, message: text } });
      setMessageInput("");
      await guestMessagesQuery.refetch();
    } finally {
      setMessageSubmitting(false);
    }
  }

  const internalNotesQuery = useQuery({
    queryKey: ["order-internal-notes", order?.order_id],
    queryFn: () => fetchInternalNotes({ data: { order_id: order!.order_id } }),
    enabled: mode === "admin" && !!order?.order_id,
  });
  const internalNotes = (internalNotesQuery.data ?? []) as Array<{
    id: number;
    staff_name: string;
    note: string;
    created_at: string;
  }>;

  const deliveryQuery = useQuery({
    queryKey: ["order-delivery", order?.order_id],
    queryFn: () => fetchDelivery({ data: { order_id: order!.order_id } }),
    enabled: mode === "admin" && !!order?.order_id,
  });
  const delivery = deliveryQuery.data;

  const isStaffView = mode === "admin";

  async function submitMessage() {
    const text = messageInput.trim();
    if (!text || !threadOrderId) return;
    setMessageSubmitting(true);
    try {
      await sendMessage({ data: { order_id: threadOrderId, message: text } });
      setMessageInput("");
      await messagesQuery.refetch();
    } finally {
      setMessageSubmitting(false);
    }
  }

  if (!order) return null;

  const isCancelled = order.status === "Cancelled";
  const currentStepIndex = STEP_INDEX_MAP[order.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="border-b border-border pb-4 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="text-xl font-bold font-display">
                Order #{order.order_id}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                Placed on {order.created_at}
              </DialogDescription>
            </div>
            <StatusBadge s={order.status} />
          </div>
        </DialogHeader>

        {/* Step Tracker */}
        <div className="py-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Order Status Progression
          </h4>

          {isCancelled ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-700 dark:text-rose-300">
              <XCircle className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-semibold">Order Cancelled</p>
                <p className="text-xs text-rose-600/90 dark:text-rose-300/80">
                  This order was cancelled and is no longer being processed.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 relative">
              <div className="grid grid-cols-4 gap-2">
                {STEPS.map((step, idx) => {
                  const isCompleted = currentStepIndex >= idx;
                  const isCurrent = currentStepIndex === idx;
                  const StepIcon = step.icon;

                  return (
                    <div key={step.status} className="flex flex-col items-center text-center">
                      <div
                        className={cn(
                          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                          isCompleted
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : "border-border bg-muted text-muted-foreground",
                          isCurrent && "ring-4 ring-primary/20",
                        )}
                      >
                        <StepIcon className="h-4 w-4" />
                      </div>
                      <span
                        className={cn(
                          "mt-2 text-[11px] font-medium leading-tight",
                          isCompleted ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Connecting progress bar line */}
              <div className="absolute left-[12.5%] right-[12.5%] top-5 -z-0 h-0.5 -translate-y-1/2 bg-border">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width:
                      currentStepIndex >= 0
                        ? `${(currentStepIndex / (STEPS.length - 1)) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Customer Information (Admin mode) */}
        {mode === "admin" && (customerContact || order.customer) && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-4 w-4" />
              Customer Information
            </div>
            <p className="text-sm font-semibold text-foreground">
              {customerContact?.name ?? order.customer}
            </p>
            {customerContact?.email && (
              <p className="text-xs text-muted-foreground">{customerContact.email}</p>
            )}
            {customerContact?.phone && (
              <p className="text-xs text-muted-foreground">{customerContact.phone}</p>
            )}
          </div>
        )}

        {/* Customer Communication (guest) */}
        {mode === "guest" && !!guestOrderId && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Messages with Polar Fiber
            </span>

            {guestMessagesQuery.isLoading && (
              <p className="text-xs text-muted-foreground">Loading conversation…</p>
            )}
            {guestMessagesQuery.isError && (
              <p className="text-xs text-destructive">
                Could not load the conversation. Try again in a moment.
              </p>
            )}
            {!guestMessagesQuery.isLoading &&
              !guestMessagesQuery.isError &&
              guestMessages.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  No messages yet. Ask us about delivery, address or stock.
                </p>
              )}

            {guestMessages.length > 0 && (
              <div className="max-h-64 space-y-2.5 overflow-y-auto">
                {guestMessages.map((m) => {
                  const mine = m.sender_type === "customer";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex flex-col", mine ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                          mine
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-foreground border border-border/60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 mb-0.5">
                          <span className="font-semibold">{m.sender_name}</span>
                          <span
                            className={cn(
                              mine ? "text-primary-foreground/70" : "text-muted-foreground",
                              "text-[10px]",
                            )}
                          >
                            {m.created_at}
                          </span>
                        </div>
                        {m.kind !== "message" ? (
                          <span className="text-[10px] uppercase tracking-wide">
                            {m.status_to ? `${m.status_from} → ${m.status_to}` : m.kind}
                          </span>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{m.body ?? ""}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Ask us about delivery, address or stock…"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                maxLength={2000}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && messageInput.trim()) {
                    e.preventDefault();
                    void submitGuestMessage();
                  }
                }}
              />
              <Button
                size="sm"
                disabled={messageSubmitting || !messageInput.trim()}
                onClick={() => void submitGuestMessage()}
                className="text-xs h-8 px-3"
              >
                {messageSubmitting ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}

        {/* Customer Communication */}
        {isStaffView && !!threadOrderId && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              Customer Communication
            </span>

            {messagesQuery.isLoading && (
              <p className="text-xs text-muted-foreground">Loading conversation…</p>
            )}
            {messagesQuery.isError && (
              <p className="text-xs text-destructive">
                Could not load the conversation. Try again in a moment.
              </p>
            )}
            {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No messages yet. Start the conversation below.
              </p>
            )}

            {messages.length > 0 && (
              <div className="max-h-64 space-y-2.5 overflow-y-auto">
                {messages.map((m) => {
                  const mine = m.sender_type !== "customer";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex flex-col", mine ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                          mine
                            ? "bg-primary/10 text-foreground border border-primary/20"
                            : "bg-background text-foreground border border-border/60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 mb-0.5">
                          <span className="font-semibold">{m.sender_name}</span>
                          <span className="text-[10px] text-muted-foreground">{m.created_at}</span>
                        </div>
                        {m.kind !== "message" ? (
                          <span className="text-[10px] uppercase tracking-wide text-primary">
                            {m.status_to ? `${m.status_from} → ${m.status_to}` : m.kind}
                          </span>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{m.body ?? ""}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Reply to the customer about delivery, address or stock…"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                maxLength={2000}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && messageInput.trim()) {
                    e.preventDefault();
                    void submitMessage();
                  }
                }}
              />
              <Button
                size="sm"
                disabled={messageSubmitting || !messageInput.trim()}
                onClick={() => void submitMessage()}
                className="text-xs h-8 px-3"
              >
                {messageSubmitting ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}

        {/* Delivery Address */}
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Delivery Destination
          </div>
          <p className="mt-2 text-sm text-foreground">{order.address}</p>
        </div>

        {/* Order Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4" />
              Order Items ({order.items.length})
            </span>
            {showFinancials && <span>Total</span>}
          </div>

          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {order.items.map((item, idx) => (
              <div
                key={`${item.product_id ?? idx}-${idx}`}
                className="flex items-center justify-between p-3.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Quantity: {item.quantity}
                    {showFinancials && ` × ${etb(item.unit_price)}`}
                  </p>
                </div>
                {showFinancials && (
                  <p className="font-semibold text-foreground">
                    {etb(item.quantity * item.unit_price)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {showFinancials && (
            <div className="flex items-center justify-between rounded-xl bg-muted/60 p-4">
              <span className="font-semibold text-foreground">Grand Total:</span>
              <span className="font-display text-xl font-bold text-primary">{etb(order.total)}</span>
            </div>
          )}

          {/* Internal Notes (Admin & Staff Only) — never shown to customers */}
          {mode === "admin" && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Staff Internal Notes (Confidential)
              </span>

              {internalNotes.length > 0 ? (
                <div className="divide-y divide-border/50 max-h-40 overflow-y-auto">
                  {internalNotes.map((n) => (
                    <div key={n.id} className="py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground">
                          {n.staff_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{n.created_at}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                        {n.note}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Legacy blob kept for backward compatibility */}
                  {order.internal_notes ? (
                    <div className="rounded-lg bg-background p-3 text-xs text-foreground font-mono whitespace-pre-wrap max-h-36 overflow-y-auto border border-border/60">
                      {order.internal_notes}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No internal notes added yet.
                    </p>
                  )}
                </>
              )}

              {onAddNote && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add confidential internal note..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    maxLength={2000}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && noteInput.trim()) {
                        e.preventDefault();
                        const txt = noteInput.trim();
                        setNoteInput("");
                        setNoteSubmitting(true);
                        try {
                          await onAddNote(order.order_id, txt);
                          await internalNotesQuery.refetch();
                        } finally {
                          setNoteSubmitting(false);
                        }
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={noteSubmitting || !noteInput.trim()}
                    onClick={async () => {
                      const txt = noteInput.trim();
                      setNoteInput("");
                      setNoteSubmitting(true);
                      try {
                        await onAddNote(order.order_id, txt);
                        await internalNotesQuery.refetch();
                      } finally {
                        setNoteSubmitting(false);
                      }
                    }}
                    className="text-xs h-8 px-3"
                  >
                    {noteSubmitting ? "Saving..." : "Add Note"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Delivery Information (staff only) */}
          {mode === "admin" && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Delivery Information
              </span>

              {deliveryQuery.isLoading && (
                <p className="text-xs text-muted-foreground">Loading delivery details…</p>
              )}
              {deliveryQuery.isError && (
                <p className="text-xs text-destructive">Could not load delivery details.</p>
              )}

              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Destination</dt>
                  <dd className="font-medium text-foreground">{order.address}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Customer phone</dt>
                  <dd className="font-medium text-foreground">
                    {delivery?.customer_phone ?? "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Assigned delivery staff</dt>
                  <dd className="font-medium text-foreground">
                    {(delivery?.delivery as { assigned_name?: string | null } | null)
                      ?.assigned_name ?? "Unassigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Expected delivery date</dt>
                  <dd className="font-medium text-foreground">
                    {(delivery?.delivery as { expected_delivery_date?: string | null } | null)
                      ?.expected_delivery_date ?? "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dispatched</dt>
                  <dd className="font-medium text-foreground">
                    {(delivery?.delivery as { dispatched_at?: string | null } | null)
                      ?.dispatched_at ?? "Not dispatched"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Delivered</dt>
                  <dd className="font-medium text-foreground">
                    {(delivery?.delivery as { delivered_at?: string | null } | null)
                      ?.delivered_at ?? "Not delivered"}
                  </dd>
                </div>
              </dl>

              {(delivery?.delivery as { delivery_notes?: string | null } | null)
                ?.delivery_notes && (
                <div>
                  <p className="text-muted-foreground">Delivery notes</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">
                    {(delivery?.delivery as { delivery_notes: string }).delivery_notes}
                  </p>
                </div>
              )}

              {(delivery?.delivery as { confirmation_name?: string | null } | null)
                ?.confirmation_name && (
                <div>
                  <p className="text-muted-foreground">Delivery confirmation</p>
                  <p className="text-xs text-foreground">
                    Received by{" "}
                    {(delivery?.delivery as { confirmation_name: string }).confirmation_name}
                    {(delivery?.delivery as { confirmation_details?: string | null })
                      .confirmation_details
                      ? ` — ${
                          (delivery?.delivery as { confirmation_details: string })
                            .confirmation_details
                        }`
                      : ""}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {order.status !== "Delivered" &&
                  order.status !== "Cancelled" &&
                  !(delivery?.delivery as { dispatched_at?: string | null } | null)
                    ?.dispatched_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      disabled={statusUpdating}
                      onClick={() => onDispatch?.(order.order_id)}
                    >
                      <Truck className="mr-1.5 h-3.5 w-3.5" />
                      Mark dispatched
                    </Button>
                  )}
                {order.status === "Out for Delivery" && onCompleteDelivery && (
                  <Button
                    size="sm"
                    className="text-xs h-8"
                    disabled={statusUpdating}
                    onClick={() => onCompleteDelivery(order.order_id)}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Confirm delivery
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Order Status History (Admin & Staff Only) */}
          {mode === "admin" && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" />
                Status History
              </span>
              {(statusHistory ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No status history recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {(statusHistory ?? []).map((entry) => (
                    <div key={entry.id} className="py-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{entry.status}</span>
                          <span className="text-xs text-muted-foreground">{entry.created_at}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          by {entry.changer_name ?? `User #${entry.changed_by}`}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground pl-6 ml-1 border-l border-border/50">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {mode === "customer" && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {onReorder && (
                <Button onClick={() => onReorder(order)} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reorder Items
                </Button>
              )}
              {onCancel && order.status === "Pending" && (
                <Button
                  variant="outline"
                  onClick={() => onCancel(order)}
                  className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Order
                </Button>
              )}
            </div>
          )}

          {mode === "admin" && onStatusChange && (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                Update Order Status:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {order.status === "Pending" && (
                  <Button
                    size="sm"
                    onClick={() => onStatusChange(order.order_id, "Confirmed")}
                    disabled={statusUpdating}
                    className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Order
                  </Button>
                )}
                {order.status === "Confirmed" && (
                  <Button
                    size="sm"
                    onClick={() => onStatusChange(order.order_id, "In Production")}
                    disabled={statusUpdating}
                    className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Factory className="h-4 w-4" />
                    Start Production
                  </Button>
                )}
                <select
                  value={order.status}
                  disabled={statusUpdating}
                  onChange={(e) => onStatusChange(order.order_id, e.target.value as OrderStatus)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(allowedStatuses ?? ORDER_STATUSES).map((st) => {
                    const isCurrent = st === order.status;
                    const isAllowed = isCurrent || canTransition(order.status, st);
                    return (
                      <option key={st} value={st} disabled={!isAllowed}>
                        {st} {isCurrent ? "(Current)" : !isAllowed ? "(Confirm order first)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            {mode === "admin" && (
              <>
                <Can permission="orders.refund">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    Refund Order
                  </Button>
                </Can>
                <Can permission="orders.delete">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    Delete Order
                  </Button>
                </Can>
              </>
            )}

            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
