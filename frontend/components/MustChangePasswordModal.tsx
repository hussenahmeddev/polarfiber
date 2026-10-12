import * as React from "react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Lock, Loader2, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { changeTemporaryPassword } from "@/backend/api.functions";
import { useStore } from "@/frontend/store";
import type { User } from "@/shared/data";

interface MustChangePasswordModalProps {
  user: User;
  onComplete: () => Promise<void> | void;
}

export function MustChangePasswordModal({ user, onComplete }: MustChangePasswordModalProps) {
  const { logout } = useStore();
  const mutateChangeTemp = useServerFn(changeTemporaryPassword);

  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!tempPassword) {
      setError("Please enter your current temporary password.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === tempPassword) {
      setError("New password must be different from the temporary password.");
      return;
    }

    setBusy(true);
    try {
      const res = await mutateChangeTemp({
        data: {
          temporaryPassword: tempPassword,
          newPassword,
        },
      });

      if ("error" in res && res.error) {
        setError(res.error as string);
        return;
      }

      toast.success("Password updated successfully! Welcome to Polar Fiber.");
      await onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4 shadow-xs">
            <KeyRound className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Update Temporary Password
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Welcome, <span className="font-semibold text-foreground">{user.name}</span>! As a new
            staff member, you must choose a secure permanent password before accessing the system.
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs font-medium rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="temp-pass" className="text-xs font-semibold text-foreground">
              Current Temporary Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="temp-pass"
                type="password"
                placeholder="Enter temporary password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="pl-9"
                required
                disabled={busy}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pass" className="text-xs font-semibold text-foreground">
              New Permanent Password
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-pass"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-9"
                required
                disabled={busy}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass" className="text-xs font-semibold text-foreground">
              Confirm New Password
            </Label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm-pass"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9"
                required
                disabled={busy}
              />
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Set New Password & Continue"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => logout()}
              disabled={busy}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Sign Out Instead
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
