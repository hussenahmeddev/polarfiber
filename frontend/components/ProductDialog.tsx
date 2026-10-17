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
import { ImageIcon, Plus, Trash2, GripVertical, Loader2, Upload, Cloud } from "lucide-react";
import { usePermissions } from "@/frontend/hooks/usePermissions";
import { cn } from "@/frontend/utils";
import { useServerFn } from "@tanstack/react-start";
import { getProductImages, uploadProductImage } from "@/backend/api.functions";

const productSchema = z.object({
  product_id: z.number().int().min(0),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
  sku: z.string().trim().max(80).optional().nullable(),
  slug: z.string().trim().max(200).optional().nullable(),
  category: z.enum(CATEGORIES),
  capacity: z.string().trim().max(40).optional().nullable(),
  price: z.number().positive("Price must be greater than 0"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  image: z.string().trim().max(500),
  description: z.string().trim().max(2000),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});

type FormErrors = Partial<Record<keyof Product | "price", string>>;

export interface ProductImage {
  url: string;
  alt_text?: string;
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Product, extraImages: ProductImage[]) => Promise<void>;
  loading?: boolean | undefined;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
  loading = false,
}: ProductDialogProps) {
  const isEditing = (product?.product_id ?? 0) > 0;
  const { hasPermission, role } = usePermissions();
  const canUpdatePrice = role === "admin" || hasPermission("products.update_price") || !isEditing;
  const canEditSku = role === "admin";
  const fetchProductImages = useServerFn(getProductImages);
  const mutateUploadProductImage = useServerFn(uploadProductImage);
  const [form, setForm] = React.useState<Product>({
    product_id: 0,
    name: "",
    sku: "",
    slug: "",
    category: "Water Tankers",
    capacity: "",
    price: 0,
    stock: 0,
    image: "",
    description: "",
    status: "active",
  });

  const [errors, setErrors] = React.useState<FormErrors>({});
  const [extraImages, setExtraImages] = React.useState<ProductImage[]>([]);
  const [newImageUrl, setNewImageUrl] = React.useState("");
  const [loadingImages, setLoadingImages] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState<"primary" | "extra" | null>(null);

  // Fetch existing images when editing a product
  React.useEffect(() => {
    if (product?.product_id && open) {
      setLoadingImages(true);
      fetchProductImages({ data: { product_id: product.product_id } })
        .then((images) => {
          setExtraImages(
            (images ?? []).map((img) => ({
              url: img.url,
              alt_text: img.alt_text ?? "",
            })),
          );
        })
        .catch(() => {
          setExtraImages([]);
        })
        .finally(() => setLoadingImages(false));
    }
  }, [product?.product_id, open, fetchProductImages]);

  React.useEffect(() => {
    if (product) {
      setForm({
        ...product,
        sku: product.sku ?? "",
        slug: product.slug ?? "",
        status: product.status ?? "active",
      } as Product);
    } else {
      setForm({
        product_id: 0,
        name: "",
        sku: "",
        slug: "",
        category: "Water Tankers",
        capacity: "",
        price: 0,
        stock: 0,
        image: "",
        description: "",
        status: "active",
      });
    }
    setErrors({});
    setExtraImages([]);
    setNewImageUrl("");
  }, [product, open]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const autoSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setForm((f) => ({ ...f, name, slug: f.slug || autoSlug }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = productSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as keyof Product | undefined;
        if (fieldName) fieldErrors[fieldName] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    await onSave(result.data as Product, extraImages);
    onOpenChange(false);
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "primary" | "extra",
    extraIndex?: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setUploadingImage(target);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await mutateUploadProductImage({ data: { file: base64 } });
      const imageUrl = result.secure_url;

      if (target === "primary") {
        setForm((f) => ({ ...f, image: imageUrl }));
      } else if (target === "extra" && extraIndex !== undefined) {
        setExtraImages((prev) => {
          const updated = [...prev];
          updated[extraIndex] = { ...updated[extraIndex], url: imageUrl };
          return updated;
        });
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(null);
      e.target.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
              onChange={(e) => handleNameChange(e.target.value)}
              className="mt-1"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* SKU */}
            <div>
              <Label htmlFor="sku">
                SKU{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  {canEditSku
                    ? isEditing
                      ? "(editable)"
                      : "(auto-generated on save)"
                    : "(read-only)"}
                </span>
              </Label>
              <Input
                id="sku"
                placeholder={
                  canEditSku
                    ? isEditing
                      ? "e.g. PF-00001"
                      : "Auto-generated (PF-XXXXX)"
                    : "Read-only"
                }
                value={form.sku ?? ""}
                disabled={!canEditSku}
                onChange={(e) => setForm({ ...form, sku: e.target.value } as Product)}
                className={cn("mt-1 font-mono", !canEditSku && "bg-muted cursor-not-allowed")}
              />
            </div>

            {/* Slug */}
            <div>
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                placeholder="e.g. water-tank-5000l"
                value={form.slug ?? ""}
                onChange={(e) => setForm({ ...form, slug: e.target.value } as Product)}
                className="mt-1 font-mono text-xs"
              />
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as Category } as Product)
                }
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div>
              <Label htmlFor="capacity">Capacity / Dimensions</Label>
              <Input
                id="capacity"
                placeholder="e.g. 5,000 Liters"
                value={form.capacity ?? ""}
                onChange={(e) => setForm({ ...form, capacity: e.target.value } as Product)}
                className="mt-1"
              />
            </div>

            {/* Price */}
            <div>
              <Label htmlFor="price">
                Price (ETB) *{" "}
                {!canUpdatePrice && (
                  <span className="text-xs text-muted-foreground font-normal">
                    (Read-only for staff)
                  </span>
                )}
              </Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                disabled={!canUpdatePrice}
                value={form.price || ""}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) } as Product)}
                className={cn("mt-1", !canUpdatePrice && "bg-muted cursor-not-allowed")}
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
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) } as Product)}
                className="mt-1"
              />
              {errors.stock && <p className="mt-1 text-xs text-destructive">{errors.stock}</p>}
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={form.status ?? "active"}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as Product["status"] } as Product)
                }
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="active">Active (visible in store)</option>
                <option value="draft">Draft (hidden from store)</option>
                <option value="archived">Archived (hidden, no stock)</option>
              </select>
            </div>
          </div>

          {/* Primary Image URL */}
          <div>
            <Label htmlFor="image">Primary Image URL</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="image"
                placeholder="/images/water-tank-5000.jpg"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value } as Product)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                onClick={() => document.getElementById("primary-image-upload")?.click()}
                disabled={uploadingImage === "primary" || loading}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadingImage === "primary" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Upload</span>
              </Button>
              <input
                id="primary-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, "primary")}
              />
            </div>
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

          {/* Additional Images */}
          <div>
            <Label>Additional Images</Label>
            <div className="mt-2 space-y-2">
              {loadingImages ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading existing images...
                </div>
              ) : (
                <>
                  {extraImages.map((img, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      <Input
                        value={img.url}
                        onChange={(e) => {
                          const updated = [...extraImages];
                          updated[idx] = { ...updated[idx], url: e.target.value } as ProductImage;
                          setExtraImages(updated);
                        }}
                        placeholder="Image URL"
                        className="text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 text-xs"
                        onClick={() =>
                          document.getElementById(`extra-image-upload-${idx}`)?.click()
                        }
                        disabled={uploadingImage === "extra" || loading}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingImage === "extra" && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        <span>Upload</span>
                      </Button>
                      <input
                        id={`extra-image-upload-${idx}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(e, "extra", idx)}
                      />
                      <Input
                        value={img.alt_text}
                        onChange={(e) => {
                          const updated = [...extraImages];
                          updated[idx] = {
                            ...updated[idx],
                            alt_text: e.target.value,
                          } as ProductImage;
                          setExtraImages(updated);
                        }}
                        placeholder="Alt text"
                        className="text-xs w-28"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setExtraImages(extraImages.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Add image URL..."
                      className="text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1 text-xs"
                      onClick={() => {
                        if (newImageUrl.trim()) {
                          setExtraImages([
                            ...extraImages,
                            { url: newImageUrl.trim(), alt_text: "" },
                          ]);
                          setNewImageUrl("");
                        }
                      }}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Up to 10 additional images. First image is always the primary one above.
            </p>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Enter product specifications, material details, and warranty terms..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value } as Product)}
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
