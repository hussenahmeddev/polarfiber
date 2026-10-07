import * as React from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { CATEGORIES, type Category, type Product } from "@/shared/data";
import { ImageIcon } from "lucide-react";

const productSchema = z.object({
  product_id: z.number().int().min(0),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
  category: z.enum(CATEGORIES),
  capacity: z.string().trim().max(40).optional().nullable(),
  price: z.number().positive("Price must be greater than 0"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  image: z.string().trim().max(500),
  description: z.string().trim().max(2000),
});

type FormField = keyof Product;
type FormErrors = Partial<Record<FormField, string>>;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Product) => Promise<void>;
  loading?: boolean | undefined;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
  loading = false,
}: ProductDialogProps) {
  const [form, setForm] = React.useState<Product>({
    product_id: 0,
    name: "",
    category: "Water Tankers",
    capacity: "",
    price: 0,
    stock: 0,
    image: "",
    description: "",
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  React.useEffect(() => {
    if (product) {
      setForm(product);
    } else {
      setForm({
        product_id: 0,
        name: "",
        category: "Water Tankers",
        capacity: "",
        price: 0,
        stock: 0,
        image: "",
        description: "",
      });
    }
    setErrors({});
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = productSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as FormField | undefined;
        if (fieldName) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    await onSave(result.data as Product);
    onOpenChange(false);
  };


  const isEditing = (product?.product_id ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update product pricing, stock, or specifications."
              : "Create a new fiber glass or composite product in the catalog."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Product Name */}
          <div>
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              placeholder="e.g. 5,000L Vertical Water Tank"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Category */}
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-xs text-destructive">{errors.category}</p>
              )}
            </div>

            {/* Capacity */}
            <div>
              <Label htmlFor="capacity">Capacity / Dimensions</Label>
              <Input
                id="capacity"
                placeholder="e.g. 5,000 Liters"
                value={form.capacity ?? ""}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Price */}
            <div>
              <Label htmlFor="price">Price (ETB) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={form.price || ""}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="mt-1"
              />
              {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price}</p>}
            </div>

            {/* Stock */}
            <div>
              <Label htmlFor="stock">Units in Stock *</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                placeholder="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                className="mt-1"
              />
              {errors.stock && <p className="mt-1 text-xs text-destructive">{errors.stock}</p>}
            </div>
          </div>

          {/* Image URL with preview */}
          <div>
            <Label htmlFor="image">Image URL / Asset Path</Label>
            <Input
              id="image"
              placeholder="/images/water-tank-5000.jpg"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              className="mt-1"
            />
            {form.image && (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  <img
                    src={form.image}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="truncate text-xs text-muted-foreground">{form.image}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Enter product specifications, material details, and warranty terms..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 resize-none"
            />
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
