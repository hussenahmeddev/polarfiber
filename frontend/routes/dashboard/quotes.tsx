import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/frontend/components/ui/button";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { EmptyState } from "@/frontend/components/EmptyState";
import { useStore } from "@/frontend/store";
import { FileText, Plus } from "lucide-react";
import { getMyQuotes } from "@/backend/api.functions";

export const Route = createFileRoute("/dashboard/quotes")({
  component: DashboardQuotes,
});

function DashboardQuotes() {
  const { user } = useStore();
  const nav = useNavigate();

  const fetchQuotes = useServerFn(getMyQuotes);

  const quotesQuery = useQuery({
    queryKey: ["customer", "quotes", user?.user_id],
    queryFn: () => fetchQuotes(),
    enabled: !!user,
  });

  const allQuotes = quotesQuery.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Quote Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review custom engineering and fabrication inquiries
          </p>
        </div>
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Link to="/quote">
            <Plus className="h-4 w-4" />
            Request New Quote
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allQuotes.length === 0 ? (
          <div className="col-span-2 bg-card border border-border rounded-2xl p-12 text-center">
            <EmptyState
              icon={FileText}
              title="No quote inquiries found"
              description="You haven't requested any custom fiberglass fabrication quotes yet."
              actionLabel="Request a Quote"
              onAction={() => nav({ to: "/quote" })}
              className="border-none py-4"
            />
          </div>
        ) : (
          allQuotes.map((q) => (
            <div
              key={q.quote_id}
              className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-semibold text-muted-foreground/60">
                  Inquiry #{q.quote_id}
                </span>
                <StatusBadge s={q.status} />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">{q.subject}</h3>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Submitted on {q.created_at}
                </p>
                <div className="mt-3 rounded-xl bg-muted/50 p-3.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {q.message}
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-muted-foreground/60">Response via: {q.email}</span>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="text-xs text-primary"
                >
                  <a
                    href={`mailto:info@polarfiber.et?subject=Follow-up on Inquiry #${q.quote_id}`}
                  >
                    Follow Up
                  </a>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
