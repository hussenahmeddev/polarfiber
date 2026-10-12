import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { EmptyState } from "@/frontend/components/EmptyState";
import { useStore } from "@/frontend/store";
import { etb } from "@/shared/data";
import { Heart, Package, ShoppingBag } from "lucide-react";
import {
  getCustomerFavorites,
  removeCustomerFavorite,
} from "@/backend/api.functions";

export const Route = createFileRoute("/dashboard/favorites")({
  component: DashboardFavorites,
});

function DashboardFavorites() {
  const { user, addToCart } = useStore();
  const nav = useNavigate();

  const fetchFavorites = useServerFn(getCustomerFavorites);
  const mutateRemoveFavorite = useServerFn(removeCustomerFavorite);

  const favoritesQuery = useQuery({
    queryKey: ["customer", "favorites", user?.user_id],
    queryFn: () => fetchFavorites(),
    enabled: !!user,
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Favorite Products
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quick access to fiberglass items you order regularly
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {favoritesQuery.isLoading ? (
          <div className="col-span-4 p-8 text-center text-xs text-muted-foreground/60">
            Loading favorites...
          </div>
        ) : favoritesQuery.data?.length === 0 ? (
          <div className="col-span-4 bg-card border border-border rounded-2xl p-12 text-center">
            <EmptyState
              icon={Heart}
              title="No favorites yet"
              description="Browse products and click the heart icon to add them to your favorites for quick access."
              actionLabel="Browse Products"
              onAction={() => nav({ to: "/products" })}
              className="border-none py-4"
            />
          </div>
        ) : (
          (favoritesQuery.data ?? []).map((p) => (
            <div
              key={p.product_id}
              className="bg-card border border-border rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative"
            >
              <div>
                {p.product_image ? (
                  <img
                    src={
                      p.product_image ||
                      `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(p.product_name || "Product")}`
                    }
                    alt={p.product_name || "Product"}
                    className="h-36 w-full rounded-xl object-cover mb-3"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(p.product_name || "Product")}`;
                    }}
                  />
                ) : (
                  <div className="h-36 w-full rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60 mb-3">
                    <Package className="h-8 w-8" />
                  </div>
                )}
                <h4 className="font-bold text-foreground text-sm line-clamp-1">
                  {p.product_name}
                </h4>
                {p.product_capacity && (
                  <p className="text-xs text-muted-foreground mt-0.5">{p.product_capacity}</p>
                )}
                <p className="font-bold text-primary text-base mt-2">
                  {etb(p.product_price ?? 0)}
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={() => {
                    addToCart(p.product_id, 1);
                    toast.success(`Added ${p.product_name} to cart`);
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Add to Cart
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-500 hover:text-rose-700"
                  onClick={() =>
                    mutateRemoveFavorite({ data: { product_id: p.product_id } }).then(() =>
                      favoritesQuery.refetch(),
                    )
                  }
                >
                  <Heart className="h-3.5 w-3.5 fill-current" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
