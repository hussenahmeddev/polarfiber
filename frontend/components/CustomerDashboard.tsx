import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Package,
  FileText,
  MessageSquare,
  Send,
  Heart,
  User as UserIcon,
  MapPin,
  Bell,
  HelpCircle,
  Globe,
  LogOut,
  CheckCircle2,
  ArrowRight,
  Search,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Check,
  ShoppingBag,
  Phone,
  Mail,
  Building,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { EmptyState } from "@/frontend/components/EmptyState";
import { etb, type Order, type Quote, type Product } from "@/shared/data";
import { useStore, productsKey } from "@/frontend/store";
import {
  getMyDashboard,
  getMyOrders,
  getMyQuotes,
  getProducts,
  updateMyProfile,
  changeMyPassword,
  getMyNotifications,
  getCustomerConversations,
  getCustomerConversationMessages,
  createCustomerConversation,
  replyToCustomerConversation,
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  getCustomerFavorites,
  toggleCustomerFavorite,
  removeCustomerFavorite,
} from "@/backend/api.functions";
import { cn } from "@/frontend/utils";

// Customer Message Thread Types (from server)
interface CustomerConversation {
  conversation_id: number;
  user_id: number;
  subject: string;
  topic: string;
  status: "Awaiting Reply" | "Admin Replied" | "Resolved";
  created_at: string;
  updated_at: string;
  last_message_text?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
}

interface CustomerMessage {
  message_id: number;
  conversation_id: number;
  sender_type: "customer" | "admin";
  sender_id: number;
  sender_name: string;
  text: string;
  is_read: number;
  created_at: string;
}

// Seed Customer Notifications
interface CustomerNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: "order" | "quote" | "system";
}

const INITIAL_NOTIFICATIONS: CustomerNotification[] = [
  {
    id: "notif-1",
    title: "Order Received",
    message:
      "Thank you for choosing Polar Fiber. Your order has been registered and is being reviewed by engineering.",
    date: "Just now",
    read: false,
    type: "order",
  },
  {
    id: "notif-2",
    title: "Catalog Updated",
    message:
      "New heavy-duty corrugated fiberglass roof sheets and vertical water tankers are now available in catalog.",
    date: "1 day ago",
    read: true,
    type: "system",
  },
];

