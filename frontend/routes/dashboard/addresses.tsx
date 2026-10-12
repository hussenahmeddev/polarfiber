import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { EmptyState } from "@/frontend/components/EmptyState";
import { useStore } from "@/frontend/store";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import {
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from "@/backend/api.functions";

export const Route = createFileRoute("/dashboard/addresses")({
  component: DashboardAddresses,
});

function DashboardAddresses() {
  const { user } = useStore();

  const fetchAddresses = useServerFn(getCustomerAddresses);
  const mutateCreateAddress = useServerFn(createCustomerAddress);
  const mutateUpdateAddress = useServerFn(updateCustomerAddress);
  const mutateDeleteAddress = useServerFn(deleteCustomerAddress);
  const mutateSetDefaultAddress = useServerFn(setDefaultCustomerAddress);

  const addressesQuery = useQuery({
    queryKey: ["customer", "addresses", user?.user_id],
    queryFn: () => fetchAddresses(),
    enabled: !!user,
  });

  const [newAddressDialogOpen, setNewAddressDialogOpen] = React.useState(false);
  const [editingAddressId, setEditingAddressId] = React.useState<number | null>(null);
  const [newAddressForm, setNewAddressForm] = React.useState({
    label: "New Address",
    recipient: user?.name ?? "",
    phone: user?.phone ?? "",
    city: "Addis Ababa",
    region: "",
    line1: "",
    line2: "",
    country: "Ethiopia",
    is_default: false,
  });

  const resetForm = () => {
    setNewAddressForm({
      label: "New Address",
      recipient: user?.name ?? "",
      phone: user?.phone ?? "",
      city: "Addis Ababa",
      region: "",
      line1: "",
      line2: "",
      country: "Ethiopia",
      is_default: false,
    });
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressForm.line1 || !newAddressForm.region) {
      toast.error("Please fill in region and address details.");
      return;
    }
    try {
      await mutateCreateAddress({ data: newAddressForm });
      addressesQuery.refetch();
      toast.success("Address added successfully!");
      setNewAddressDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add address");
    }
  };

  const handleEditAddress = (address: any) => {
    setEditingAddressId(address.address_id);
    setNewAddressForm({
      label: address.label,
      recipient: address.recipient,
      phone: address.phone,
      city: address.city,
      region: address.region ?? "",
      line1: address.line1,
      line2: address.line2 ?? "",
      country: address.country,
      is_default: Boolean(address.is_default),
    });
    setNewAddressDialogOpen(true);
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddressId) return;
    if (!newAddressForm.line1 || !newAddressForm.region) {
      toast.error("Please fill in region and address details.");
      return;
    }
    try {
      await mutateUpdateAddress({
        data: { address_id: editingAddressId, ...newAddressForm },
      });
      addressesQuery.refetch();
      toast.success("Address updated successfully!");
      setNewAddressDialogOpen(false);
      setEditingAddressId(null);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update address");
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      await mutateDeleteAddress({ data: { address_id: addressId } });
      addressesQuery.refetch();
      toast.success("Address deleted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete address");
    }
  };

  const handleSetDefaultAddress = async (addressId: number) => {
    try {
      await mutateSetDefaultAddress({ data: { address_id: addressId } });
      addressesQuery.refetch();
      toast.success("Default address updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default address");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Delivery Addresses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage delivery locations and site drop-offs across Ethiopia
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingAddressId(null);
            resetForm();
            setNewAddressDialogOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Address
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {addressesQuery.isLoading ? (
          <p className="p-8 text-center text-xs text-muted-foreground/60 col-span-2">
            Loading addresses...
          </p>
        ) : addressesQuery.data?.length === 0 ? (
          <div className="col-span-2 bg-card border border-border rounded-2xl p-12 text-center">
            <EmptyState
              icon={MapPin}
              title="No addresses saved"
              description="Add your first delivery address for faster checkout."
              actionLabel="Add Address"
              onAction={() => {
                setEditingAddressId(null);
                resetForm();
                setNewAddressDialogOpen(true);
              }}
              className="border-none py-4"
            />
          </div>
        ) : (
          (addressesQuery.data ?? []).map((addr) => (
            <div
              key={addr.address_id}
              className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-md transition-shadow relative"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-foreground text-sm">{addr.label}</h3>
                </div>
                {addr.is_default ? (
                  <span className="bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-primary/20">
                    Default
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-primary gap-1"
                    onClick={() => handleSetDefaultAddress(addr.address_id)}
                  >
                    <MapPin className="h-3 w-3" />
                    Set as default
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">{addr.recipient}</p>
                <p>{addr.phone}</p>
                <p>
                  {addr.line1}
                  {addr.line2 && <span>, {addr.line2}</span>}
                </p>
                <p>
                  {addr.region}, {addr.city}, {addr.country}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                  onClick={() => handleEditAddress(addr)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-rose-500 hover:text-rose-700 gap-1"
                  onClick={() => handleDeleteAddress(addr.address_id)}
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Address Dialog */}
      {newAddressDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <form
            onSubmit={editingAddressId ? handleUpdateAddress : handleAddAddress}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-lg text-foreground">
              {editingAddressId ? "Edit Delivery Location" : "Add New Delivery Location"}
            </h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Location Name / Label</Label>
                <Input
                  value={newAddressForm.label}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, label: e.target.value })
                  }
                  placeholder="e.g. Construction Site Bole"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Recipient Name</Label>
                <Input
                  value={newAddressForm.recipient}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, recipient: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Contact Phone</Label>
                <Input
                  value={newAddressForm.phone}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, phone: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Address Line 1</Label>
                <Input
                  value={newAddressForm.line1}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, line1: e.target.value })
                  }
                  placeholder="e.g. Next to Edna Mall, Block B"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Address Line 2 (Optional)</Label>
                <Input
                  value={newAddressForm.line2}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, line2: e.target.value })
                  }
                  placeholder="e.g. Apartment 4B"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input
                    value={newAddressForm.city}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, city: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Region / Sub-city</Label>
                  <Input
                    value={newAddressForm.region}
                    onChange={(e) =>
                      setNewAddressForm({ ...newAddressForm, region: e.target.value })
                    }
                    placeholder="e.g. Bole"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Country</Label>
                <Input
                  value={newAddressForm.country}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, country: e.target.value })
                  }
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newAddressForm.is_default}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, is_default: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="is_default" className="text-xs cursor-pointer">
                  Set as default delivery address
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNewAddressDialogOpen(false);
                  setEditingAddressId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {editingAddressId ? "Update Address" : "Save Address"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
