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
import {
  etb,
  type Order,
  type Quote,
  type Product,
} from "@/shared/data";
import { useStore, productsKey } from "@/frontend/store";
import {
  getMyDashboard,
  getMyOrders,
  getMyQuotes,
  getProducts,
  updateMyProfile,
  changeMyPassword,
} from "@/backend/api.functions";
import { cn } from "@/frontend/utils";

// Customer Message Thread Types
interface CustomerMessageItem {
  id: string;
  sender: "customer" | "admin";
  senderName: string;
  text: string;
  timestamp: string;
}

interface CustomerConversation {
  id: string;
  subject: string;
  topic: string;
  status: "Awaiting Reply" | "Admin Replied" | "Resolved";
  updated_at: string;
  messages: CustomerMessageItem[];
}

const INITIAL_CUSTOMER_CONVERSATIONS: CustomerConversation[] = [
  {
    id: "CONV-101",
    subject: "Inquiry regarding 15,000L vertical water tanker installation",
    topic: "Custom Engineering",
    status: "Admin Replied",
    updated_at: "Today, 10:30 AM",
    messages: [
      {
        id: "m-1",
        sender: "customer",
        senderName: "You",
        text: "Hello Polar Fiber team, we need technical advice on the concrete foundation specifications required before installing the 15,000L vertical fiberglass tanker.",
        timestamp: "Yesterday, 3:15 PM",
      },
      {
        id: "m-2",
        sender: "admin",
        senderName: "Polar Fiber Engineering (Tadesse M.)",
        text: "Hello! For a 15,000L vertical tank, we recommend a reinforced concrete pad at least 150mm thick with C25 concrete strength, completely level and free of sharp aggregate. We have attached the foundation blueprint to your customer records.",
        timestamp: "Today, 10:30 AM",
      },
    ],
  },
  {
    id: "CONV-102",
    subject: "Delivery timeline for ribbed roof sheets order",
    topic: "Order Status Inquiry",
    status: "Awaiting Reply",
    updated_at: "Yesterday",
    messages: [
      {
        id: "m-3",
        sender: "customer",
        senderName: "You",
        text: "Could you confirm the estimated delivery date to our construction site in Bole?",
        timestamp: "Yesterday, 5:45 PM",
      },
    ],
  },
];

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
    message: "Thank you for choosing Polar Fiber. Your order has been registered and is being reviewed by engineering.",
    date: "Just now",
    read: false,
    type: "order",
  },
  {
    id: "notif-2",
    title: "Catalog Updated",
    message: "New heavy-duty corrugated fiberglass roof sheets and vertical water tankers are now available in catalog.",
    date: "1 day ago",
    read: true,
    type: "system",
  },
];

// Seed Customer Addresses
interface CustomerAddress {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  city: string;
  subcity: string;
  details: string;
  isDefault: boolean;
}