export function CustomerDashboard() {
  const { user, refreshUser, addToCart, logout } = useStore();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Orders State
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = React.useState(false);
  const [orderSearch, setOrderSearch] = React.useState("");
  const [orderStatusFilter, setOrderStatusFilter] = React.useState("all");

  // Quotes State
  const [quoteSearch, setQuoteSearch] = React.useState("");
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);

  // Messages State
  const [selectedConversation, setSelectedConversation] = React.useState<CustomerConversation | null>(null);
  const [conversationMessages, setConversationMessages] = React.useState<CustomerMessage[]>([]);
  const [messageSearch, setMessageSearch] = React.useState("");
  const [replyInput, setReplyInput] = React.useState("");
  const [newMessageDialogOpen, setNewMessageDialogOpen] = React.useState(false);
  const [newMessageForm, setNewMessageForm] = React.useState({
    subject: "",
    topic: "General Inquiry",
    text: "",
  });
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  // Notifications State
  const [notifications, setNotifications] =
    React.useState<CustomerNotification[]>(INITIAL_NOTIFICATIONS);

  // Addresses State
  const [newAddressDialogOpen, setNewAddressDialogOpen] = React.useState(false);
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
  const [editingAddressId, setEditingAddressId] = React.useState<number | null>(null);

  // Profile Form State
  const [profileName, setProfileName] = React.useState(user?.name ?? "");
  const [profilePhone, setProfilePhone] = React.useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = React.useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);

  // Server functions
  const fetchDashboard = useServerFn(getMyDashboard);
  const fetchOrders = useServerFn(getMyOrders);
  const fetchQuotes = useServerFn(getMyQuotes);
  const fetchProducts = useServerFn(getProducts);
  const mutateProfile = useServerFn(updateMyProfile);
  const mutatePassword = useServerFn(changeMyPassword);
  const fetchNotifications = useServerFn(getMyNotifications);
  const fetchConversations = useServerFn(getCustomerConversations);
  const fetchConversationMessages = useServerFn(getCustomerConversationMessages);
  const mutateCreateConversation = useServerFn(createCustomerConversation);
  const mutateReplyConversation = useServerFn(replyToCustomerConversation);
  const fetchAddresses = useServerFn(getCustomerAddresses);
  const mutateCreateAddress = useServerFn(createCustomerAddress);
  const mutateUpdateAddress = useServerFn(updateCustomerAddress);
  const mutateDeleteAddress = useServerFn(deleteCustomerAddress);
  const mutateSetDefaultAddress = useServerFn(setDefaultCustomerAddress);
  const fetchFavorites = useServerFn(getCustomerFavorites);
  const mutateToggleFavorite = useServerFn(toggleCustomerFavorite);
  const mutateRemoveFavorite = useServerFn(removeCustomerFavorite);

  // Queries
  const dashboardQuery = useQuery({
    queryKey: ["customer", "dashboard", user?.user_id],
    queryFn: () => fetchDashboard(),
    enabled: !!user,
  });

  const ordersQuery = useQuery({
    queryKey: ["customer", "orders", user?.user_id],
    queryFn: () => fetchOrders(),
    enabled: !!user,
  });

  const quotesQuery = useQuery({
    queryKey: ["customer", "quotes", user?.user_id],
    queryFn: () => fetchQuotes(),
    enabled: !!user,
  });

  const notificationsQuery = useQuery({
    queryKey: ["customer", "notifications", user?.user_id],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
  });

  const productsQuery = useQuery({
    queryKey: productsKey,
    queryFn: () => fetchProducts(),
  });

  const conversationsQuery = useQuery({
    queryKey: ["customer", "conversations", user?.user_id],
    queryFn: () => fetchConversations(),
    enabled: !!user,
  });

  const addressesQuery = useQuery({
    queryKey: ["customer", "addresses", user?.user_id],
    queryFn: () => fetchAddresses(),
    enabled: !!user,
  });

  const favoritesQuery = useQuery({
    queryKey: ["customer", "favorites", user?.user_id],
    queryFn: () => fetchFavorites(),
    enabled: !!user,
  });

  React.useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfilePhone(user.phone);
    }
  }, [user]);

  // Sign out handler
  const handleSignOut = async () => {
    await logout();
    nav({ to: "/", replace: true });
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
          <UserIcon className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Please Sign In</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access your customer dashboard, track orders, and view quote inquiries.
        </p>
        <Button
          asChild
          className="mt-6 w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Link to="/login">Sign In to Polar Fiber</Link>
        </Button>
      </div>
    );
  }

  // Data helpers
  const allOrders = ordersQuery.data ?? [];
  const allQuotes = quotesQuery.data ?? [];
  const allProducts = productsQuery.data ?? [];

  const activeOrdersCount = allOrders.filter(
    (o) => o.status === "Pending" || o.status === "Confirmed" || o.status === "In Production",
  ).length;

  const pendingQuotesCount = allQuotes.filter((q) => q.status === "New").length;

  const completedOrdersCount = allOrders.filter((o) => o.status === "Delivered").length;

  const displayNotifications: CustomerNotification[] = React.useMemo(() => {
    if (!notificationsQuery.data || !notificationsQuery.data.length) return notifications;
    const dbNotifs: CustomerNotification[] = notificationsQuery.data.map((n) => ({
      id: `db-notif-${n.id}`,
      title: n.title,
      message: n.body,
      date: n.created_at || "Recent",
      read: Boolean(n.is_read),
      type: (n.type.includes("order")
        ? "order"
        : n.type.includes("quote")
          ? "quote"
          : "system") as CustomerNotification["type"],
    }));
    return [...dbNotifs, ...notifications];
  }, [notificationsQuery.data, notifications]);

  const unreadNotificationsCount = displayNotifications.filter((n) => !n.read).length;

  // Unread customer messages / replies from admin
  const unreadRepliesCount = (conversationsQuery.data ?? []).filter((c) => c.status === "Admin Replied").length;

  // Recent orders & quotes
  const recentOrders = allOrders.slice(0, 5);
  const recentQuotes = allQuotes.slice(0, 5);

  // Handlers
  const handleReorder = (order: Order) => {
    let addedCount = 0;
    for (const item of order.items) {
      if (item.product_id) {
        addToCart(item.product_id, item.quantity);
        addedCount += item.quantity;
      }
    }
    toast.success(`Added ${addedCount} item(s) from Order #${order.order_id} to your cart.`);
    setOrderDrawerOpen(false);
    nav({ to: "/cart" });
  };

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
      await mutateUpdateAddress({ data: { address_id: editingAddressId, ...newAddressForm } });
      addressesQuery.refetch();
      toast.success("Address updated successfully!");
      setNewAddressDialogOpen(false);
      setEditingAddressId(null);
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

  const handleSendReply = async () => {
    if (!replyInput.trim() || !selectedConversation) return;

    setLoadingMessages(true);
    try {
      await mutateReplyConversation({
        data: { conversation_id: selectedConversation.conversation_id, text: replyInput.trim() },
      });
      // Refetch messages
      const messages = await fetchConversationMessages({ data: { conversation_id: selectedConversation.conversation_id } });
      setConversationMessages(messages);
      // Refetch conversations to update status
      conversationsQuery.refetch();
      setReplyInput("");
      toast.success("Message sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleCreateNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageForm.subject.trim() || !newMessageForm.text.trim()) {
      toast.error("Please fill in subject and message.");
      return;
    }

    try {
      const result = await mutateCreateConversation({ data: newMessageForm });
      if (result.conversation_id) {
        // Refetch conversations
        conversationsQuery.refetch();
        setNewMessageDialogOpen(false);
        setNewMessageForm({ subject: "", topic: "General Inquiry", text: "" });
        toast.success("New message sent successfully!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create conversation");
    }
  };

  // Filtered orders
  const filteredOrders = allOrders.filter((o) => {
    const matchesSearch =
      o.order_id.toString().includes(orderSearch) ||
      o.address.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.items.some((i) => i.product_name.toLowerCase().includes(orderSearch.toLowerCase()));
    const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filtered conversations
  const filteredConversations = (conversationsQuery.data ?? []).filter((c) => {
    return (
      c.subject.toLowerCase().includes(messageSearch.toLowerCase()) ||
      c.topic.toLowerCase().includes(messageSearch.toLowerCase()) ||
      (c.last_message_text?.toLowerCase().includes(messageSearch.toLowerCase()) ?? false)
    );
  });

  // Customer Navigation Items (Including Messages for Customer as well)
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "My Orders", icon: Package, badge: allOrders.length || undefined },
    { id: "quotes", label: "My Quotes", icon: FileText, badge: allQuotes.length || undefined },
    {
      id: "messages",
      label: "Messages",
      icon: MessageSquare,
      badge: unreadRepliesCount || undefined,
    },
    { id: "favorites", label: "Favorites", icon: Heart },
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "addresses", label: "Addresses", icon: MapPin },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotificationsCount || undefined,
    },
    { id: "support", label: "Support", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col">
      {/* Top Header Bar matching Screenshot */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/images/logo.png" alt="Polar Fiber" className="h-8 w-auto object-contain" />
            <span className="font-bold text-base text-foreground tracking-tight">Polar Fiber</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
            {user.name}
          </span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 pt-6 transition-transform duration-200 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:translate-x-0 lg:overflow-y-auto",
            mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="space-y-4">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer text-left",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                          isActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/40 group-hover:text-sidebar-accent-foreground",
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          isActive
                            ? "bg-sidebar-accent/60 text-sidebar-accent-foreground"
                            : "bg-sidebar-border text-sidebar-foreground/70",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-sidebar-border space-y-2">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Back to Store</span>
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-6 sm:p-8 lg:p-10">
          <div className="max-w-6xl mx-auto">
            {/* ======================================================== */}
            {/* 1. OVERVIEW TAB (Exact match to requested visual layout) */}
            {/* ======================================================== */}
            {activeTab === "overview" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* Greeting Header */}
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Welcome, {user.name}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Here is an overview of your account activity.
                  </p>
                </div>

                {/* 4 Stat Cards in 1 row (4 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
                  {/* Card 1: Active Orders */}
                  <div
                    onClick={() => setActiveTab("orders")}
                    className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Active Orders</p>
                      <p className="text-3xl font-bold text-foreground mt-1.5">
                        {activeOrdersCount}
                      </p>
                    </div>
                    <div className="h-13 w-13 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                      <Package className="h-6 w-6 stroke-[2]" />
                    </div>
                  </div>

                  {/* Card 2: Pending Quotes */}
                  <div
                    onClick={() => setActiveTab("quotes")}
                    className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Pending Quotes</p>
                      <p className="text-3xl font-bold text-foreground mt-1.5">
                        {pendingQuotesCount}
                      </p>
                    </div>
                    <div className="h-13 w-13 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                      <FileText className="h-6 w-6 stroke-[2]" />
                    </div>
                  </div>

                  {/* Card 3: Completed Orders */}
                  <div
                    onClick={() => {
                      setOrderStatusFilter("Delivered");
                      setActiveTab("orders");
                    }}
                    className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Completed Orders
                      </p>
                      <p className="text-3xl font-bold text-foreground mt-1.5">
                        {completedOrdersCount}
                      </p>
                    </div>
                    <div className="h-13 w-13 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="h-6 w-6 stroke-[2]" />
                    </div>
                  </div>

                  {/* Card 4: Unread Notifications */}
                  <div
                    onClick={() => setActiveTab("notifications")}
                    className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Unread Notifications
                      </p>
                      <p className="text-3xl font-bold text-foreground mt-1.5">
                        {unreadNotificationsCount}
                      </p>
                    </div>
                    <div className="h-13 w-13 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                      <Bell className="h-6 w-6 stroke-[2]" />
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 py-2.5 rounded-xl shadow-xs"
                  >
                    <Link to="/products">Browse Products</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="bg-card border-border hover:bg-muted/60 text-foreground font-medium px-5 py-2.5 rounded-xl"
                  >
                    <Link to="/quote">Request a Quote</Link>
                  </Button>
                </div>

                {/* Recent Orders Horizontal Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <h2 className="text-base font-bold text-foreground">Recent Orders</h2>
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div className="pt-6">
                    {recentOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No orders yet.{" "}
                        <Link to="/products" className="text-primary font-semibold hover:underline">
                          Browse products
                        </Link>{" "}
                        to place your first order.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {recentOrders.map((ord) => (
                          <div
                            key={ord.order_id}
                            onClick={() => {
                              setSelectedOrder(ord);
                              setOrderDrawerOpen(true);
                            }}
                            className="py-3.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-xl transition-colors cursor-pointer"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2.5">
                                <span className="font-semibold text-sm text-foreground">
                                  Order #{ord.order_id}
                                </span>
                                <StatusBadge s={ord.status} />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {ord.created_at} ·{" "}
                                {ord.items
                                  .map((i) => `${i.quantity}x ${i.product_name}`)
                                  .join(", ")}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-primary text-sm">
                                {etb(ord.total)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Quotes Horizontal Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <h2 className="text-base font-bold text-foreground">Recent Quotes</h2>
                    <button
                      onClick={() => setActiveTab("quotes")}
                      className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div className="pt-6">
                    {recentQuotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No quotes yet.{" "}
                        <Link to="/quote" className="text-primary font-semibold hover:underline">
                          Request a quote
                        </Link>{" "}
                        to get started.
                      </p>
                    ) : (
                      <div className="divide-y divide-border">
                        {recentQuotes.map((q) => (
                          <div
                            key={q.quote_id}
                            onClick={() => {
                              setSelectedQuote(q);
                              setActiveTab("quotes");
                            }}
                            className="py-3.5 flex items-center justify-between hover:bg-muted/40 px-2 rounded-xl transition-colors cursor-pointer"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <div className="flex items-center gap-2.5">
                                <span className="font-semibold text-sm text-foreground truncate">
                                  {q.subject}
                                </span>
                                <StatusBadge s={q.status} />
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {q.created_at}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-primary shrink-0"
                            >
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 2. MY ORDERS TAB                                        */}
            {/* ======================================================== */}
            {activeTab === "orders" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">My Orders</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Track manufacturing, shipping status, and order history
                    </p>
                  </div>
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <Link to="/products">
                      <Plus className="h-4 w-4" />
                      New Order
                    </Link>
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search order #, items, address..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-9 border-border"
                    />
                  </div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="In Production">In Production</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-4">Order #</th>
                          <th className="px-5 py-4">Date Placed</th>
                          <th className="px-5 py-4">Ordered Items</th>
                          <th className="px-5 py-4">Total</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-12 text-center text-muted-foreground/60 text-sm"
                            >
                              No orders found matching your search.
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((o) => (
                            <tr
                              key={o.order_id}
                              onClick={() => {
                                setSelectedOrder(o);
                                setOrderDrawerOpen(true);
                              }}
                              className="hover:bg-muted/40 transition-colors cursor-pointer"
                            >
                              <td className="px-5 py-4 font-bold text-foreground">#{o.order_id}</td>
                              <td className="px-5 py-4 text-muted-foreground text-xs">
                                {o.created_at}
                              </td>
                              <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                                {o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                              </td>
                              <td className="px-5 py-4 font-bold text-primary">{etb(o.total)}</td>
                              <td className="px-5 py-4">
                                <StatusBadge s={o.status} />
                              </td>
                              <td className="px-5 py-4 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs text-primary font-semibold"
                                >
                                  Track Details
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 3. MY QUOTES TAB                                        */}
            {/* ======================================================== */}
            {activeTab === "quotes" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      My Quote Requests
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Review custom engineering and fabrication inquiries
                    </p>
                  </div>
                  <Button
                    asChild
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <Link to="/quote">
                      <Plus className="h-4 w-4" />
                      Request New Quote
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allQuotes.length === 0 ? (
                    <div className="col-span-2 bg-card border border-border rounded-2xl p-12 text-center">
                      <EmptyState
                        icon={FileText}
                        title="No quote inquiries found"
                        description="You haven't requested any custom fiberglass fabrication quotes yet."
                        actionLabel="Request a Quote"
                        onAction={() => nav({ to: "/quote" })}
                        className="border-none py-4"
                      />
                    </div>
                  ) : (
                    allQuotes.map((q) => (
                      <div
                        key={q.quote_id}
                        className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between border-b border-border pb-3">
                          <span className="text-xs font-semibold text-muted-foreground/60">
                            Inquiry #{q.quote_id}
                          </span>
                          <StatusBadge s={q.status} />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base">{q.subject}</h3>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            Submitted on {q.created_at}
                          </p>
                          <div className="mt-3 rounded-xl bg-muted/50 p-3.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                            {q.message}
                          </div>
                        </div>
                        <div className="pt-2 flex justify-between items-center text-xs">
                          <span className="text-muted-foreground/60">Response via: {q.email}</span>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="text-xs text-primary"
                          >
                            <a
                              href={`mailto:info@polarfiber.et?subject=Follow-up on Inquiry #${q.quote_id}`}
                            >
                              Follow Up
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 4. MESSAGES TAB (Customer-to-Admin Messaging)            */}
            {/* ======================================================== */}
            {activeTab === "messages" && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      Direct Messages
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Chat directly with Polar Fiber engineers, sales, and support
                    </p>
                  </div>
                  <Button
                    onClick={() => setNewMessageDialogOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Message
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Conversation List */}
                  <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                      <Input
                        placeholder="Search conversations..."
                        value={messageSearch}
                        onChange={(e) => setMessageSearch(e.target.value)}
                        className="pl-8 text-xs border-border h-8"
                      />
                    </div>

                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                      {conversationsQuery.isLoading ? (
                        <p className="p-8 text-center text-xs text-muted-foreground/60">Loading conversations...</p>
                      ) : conversationsQuery.data?.length === 0 ? (
                        <p className="p-8 text-center text-xs text-muted-foreground/60">
                          No message threads found. Start a new conversation!
                        </p>
                      ) : (
                        filteredConversations.map((conv) => {
                          const isSelected = selectedConversation?.conversation_id === conv.conversation_id;
                          return (
                            <div
                              key={conv.conversation_id}
                              onClick={() => {
                                setSelectedConversation(conv);
                                setLoadingMessages(true);
                                fetchConversationMessages({ data: { conversation_id: conv.conversation_id } })
                                  .then((msgs) => {
                                    setConversationMessages(msgs);
                                    setLoadingMessages(false);
                                  })
                                  .catch(() => setLoadingMessages(false));
                              }}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-xs"
                                  : "border-border hover:bg-muted/50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                  {conv.topic}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    conv.status === "Admin Replied"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : conv.status === "Resolved"
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {conv.status}
                                </span>
                              </div>
                              <h4 className="font-semibold text-sm text-foreground mt-1 line-clamp-1">
                                {conv.subject}
                              </h4>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {conv.last_message_text ?? "No messages yet"}
                              </p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1 text-right">
                                {conv.updated_at}
                              </p>
                              {conv.unread_count && conv.unread_count > 0 && (
                                <span className="text-[10px] font-bold text-emerald-600">
                                  {conv.unread_count} unread
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Message Stream & Reply Box */}
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-2 flex flex-col justify-between min-h-[500px]">
                    {selectedConversation ? (
                      <div className="flex flex-col h-full justify-between space-y-4">
                        {/* Conversation Header */}
                        <div className="border-b border-border pb-3 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-base text-foreground">
                              {selectedConversation.subject}
                            </h3>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                              Topic: {selectedConversation.topic}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              selectedConversation.status === "Admin Replied"
                                ? "bg-emerald-100 text-emerald-800"
                                : selectedConversation.status === "Resolved"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {selectedConversation.status}
                          </span>
                        </div>

                        {/* Message History Bubble Stream */}
                        <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[380px] p-2">
                          {loadingMessages ? (
                            <p className="p-4 text-center text-xs text-muted-foreground/60">Loading messages...</p>
                          ) : conversationMessages.length === 0 ? (
                            <p className="p-8 text-center text-xs text-muted-foreground/60">
                              No messages in this conversation yet.
                            </p>
                          ) : (
                            conversationMessages.map((m) => {
                              const isMe = m.sender_type === "customer";
                              return (
                                <div key={m.message_id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                  <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground/60">
                                    <span className="font-semibold text-muted-foreground">
                                      {m.sender_name}
                                    </span>
                                    <span>·</span>
                                    <span>{new Date(m.created_at).toLocaleString()}</span>
                                  </div>
                                  <div
                                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                                      isMe
                                        ? "bg-primary text-primary-foreground rounded-tr-xs"
                                        : "bg-muted text-foreground rounded-tl-xs border border-border/60"
                                    }`}
                                  >
                                    {m.text}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Reply Input Box */}
                        <div className="pt-3 border-t border-border flex items-center gap-2">
                          <Input
                            placeholder="Type your response or follow-up question..."
                            value={replyInput}
                            onChange={(e) => setReplyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply();
                              }
                            }}
                            className="bg-muted/50 border-border flex-1"
                            disabled={loadingMessages}
                          />
                          <Button
                            onClick={handleSendReply}
                            disabled={loadingMessages || !replyInput.trim()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                          >
                            <Send className="h-4 w-4" />
                            Send
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        icon={MessageSquare}
                        title="No conversation selected"
                        description="Select a conversation thread from the left or create a new message."
                        className="border-none py-20"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 5. FAVORITES TAB                                        */}
            {/* ======================================================== */}
            {activeTab === "favorites" && (
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
                    <div className="col-span-4 p-8 text-center text-xs text-muted-foreground/60">Loading favorites...</div>
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
                          <h4 className="font-bold text-foreground text-sm line-clamp-1">{p.product_name}</h4>
                          {p.product_capacity && <p className="text-xs text-muted-foreground mt-0.5">{p.product_capacity}</p>}
                          <p className="font-bold text-primary text-base mt-2">{etb(p.product_price ?? 0)}</p>
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
                            onClick={() => mutateRemoveFavorite({ data: { product_id: p.product_id } }).then(() => favoritesQuery.refetch())}
                          >
                            <Heart className="h-3.5 w-3.5 fill-current" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 6. PROFILE TAB                                          */}
            {/* ======================================================== */}
            {activeTab === "profile" && (
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
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Full Name
                      </Label>
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
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Phone Number
                      </Label>
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
                      <Label className="text-xs font-semibold text-muted-foreground">
                        New Password
                      </Label>
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
            )}

            {/* ======================================================== */}
            {/* 7. ADDRESSES TAB                                        */}
            {/* ======================================================== */}
            {activeTab === "addresses" && (
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
                    <p className="p-8 text-center text-xs text-muted-foreground/60 col-span-2">Loading addresses...</p>
                  ) : addressesQuery.data?.length === 0 ? (
                    <div className="col-span-2 bg-card border border-border rounded-2xl p-12 text-center">
                      <EmptyState
                        icon={MapPin}
                        title="No addresses saved"
                        description="Add your first delivery address for faster checkout."
                        actionLabel="Add Address"
                        onAction={() => {
                          setEditingAddressId(null);
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
              </div>
            )}

            {/* ======================================================== */}
            {/* 8. NOTIFICATIONS TAB                                    */}
            {/* ======================================================== */}
            {activeTab === "notifications" && (
              <div className="space-y-6 max-w-2xl animate-in fade-in-50 duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      Account Notifications
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Updates on your equipment orders and quotes
                    </p>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNotifications(notifications.map((n) => ({ ...n, read: true })));
                        toast.success("All marked as read");
                      }}
                      className="text-xs text-primary border-primary/20"
                    >
                      Mark all as read
                    </Button>
                  )}
                </div>

                <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-xs overflow-hidden">
                  {displayNotifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "p-4 flex items-start gap-3.5 transition-colors",
                        !n.read ? "bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{n.title}</p>
                          <span className="text-[11px] text-muted-foreground/60">{n.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 9. SUPPORT TAB                                          */}
            {/* ======================================================== */}
            {activeTab === "support" && (
              <div className="space-y-6 max-w-3xl animate-in fade-in-50 duration-200">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Customer Support
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Direct contact with Polar Fiber engineering and sales engineers
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Phone className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-foreground">Direct Sales & Helpdesk</h3>
                    <p className="text-xs text-muted-foreground">
                      Available Monday - Saturday, 8:00 AM - 6:00 PM
                    </p>
                    <p className="font-semibold text-sm text-primary pt-1">+251 911 234 567</p>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-foreground">Engineering Support Email</h3>
                    <p className="text-xs text-muted-foreground">
                      Send technical drawings and specs
                    </p>
                    <p className="font-semibold text-sm text-emerald-600 pt-1">
                      support@polarfiber.et
                    </p>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
                    Frequently Asked Technical Questions
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="p-3.5 rounded-xl bg-muted/50">
                      <p className="font-semibold text-foreground text-xs">
                        How do I maintain my fiberglass water tanker?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Polar Fiber water tankers feature food-grade gelcoat linings that resist
                        algae and bacterial growth. Simply flush with clean potable water once every
                        six months.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-muted/50">
                      <p className="font-semibold text-foreground text-xs">
                        What is the warranty period for roofing sheets?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Our reinforced fiberglass corrugated sheets come with a 15-year weather and
                        UV resistance manufacturer warranty.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Customer Order Drawer */}
      <OrderDrawer
        order={selectedOrder}
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        mode="customer"
        onReorder={handleReorder}
      />

      {/* Add Address Dialog */}
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
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, label: e.target.value })}
                  placeholder="e.g. Construction Site Bole"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Recipient Name</Label>
                <Input
                  value={newAddressForm.recipient}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, recipient: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Contact Phone</Label>
                <Input
                  value={newAddressForm.phone}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Address Line 1</Label>
                <Input
                  value={newAddressForm.line1}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, line1: e.target.value })}
                  placeholder="e.g. Next to Edna Mall, Block B"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Address Line 2 (Optional)</Label>
                <Input
                  value={newAddressForm.line2}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, line2: e.target.value })}
                  placeholder="e.g. Apartment 4B"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">City</Label>
                  <Input
                    value={newAddressForm.city}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">Region / Sub-city</Label>
                  <Input
                    value={newAddressForm.region}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, region: e.target.value })}
                    placeholder="e.g. Bole"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Country</Label>
                <Input
                  value={newAddressForm.country}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, country: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newAddressForm.is_default}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, is_default: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <Label htmlFor="is_default" className="text-xs cursor-pointer">
                  Set as default delivery address
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => {
                setNewAddressDialogOpen(false);
                setEditingAddressId(null);
              }}>
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

      {/* New Message Dialog */}
      {newMessageDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <form
            onSubmit={handleCreateNewConversation}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-lg text-foreground">New Message to Polar Fiber</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  Department / Topic
                </Label>
                <select
                  value={newMessageForm.topic}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, topic: e.target.value })}
                  className="w-full h-10 rounded-lg border border-border px-3 text-sm mt-1"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Custom Engineering">Custom Engineering</option>
                  <option value="Order Status Inquiry">Order Status Inquiry</option>
                  <option value="Delivery Support">Delivery Support</option>
                  <option value="Warranty & Maintenance">Warranty & Maintenance</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
                <Input
                  value={newMessageForm.subject}
                  onChange={(e) =>
                    setNewMessageForm({ ...newMessageForm, subject: e.target.value })
                  }
                  placeholder="e.g. Inquiring on tank flange connection specs"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">Message</Label>
                <textarea
                  rows={4}
                  value={newMessageForm.text}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, text: e.target.value })}
                  placeholder="Write your question or request..."
                  className="w-full rounded-xl border border-border p-3 text-sm focus:outline-primary mt-1"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setNewMessageDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Send Message
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
