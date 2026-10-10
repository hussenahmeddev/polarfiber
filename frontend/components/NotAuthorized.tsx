import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { useStore } from "@/frontend/store";
import type { Role } from "@/shared/data";

interface NotAuthorizedProps {
  userRole?: Role | undefined;
  message?: string | undefined;
}

export function NotAuthorized({
  userRole,
  message = "You do not have sufficient permissions to access this page or resource.",
}: NotAuthorizedProps) {
  const { logout } = useStore();

  const isStaffOrAdmin = userRole === "admin" || userRole === "staff";
  const homeTarget = isStaffOrAdmin ? "/admin" : "/dashboard";
  const homeLabel = isStaffOrAdmin ? "Return to Management Portal" : "Return to Customer Dashboard";

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center bg-card border border-border p-8 rounded-2xl shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-6">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive bg-destructive/10 rounded-full mb-3">
          403 — Access Denied
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Not Authorized
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {message}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            <Link to={homeTarget}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {homeLabel}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={() => logout()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