const INITIAL_ADDRESSES: CustomerAddress[] = [
  {
    id: "addr-1",
    label: "Factory / Construction Site",
    recipient: "Abdu Ahmed",
    phone: "+251 911 234 567",
    city: "Addis Ababa",
    subcity: "Bole Sub-City, Woreda 03",
    details: "Near Bole Medhanealem, Commercial Building Project Site",
    isDefault: true,
  },
  {
    id: "addr-2",
    label: "Main Office / Warehouse",
    recipient: "Abdu Ahmed",
    phone: "+251 911 234 567",
    city: "Addis Ababa",
    subcity: "Kirkos Sub-City",
    details: "Mexico Square, Kirkos Commercial Center, 4th Floor",
    isDefault: false,
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
  const [conversations, setConversations] = React.useState<CustomerConversation[]>(INITIAL_CUSTOMER_CONVERSATIONS);
  const [selectedConversation, setSelectedConversation] = React.useState<CustomerConversation | null>(INITIAL_CUSTOMER_CONVERSATIONS[0] ?? null);
  const [messageSearch, setMessageSearch] = React.useState("");
  const [replyInput, setReplyInput] = React.useState("");
  const [newMessageDialogOpen, setNewMessageDialogOpen] = React.useState(false);
  const [newMessageForm, setNewMessageForm] = React.useState({
    subject: "",
    topic: "General Inquiry",
    text: "",
  });

  // Notifications State
  const [notifications, setNotifications] = React.useState<CustomerNotification[]>(INITIAL_NOTIFICATIONS);

  // Addresses State
  const [addresses, setAddresses] = React.useState<CustomerAddress[]>(INITIAL_ADDRESSES);
  const [newAddressDialogOpen, setNewAddressDialogOpen] = React.useState(false);
  const [newAddressForm, setNewAddressForm] = React.useState({
    label: "New Address",
    recipient: user?.name ?? "",
    phone: user?.phone ?? "",
    city: "Addis Ababa",
    subcity: "",
    details: "",
    isDefault: false,
  });

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

  const productsQuery = useQuery({
    queryKey: productsKey,
    queryFn: () => fetchProducts(),
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
        <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-sky-50 text-sky-600 shadow-xs">
          <UserIcon className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Please Sign In</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to access your customer dashboard, track orders, and view quote inquiries.
        </p>
        <Button asChild className="mt-6 w-full bg-sky-600 hover:bg-sky-700 text-white">
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

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Unread customer messages / replies from admin
  const unreadRepliesCount = conversations.filter((c) => c.status === "Admin Replied").length;

  // Recent orders & quotes
  const recentOrders = allOrders.slice(0, 5);
  const recentQuotes = allQuotes.slice(0, 5);

  // Favorites (using first 4 products as featured favorites)
  const favoriteProducts = allProducts.slice(0, 4);

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

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressForm.details || !newAddressForm.subcity) {
      toast.error("Please fill in subcity and address details.");
      return;
    }
    const newAddr: CustomerAddress = {
      id: `addr-${Date.now()}`,
      label: newAddressForm.label || "Delivery Location",
      recipient: newAddressForm.recipient || user.name,
      phone: newAddressForm.phone || user.phone,
      city: newAddressForm.city || "Addis Ababa",
      subcity: newAddressForm.subcity,
      details: newAddressForm.details,
      isDefault: newAddressForm.isDefault || addresses.length === 0,
    };
    if (newAddr.isDefault) {
      setAddresses(addresses.map((a) => ({ ...a, isDefault: false })).concat(newAddr));
    } else {
      setAddresses([...addresses, newAddr]);
    }
    toast.success("Address added successfully!");
    setNewAddressDialogOpen(false);
  };

  const handleSendReply = () => {
    if (!replyInput.trim() || !selectedConversation) return;

    const newMsg: CustomerMessageItem = {
      id: `m-${Date.now()}`,
      sender: "customer",
      senderName: "You",
      text: replyInput.trim(),
      timestamp: "Just now",
    };

    const updatedConv: CustomerConversation = {
      ...selectedConversation,
      status: "Awaiting Reply",
      updated_at: "Just now",
      messages: [...selectedConversation.messages, newMsg],
    };

    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversation.id ? updatedConv : c)),
    );
    setSelectedConversation(updatedConv);
    setReplyInput("");
    toast.success("Message sent to Polar Fiber engineering team.");
  };

  const handleCreateNewConversation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageForm.subject.trim() || !newMessageForm.text.trim()) {
      toast.error("Please fill in subject and message.");
      return;
    }

    const newConv: CustomerConversation = {
      id: `CONV-${Math.floor(100 + Math.random() * 900)}`,
      subject: newMessageForm.subject.trim(),
      topic: newMessageForm.topic,
      status: "Awaiting Reply",
      updated_at: "Just now",
      messages: [
        {
          id: `m-${Date.now()}`,
          sender: "customer",
          senderName: "You",
          text: newMessageForm.text.trim(),
          timestamp: "Just now",
        },
      ],
    };

    setConversations([newConv, ...conversations]);
    setSelectedConversation(newConv);
    setNewMessageDialogOpen(false);
    setNewMessageForm({ subject: "", topic: "General Inquiry", text: "" });
    toast.success("New message sent successfully!");
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
  const filteredConversations = conversations.filter((c) => {
    return (
      c.subject.toLowerCase().includes(messageSearch.toLowerCase()) ||
      c.topic.toLowerCase().includes(messageSearch.toLowerCase()) ||
      c.messages.some((m) => m.text.toLowerCase().includes(messageSearch.toLowerCase()))
    );
  });

  // Customer Navigation Items (Including Messages for Customer as well)
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "My Orders", icon: Package, badge: allOrders.length || undefined },
    { id: "quotes", label: "My Quotes", icon: FileText, badge: allQuotes.length || undefined },
    { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadRepliesCount || undefined },
    { id: "favorites", label: "Favorites", icon: Heart },
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotificationsCount || undefined },
    { id: "support", label: "Support", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 antialiased flex flex-col">
      {/* Top Header Bar matching Screenshot */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/images/logo.png" alt="Polar Fiber" className="h-8 w-auto object-contain" />
            <span className="font-bold text-base text-slate-900 tracking-tight">Polar Fiber</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">
            {user.name}
          </span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col justify-between border-r border-slate-100 bg-white p-4 pt-6 transition-transform duration-200 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:translate-x-0 lg:overflow-y-auto",
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
                        ? "bg-sky-50 text-sky-600 font-semibold shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                          isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600",
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          isActive ? "bg-sky-200/60 text-sky-700" : "bg-slate-100 text-slate-600",
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

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
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
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Welcome, {user.name}
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Here is an overview of your account activity.
                  </p>
                </div>

                {/* 4 Stat Cards in 1 row (4 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
                  {/* Card 1: Active Orders */}
                  <div
                    onClick={() => setActiveTab("orders")}
                    className="group bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-slate-200 cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Active Orders</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1.5">{activeOrdersCount}</p>
                    </div>
                    <div className="h-13 w-13 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 group-hover:scale-105 transition-transform">
                      <Package className="h-6 w-6 stroke-[2]" />
                    </div>
                  </div>

                  {/* Card 2: Pending Quotes */}
                  <div
                    onClick={() => setActiveTab("quotes")}
                    className="group bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-slate-200 cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Pending Quotes</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1.5">{pendingQuotesCount}</p>
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
                    className="group bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-slate-200 cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Completed Orders</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1.5">{completedOrdersCount}</p>
                    </div>
                    <div className="h-13 w-13 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="h-6 w-6 stroke-[2]" />
                    </div>
                  </div>

                  {/* Card 4: Unread Notifications */}
                  <div
                    onClick={() => setActiveTab("notifications")}
                    className="group bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-slate-200 cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Unread Notifications</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1.5">
                        {unreadNotificationsCount}
                      </p>
                    </div>
                    <div className="h-13 w-13 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 group-hover:scale-105 transition-transform">
                      <Bell className="h-6 w-6 stroke-[2]" />
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    asChild
                    className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-xs"
                  >
                    <Link to="/products">Browse Products</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-5 py-2.5 rounded-xl"
                  >
                    <Link to="/quote">Request a Quote</Link>
                  </Button>
                </div>

                {/* Recent Orders Horizontal Card */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div className="pt-6">
                    {recentOrders.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">
                        No orders yet.{" "}
                        <Link to="/products" className="text-sky-600 font-semibold hover:underline">
                          Browse products
                        </Link>{" "}
                        to place your first order.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {recentOrders.map((ord) => (
                          <div
                            key={ord.order_id}
                            onClick={() => {
                              setSelectedOrder(ord);
                              setOrderDrawerOpen(true);
                            }}
                            className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2.5">
                                <span className="font-semibold text-sm text-slate-900">
                                  Order #{ord.order_id}
                                </span>
                                <StatusBadge s={ord.status} />
                              </div>
                              <p className="text-xs text-slate-500">
                                {ord.created_at} · {ord.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-sky-600 text-sm">{etb(ord.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Quotes Horizontal Card */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900">Recent Quotes</h2>
                    <button
                      onClick={() => setActiveTab("quotes")}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-700 cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div className="pt-6">
                    {recentQuotes.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">
                        No quotes yet.{" "}
                        <Link to="/quote" className="text-sky-600 font-semibold hover:underline">
                          Request a quote
                        </Link>{" "}
                        to get started.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {recentQuotes.map((q) => (
                          <div
                            key={q.quote_id}
                            onClick={() => {
                              setSelectedQuote(q);
                              setActiveTab("quotes");
                            }}
                            className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer"
                          >
                            <div className="space-y-0.5 min-w-0 pr-2">
                              <div className="flex items-center gap-2.5">
                                <span className="font-semibold text-sm text-slate-900 truncate">
                                  {q.subject}
                                </span>
                                <StatusBadge s={q.status} />
                              </div>
                              <p className="text-xs text-slate-500 truncate">{q.created_at}</p>
                            </div>
                            <Button size="sm" variant="ghost" className="text-xs text-sky-600 shrink-0">
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Orders</h1>
                    <p className="text-sm text-slate-500 mt-1">Track manufacturing, shipping status, and order history</p>
                  </div>
                  <Button asChild className="bg-sky-600 hover:bg-sky-700 text-white gap-2">
                    <Link to="/products">
                      <Plus className="h-4 w-4" />
                      New Order
                    </Link>
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search order #, items, address..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-9 bg-white border-slate-200"
                    />
                  </div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="In Production">In Production</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-5 py-4">Order #</th>
                          <th className="px-5 py-4">Date Placed</th>
                          <th className="px-5 py-4">Ordered Items</th>
                          <th className="px-5 py-4">Total</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
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
                              className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                            >
                              <td className="px-5 py-4 font-bold text-slate-900">#{o.order_id}</td>
                              <td className="px-5 py-4 text-slate-500 text-xs">{o.created_at}</td>
                              <td className="px-5 py-4 text-xs text-slate-600 max-w-xs truncate">
                                {o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                              </td>
                              <td className="px-5 py-4 font-bold text-sky-600">{etb(o.total)}</td>
                              <td className="px-5 py-4">
                                <StatusBadge s={o.status} />
                              </td>
                              <td className="px-5 py-4 text-right">
                                <Button size="sm" variant="ghost" className="text-xs text-sky-600 font-semibold">
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Quote Requests</h1>
                    <p className="text-sm text-slate-500 mt-1">Review custom engineering and fabrication inquiries</p>
                  </div>
                  <Button asChild className="bg-sky-600 hover:bg-sky-700 text-white gap-2">
                    <Link to="/quote">
                      <Plus className="h-4 w-4" />
                      Request New Quote
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allQuotes.length === 0 ? (
                    <div className="col-span-2 bg-white border border-slate-100 rounded-2xl p-12 text-center">
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
                        className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <span className="text-xs font-semibold text-slate-400">Inquiry #{q.quote_id}</span>
                          <StatusBadge s={q.status} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">{q.subject}</h3>
                          <p className="text-xs text-slate-400 mt-1">Submitted on {q.created_at}</p>
                          <div className="mt-3 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {q.message}
                          </div>
                        </div>
                        <div className="pt-2 flex justify-between items-center text-xs">
                          <span className="text-slate-400">Response via: {q.email}</span>
                          <Button asChild size="sm" variant="outline" className="text-xs text-sky-600">
                            <a href={`mailto:info@polarfiber.et?subject=Follow-up on Inquiry #${q.quote_id}`}>
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Direct Messages</h1>
                    <p className="text-sm text-slate-500 mt-1">Chat directly with Polar Fiber engineers, sales, and support</p>
                  </div>
                  <Button
                    onClick={() => setNewMessageDialogOpen(true)}
                    className="bg-sky-600 hover:bg-sky-700 text-white gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Message
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Conversation List */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search conversations..."
                        value={messageSearch}
                        onChange={(e) => setMessageSearch(e.target.value)}
                        className="pl-8 text-xs bg-slate-50 border-slate-200 h-8"
                      />
                    </div>

                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                      {filteredConversations.length === 0 ? (
                        <p className="p-8 text-center text-xs text-slate-400">No message threads found.</p>
                      ) : (
                        filteredConversations.map((conv) => {
                          const isSelected = selectedConversation?.id === conv.id;
                          return (
                            <div
                              key={conv.id}
                              onClick={() => setSelectedConversation(conv)}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-sky-500 bg-sky-50/70 shadow-xs"
                                  : "border-slate-100 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                  {conv.topic}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    conv.status === "Admin Replied"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : conv.status === "Resolved"
                                        ? "bg-slate-100 text-slate-600"
                                        : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {conv.status}
                                </span>
                              </div>
                              <h4 className="font-semibold text-sm text-slate-900 mt-1 line-clamp-1">
                                {conv.subject}
                              </h4>
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {conv.messages[conv.messages.length - 1]?.text}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-1 text-right">{conv.updated_at}</p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Message Stream & Reply Box */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs lg:col-span-2 flex flex-col justify-between min-h-[500px]">
                    {selectedConversation ? (
                      <div className="flex flex-col h-full justify-between space-y-4">
                        {/* Conversation Header */}
                        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-base text-slate-900">{selectedConversation.subject}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Topic: {selectedConversation.topic}</p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              selectedConversation.status === "Admin Replied"
                                ? "bg-emerald-100 text-emerald-800"
                                : selectedConversation.status === "Resolved"
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {selectedConversation.status}
                          </span>
                        </div>

                        {/* Message History Bubble Stream */}
                        <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[380px] p-2">
                          {selectedConversation.messages.map((m) => {
                            const isMe = m.sender === "customer";
                            return (
                              <div
                                key={m.id}
                                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                              >
                                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                                  <span className="font-semibold text-slate-700">{m.senderName}</span>
                                  <span>·</span>
                                  <span>{m.timestamp}</span>
                                </div>
                                <div
                                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                                    isMe
                                      ? "bg-sky-600 text-white rounded-tr-xs"
                                      : "bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/60"
                                  }`}
                                >
                                  {m.text}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Reply Input Box */}
                        <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
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
                            className="bg-slate-50 border-slate-200 flex-1"
                          />
                          <Button
                            onClick={handleSendReply}
                            className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5"
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
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Favorite Products</h1>
                  <p className="text-sm text-slate-500 mt-1">Quick access to fiberglass items you order regularly</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {favoriteProducts.map((p) => (
                    <div
                      key={p.product_id}
                      className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                    >
                      <div>
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-36 w-full rounded-xl object-cover mb-3"
                          />
                        ) : (
                          <div className="h-36 w-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                            <Package className="h-8 w-8" />
                          </div>
                        )}
                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{p.category}</p>
                        <p className="font-bold text-sky-600 text-base mt-2">{etb(p.price)}</p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          addToCart(p.product_id, 1);
                          toast.success(`Added ${p.name} to cart`);
                        }}
                        className="mt-4 w-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold gap-1.5"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        Add to Cart
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 6. PROFILE TAB                                          */}
            {/* ======================================================== */}
            {activeTab === "profile" && (
              <div className="space-y-6 max-w-2xl animate-in fade-in-50 duration-200">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profile & Security</h1>
                  <p className="text-sm text-slate-500 mt-1">Manage your personal information and password</p>
                </div>

                {/* Profile Details Form */}
                <form
                  onSubmit={handleProfileSubmit}
                  className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4"
                >
                  <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-3">
                    Personal Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">Full Name</Label>
                      <Input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">Email Address (Read-only)</Label>
                      <Input value={user.email} disabled className="mt-1 bg-slate-50 text-slate-500" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">Phone Number</Label>
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
                      className="bg-sky-600 hover:bg-sky-700 text-white font-medium"
                    >
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </Button>
                  </div>
                </form>

                {/* Password Change Form */}
                <form
                  onSubmit={handlePasswordSubmit}
                  className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4"
                >
                  <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-3">
                    Change Password
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">Current Password</Label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">New Password</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-600">Confirm New Password</Label>
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Delivery Addresses</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage delivery locations and site drop-offs across Ethiopia</p>
                  </div>
                  <Button
                    onClick={() => setNewAddressDialogOpen(true)}
                    className="bg-sky-600 hover:bg-sky-700 text-white gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Address
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-md transition-shadow relative"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-sky-600" />
                          <h3 className="font-bold text-slate-900 text-sm">{addr.label}</h3>
                        </div>
                        {addr.isDefault && (
                          <span className="bg-sky-50 text-sky-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-sky-200">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-900">{addr.recipient}</p>
                        <p>{addr.phone}</p>
                        <p>{addr.subcity}, {addr.city}</p>
                        <p className="text-slate-500 italic mt-1">{addr.details}</p>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                        {!addr.isDefault ? (
                          <button
                            onClick={() => {
                              setAddresses(
                                addresses.map((a) => ({
                                  ...a,
                                  isDefault: a.id === addr.id,
                                })),
                              );
                              toast.success("Default address updated");
                            }}
                            className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                          >
                            Set as default
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Primary delivery address</span>
                        )}

                        <button
                          onClick={() => {
                            setAddresses(addresses.filter((a) => a.id !== addr.id));
                            toast.success("Address removed");
                          }}
                          className="text-xs text-rose-500 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
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
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account Notifications</h1>
                    <p className="text-sm text-slate-500 mt-1">Updates on your equipment orders and quotes</p>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNotifications(notifications.map((n) => ({ ...n, read: true })));
                        toast.success("All marked as read");
                      }}
                      className="text-xs text-sky-600 border-sky-200"
                    >
                      Mark all as read
                    </Button>
                  )}
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "p-4 flex items-start gap-3.5 transition-colors",
                        !n.read ? "bg-sky-50/40" : "hover:bg-slate-50/60",
                      )}
                    >
                      <div className="h-9 w-9 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0 mt-0.5">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                          <span className="text-[11px] text-slate-400">{n.date}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
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
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Support</h1>
                  <p className="text-sm text-slate-500 mt-1">Direct contact with Polar Fiber engineering and sales engineers</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
                      <Phone className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-slate-900">Direct Sales & Helpdesk</h3>
                    <p className="text-xs text-slate-500">Available Monday - Saturday, 8:00 AM - 6:00 PM</p>
                    <p className="font-semibold text-sm text-sky-600 pt-1">+251 911 234 567</p>
                  </div>

                  <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-slate-900">Engineering Support Email</h3>
                    <p className="text-xs text-slate-500">Send technical drawings and specs</p>
                    <p className="font-semibold text-sm text-emerald-600 pt-1">support@polarfiber.et</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-3">
                    Frequently Asked Technical Questions
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="p-3.5 rounded-xl bg-slate-50">
                      <p className="font-semibold text-slate-900 text-xs">How do I maintain my fiberglass water tanker?</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Polar Fiber water tankers feature food-grade gelcoat linings that resist algae and bacterial growth. Simply flush with clean potable water once every six months.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50">
                      <p className="font-semibold text-slate-900 text-xs">What is the warranty period for roofing sheets?</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Our reinforced fiberglass corrugated sheets come with a 15-year weather and UV resistance manufacturer warranty.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleAddAddress}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-lg text-slate-900">Add New Delivery Location</h3>
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
                <Label className="text-xs">Sub-city / Area</Label>
                <Input
                  value={newAddressForm.subcity}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, subcity: e.target.value })}
                  placeholder="e.g. Bole Sub-City, Woreda 04"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Detailed Location / Landmark</Label>
                <Input
                  value={newAddressForm.details}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, details: e.target.value })}
                  placeholder="e.g. Next to Edna Mall, Block B"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setNewAddressDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white">
                Save Address
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* New Message Dialog */}
      {newMessageDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={handleCreateNewConversation}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-lg text-slate-900">New Message to Polar Fiber</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600">Department / Topic</Label>
                <select
                  value={newMessageForm.topic}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, topic: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm mt-1"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Custom Engineering">Custom Engineering</option>
                  <option value="Order Status Inquiry">Order Status Inquiry</option>
                  <option value="Delivery Support">Delivery Support</option>
                  <option value="Warranty & Maintenance">Warranty & Maintenance</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">Subject</Label>
                <Input
                  value={newMessageForm.subject}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, subject: e.target.value })}
                  placeholder="e.g. Inquiring on tank flange connection specs"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600">Message</Label>
                <textarea
                  rows={4}
                  value={newMessageForm.text}
                  onChange={(e) => setNewMessageForm({ ...newMessageForm, text: e.target.value })}
                  placeholder="Write your question or request..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-sky-500 mt-1"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setNewMessageDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5">
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
