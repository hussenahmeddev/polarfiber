import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/track-order")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Track Order — Polar Fiber" },
      {
        name: "description",
        content: "Track your order at the new order tracking page.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/order-tracking" });
  },
  component: TrackOrderRedirect,
});

function TrackOrderRedirect() {
  return null;
}
