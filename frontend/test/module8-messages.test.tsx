import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Can } from "@/frontend/components/Can";
import { hasPermission } from "@/shared/permissions";
import * as storeModule from "@/frontend/store";
import type { User } from "@/shared/data";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Module 8: Messages — Staff Console Functionality & Gating", () => {
  const staffUser: User = {
    user_id: 2,
    name: "Staff Messaging",
    email: "staff@polarfiber.com",
    phone: "+251911000000",
    role: "staff",
    must_change_password: false,
  };

  const adminUser: User = {
    user_id: 1,
    name: "System Admin",
    email: "admin@polarfiber.com",
    phone: "+251911000000",
    role: "admin",
    must_change_password: false,
  };

  it("grants staff messages.view, messages.reply, and messages.archive permissions", () => {
    expect(hasPermission("staff", "messages.view")).toBe(true);
    expect(hasPermission("staff", "messages.reply")).toBe(true);
    expect(hasPermission("staff", "messages.archive")).toBe(true);
  });

  it("prohibits staff from deleting messages (messages.delete not granted)", () => {
    expect(hasPermission("staff", "messages.delete")).toBe(false);
    expect(hasPermission("admin", "messages.delete")).toBe(true);
  });

  it("hides the Delete button for staff but shows it for admin via <Can>", () => {
    // Staff view: Delete button hidden
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: staffUser,
      refreshUser: vi.fn(),
    } as any);

    const { rerender } = renderWithClient(
      <Can permission="messages.delete">
        <button data-testid="delete-message-btn">Delete</button>
      </Can>,
    );

    expect(screen.queryByTestId("delete-message-btn")).toBeNull();

    // Admin view: Delete button visible
    vi.spyOn(storeModule, "useStore").mockReturnValue({
      user: adminUser,
      refreshUser: vi.fn(),
    } as any);

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <Can permission="messages.delete">
          <button data-testid="delete-message-btn">Delete</button>
        </Can>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("delete-message-btn")).toBeDefined();
  });

  it("denies customer role any messaging permissions", () => {
    expect(hasPermission("customer", "messages.view")).toBe(false);
    expect(hasPermission("customer", "messages.reply")).toBe(false);
    expect(hasPermission("customer", "messages.archive")).toBe(false);
    expect(hasPermission("customer", "messages.delete")).toBe(false);
  });
});
