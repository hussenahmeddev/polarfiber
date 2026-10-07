import * as React from "react";
import { Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Input } from "@/frontend/components/ui/input";
import { Button } from "@/frontend/components/ui/button";
import { Skeleton } from "@/frontend/components/SkeletonLoader";
import { EmptyState } from "@/frontend/components/EmptyState";
import { cn } from "@/frontend/utils";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
  rowKey: (row: T) => string | number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  filters,
  actions,
  emptyTitle = "No records found",
  emptyDescription = "There are no entries to display matching your criteria.",
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
  pagination,
  rowKey,
  className,
}: DataTableProps<T>) {
  const hasToolbar = !!(onSearchChange || filters || actions);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {hasToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {onSearchChange && (
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            )}
            {filters}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className={cn("px-4 py-3.5", col.className)}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    {columns.map((col, cIdx) => (
                      <td key={col.key} className="px-4 py-4">
                        <Skeleton
                          className={cn(
                            "h-4",
                            cIdx === 0 ? "w-20" : cIdx === columns.length - 1 ? "w-16" : "w-32",
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center">
                    <EmptyState
                      icon={Inbox}
                      title={emptyTitle}
                      description={emptyDescription}
                      actionLabel={emptyActionLabel}
                      onAction={onEmptyAction}
                      className="border-none bg-transparent py-4"
                    />
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "transition-colors hover:bg-muted/40",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3.5 align-middle", col.className)}>
                        {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key]?.toString() ?? ""}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {(pagination.page - 1) * pagination.pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
              </span>{" "}
              of <span className="font-semibold text-foreground">{pagination.totalItems}</span> results
            </p>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs font-medium">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
