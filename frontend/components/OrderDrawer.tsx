import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import {
  ORDER_STATUSES,
  etb,
  type Order,
  type OrderStatus,
} from "@/shared/data";
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
} from "lucide-react";
import { cn } from "@/frontend/utils";
import { Can } from "@/frontend/components/Can";

interface OrderDrawerProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "customer" | "admin";
  onReorder?: (order: Order) => void;
  onStatusChange?: (orderId: number, status: OrderStatus) => void;
  statusUpdating?: boolean;
  onAddNote?: (orderId: number, note: string) => Promise<void>;
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
  onStatusChange,
  statusUpdating = false,
  onAddNote,
}: OrderDrawerProps) {
  const [noteInput, setNoteInput] = React.useState("");
  const [noteSubmitting, setNoteSubmitting] = React.useState(false);

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
                          isCompleted
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground",
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

        {/* Customer Info (Admin mode or if customer name exists) */}
        {mode === "admin" && order.customer && (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-4 w-4" />
              Customer Information
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{order.customer}</p>
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
            <span>Total</span>
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
                    {item.quantity} × {etb(item.unit_price)}
                  </p>
                </div>
                <p className="font-semibold text-foreground">
                  {etb(item.quantity * item.unit_price)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/60 p-4">
            <span className="font-semibold text-foreground">Grand Total:</span>
            <span className="font-display text-xl font-bold text-primary">
              {etb(order.total)}
            </span>
          </div>

          {/* Internal Notes (Admin & Staff Only) */}
          {mode === "admin" && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Staff Internal Notes (Confidential)
              </span>
              {order.internal_notes ? (
                <div className="rounded-lg bg-background p-3 text-xs text-foreground font-mono whitespace-pre-wrap max-h-36 overflow-y-auto border border-border/60">
                  {order.internal_notes}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No internal notes added yet.</p>
              )}
              {onAddNote && (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add confidential internal note..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && noteInput.trim()) {
                        e.preventDefault();
                        const txt = noteInput.trim();
                        setNoteInput("");
                        setNoteSubmitting(true);
                        try {
                          await onAddNote(order.order_id, txt);
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
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {mode === "customer" && onReorder && (
            <Button
              onClick={() => onReorder(order)}
              className="w-full gap-2 sm:w-auto"
            >
              <RotateCcw className="h-4 w-4" />
              Reorder Items
            </Button>
          )}

          {mode === "admin" && onStatusChange && (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                Update Order Status:
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={order.status}
                  disabled={statusUpdating}
                  onChange={(e) => onStatusChange(order.order_id, e.target.value as OrderStatus)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
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
