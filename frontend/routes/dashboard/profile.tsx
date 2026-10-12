import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { useStore } from "@/frontend/store";
import {
  updateMyProfile,
  changeMyPassword,
} from "@/backend/api.functions";

export const Route = createFileRoute("/dashboard/profile")({
  component: DashboardProfile,
});

function DashboardProfile() {
  const { user, refreshUser } = useStore();

  const mutateProfile = useServerFn(updateMyProfile);
  const mutatePassword = useServerFn(changeMyPassword);

  // Profile Form State
  const [profileName, setProfileName] = React.useState(user?.name ?? "");
  const [profilePhone, setProfilePhone] = React.useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfilePhone(user.phone);
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingProfile(true);
    try {
      await mutateProfile({ data: { name: profileName, phone: profilePhone } });
      await refreshUser();
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await mutatePassword({ data: { currentPassword, newPassword } });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Profile & Security
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and password
        </p>
      </div>

      {/* Profile Details Form */}
      <form
        onSubmit={handleProfileSubmit}
        className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4"
      >
        <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
          Personal Information
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Full Name</Label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">
              Email Address (Read-only)
            </Label>
            <Input
              value={user.email}
              disabled
              className="mt-1 bg-muted/50 text-muted-foreground"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Phone Number</Label>
            <Input
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="+251 9..."
              className="mt-1"
            />
          </div>
        </div>
        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            disabled={savingProfile}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </form>

      {/* Password Change Form */}
      <form
        onSubmit={handlePasswordSubmit}
        className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4"
      >
        <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
          Change Password
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">
              Current Password
            </Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">
              Confirm New Password
            </Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
              required
            />
          </div>
        </div>
        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            disabled={changingPassword}
            variant="outline"
            className="font-medium"
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
