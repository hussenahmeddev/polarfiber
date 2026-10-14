import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/frontend/routeTree.gen";

describe("Phase 2: Customer Dashboard Removal & Guest Checkout", () => {
  const queryClient = new QueryClient();
  const router = createRouter({ routeTree, context: { queryClient } });
  const registeredPaths = Object.keys(router.routesByPath);

  it("does not contain legacy customer account routes in the route tree", () => {
    const removedRoutes = [
      "/my-orders",
      "/my-quotes",
      "/my-messages",
      "/my-favorites",
      "/my-addresses",
      "/my-notifications",
      "/my-support",
      "/my-profile",
      "/forgot-password",
      "/reset-password",
    ];
    removedRoutes.forEach((route) => {
      expect(registeredPaths).not.toContain(route);
    });
  });

  it("registers the track-order route for guest order tracking", () => {
    expect(registeredPaths).toContain("/track-order");
  });

  it("keeps the login route for staff/admin sign-in", () => {
    expect(registeredPaths).toContain("/login");
  });

  it("keeps the cart route", () => {
    expect(registeredPaths).toContain("/cart");
  });
});
