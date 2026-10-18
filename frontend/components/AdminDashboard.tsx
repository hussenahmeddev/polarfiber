import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Package,
  ShoppingCart,
  FileText,
  Users,
  MessageSquare,
  BarChart2,
  Settings,
  DollarSign,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Download,
  Plus,
  Pencil,
  Trash2,
  Mail,
  Search,
  Filter,
  RefreshCw,
  Phone,
  MapPin,
  ShieldCheck,
  Send,
  Save,
  UserPlus,
  History,
  Archive,
  ChevronUp,
  ChevronDown,
  CreditCard,
  RotateCcw,
  Printer,
  Lock,
  Eye,
} from "lucide-react";

import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { AdminSidebarLayout } from "@/frontend/components/AdminSidebarLayout";
import { StatusBadge } from "@/frontend/components/StatusBadge";
import { OrderDrawer } from "@/frontend/components/OrderDrawer";
import { ProductDialog, ProductImage } from "@/frontend/components/ProductDialog";
import { ConfirmDialog } from "@/frontend/components/ConfirmDialog";
import { EmptyState } from "@/frontend/components/EmptyState";
import { NotAuthorized } from "@/frontend/components/NotAuthorized";
import { MustChangePasswordModal } from "@/frontend/components/MustChangePasswordModal";
import { Can } from "@/frontend/components/Can";
import { usePermissions } from "@/frontend/hooks/usePermissions";
import {
  CATEGORIES,
  ORDER_STATUSES,
  QUOTE_STATUSES,
  etb,
  type Category,
  type Product,
  type Order,
  type Quote,
  type OrderStatus,
  type QuoteStatus,
  type SupportTicket as DBSupportTicket,
} from "@/shared/data";
import { useStore, productsKey } from "@/frontend/store";
import {
  addOrderInternalNote,
  approveQuote,
  approveStockAdjustment,
  archiveContactMessage,
  assignSupportTicket,
  blockCustomer,
  changePassword,
  completeOrderDelivery,
  convertQuoteToOrder,
  createSupportTicket,
  createTeamMember,
  deactivateTeamMember,
  deleteCategory,
  deleteContactMessage,
  deleteProduct,
  editTeamMember,
  expireQuotes,
  exportCustomersCSV,
  exportReportCSV,
  getAdminData,
  getAdminOverview,
  getAuditLogs,
  getCategories,
  getCompanySettings,
  getContactMessages,
  getContactMessageReplies,
  getCustomers,
  getCustomerDetail,
  getOrdersPage,
  getOrderStatusHistory,
  getProducts,
  getSalesReport,
  getStockAdjustments,
  getStockMovements,
  getSupportTickets,
  getSupportTicketReplies,
  getQuoteItems,
  logExportAction,
  markMessageRead,
  markOrderPaid,
  recordOrderDispatch,
  rejectStockAdjustment,
  reorderCategories,
  replyContactMessage,
  replySupportTicket,
  saveCategory,
  saveProduct,
  saveProductImages,
  saveQuoteItems,
  setOrderStatus,
  setQuoteStatus,
  softDeleteProduct,
  updateAdminProfile,
  updateCompanySetting,
  updateProductStock,
  updateSupportTicketStatus,
  updateUserRole,
} from "@/backend/api.functions";

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const PIE_COLORS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#f43f5e"];

// ─── CategoryForm ─────────────────────────────────────────────────────────────
interface CategoryRow {
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  parent_name: string | null;
  sort_order: number;
  is_active: number;
  product_count: number;
  created_at: string;
}

interface CategoryFormProps {
  initial: CategoryRow | null;
  categories: CategoryRow[];
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  saving: boolean;
}

function CategoryForm({ initial, categories, onClose, onSave, saving }: CategoryFormProps) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [slug, setSlug] = React.useState(initial?.slug ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [parentId, setParentId] = React.useState<number | null>(initial?.parent_id ?? null);
  const [sortOrder, setSortOrder] = React.useState(initial?.sort_order ?? 0);
  const [isActive, setIsActive] = React.useState(initial?.is_active !== 0);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!initial) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      category_id: initial?.category_id ?? 0,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      parent_id: parentId || null,
      sort_order: sortOrder,
      is_active: isActive,
    });
  };

  // Cannot set a category as its own parent or a child as parent
  const parentOptions = categories.filter((c) => c.category_id !== initial?.category_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs font-semibold">Category Name *</Label>
        <Input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Roof Accessories"
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label className="text-xs font-semibold">Slug *</Label>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. roof-accessories"
          className="mt-1 font-mono text-xs"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Lowercase letters, numbers, hyphens only.
        </p>
      </div>
      <div>
        <Label className="text-xs font-semibold">Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Parent Category</Label>
          <select
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">None (top-level)</option>
            {parentOptions.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs font-semibold">Sort Order</Label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            min={0}
            className="mt-1"
          />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="is-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="is-active" className="text-xs font-semibold">
            Active (visible in storefront filters)
          </Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim() || !slug.trim()}>
          {saving ? "Saving…" : initial ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── EditTeamMemberForm ───────────────────────────────────────────────────────
interface EditTeamMemberFormProps {
  member: any;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}
function EditTeamMemberForm({ member, onClose, onSave }: EditTeamMemberFormProps) {
  const [name, setName] = React.useState(member.name ?? "");
  const [email, setEmail] = React.useState(member.email ?? "");
  const [phone, setPhone] = React.useState(member.phone ?? "");
  const [role, setRole] = React.useState<"staff" | "admin">(
    member.role === "admin" ? "admin" : "staff",
  );
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        user_id: member.user_id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Full Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Email *</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Role *</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "staff" | "admin")}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim() || !email.trim()}>
          {saving ? "Saving…" : "Update Member"}
        </Button>
      </div>
    </form>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { user, refreshUser } = useStore();
  const { hasPermission } = usePermissions();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = React.useState("overview");

  // Orders State
  const [ordersPage, setOrdersPage] = React.useState(1);
  const [ordersPageSize, setOrdersPageSize] = React.useState(10);
  const [ordersSearch, setOrdersSearch] = React.useState("");
  const [ordersStatus, setOrdersStatus] = React.useState("all");
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = React.useState(false);
  const [statusUpdating, setStatusUpdating] = React.useState(false);

  // Products State
  const [productSearch, setProductSearch] = React.useState("");
  const [productCategoryFilter, setProductCategoryFilter] = React.useState("all");
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = React.useState(false);
  const [savingProduct, setSavingProduct] = React.useState(false);

  // Quotes State
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null);
  const [quoteFilter, setQuoteFilter] = React.useState("all");

  // Customers State
  const [customerSearch, setCustomerSearch] = React.useState("");

  // Inventory State
  const [inventorySearch, setInventorySearch] = React.useState("");
  const [stockUpdatingId, setStockUpdatingId] = React.useState<number | null>(null);
  const [stockReasonPrompt, setStockReasonPrompt] = React.useState<{
    product: Product;
    delta: number;
  } | null>(null);
  const [stockReasonText, setStockReasonText] = React.useState("");
  const [inventorySubTab, setInventorySubTab] = React.useState<"stock" | "approvals">("stock");

  // Messages State
  const [selectedMessage, setSelectedMessage] = React.useState<any | null>(null);
  const [messageSearch, setMessageSearch] = React.useState("");
  const [replyText, setReplyText] = React.useState("");
  const [messageReplyInternal, setMessageReplyInternal] = React.useState(false);

  // Support Tickets State
  const [ticketSearch, setTicketSearch] = React.useState("");
  const [ticketPriorityFilter, setTicketPriorityFilter] = React.useState("all");
  const [newTicketDialogOpen, setNewTicketDialogOpen] = React.useState(false);
  const [newTicketData, setNewTicketData] = React.useState<{
    customer: string;
    customer_email: string;
    subject: string;
    category:
      | "Technical Specs"
      | "Installation"
      | "Warranty"
      | "Custom Fabrication"
      | "General"
      | "Billing";
    priority: "Urgent" | "High" | "Normal" | "Low";
    message: string;
  }>({
    customer: "",
    customer_email: "",
    subject: "",
    category: "Technical Specs",
    priority: "Normal",
    message: "",
  });

  // Audit Logs State
  const [logCategoryFilter, setLogCategoryFilter] = React.useState("all");

  // Settings State
  const [settingsData, setSettingsData] = React.useState({
    companyName: "Polar Fiber Manufacturing PLC",
    supportEmail: "info@polarfiber.et",
    phone: "+251 911 234 567",
    address: "Bole Sub-City, Kebele 03, Addis Ababa, Ethiopia",
    currency: "ETB",
    vatRate: 15,
    emailOrderNotify: true,
    lowStockThreshold: 5,
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "",
  });
  const [settingsSubTab, setSettingsSubTab] = React.useState<"company" | "team" | "profile">(
    user?.role === "staff" ? "profile" : "company",
  );
  const [companyForm, setCompanyForm] = React.useState<Record<string, string>>({});
  const [profileForm, setProfileForm] = React.useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [newTeamMember, setNewTeamMember] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "staff" as "staff" | "admin",
    temporaryPassword: "",
  });
  const [creatingMember, setCreatingMember] = React.useState(false);
  const [editingTeamMember, setEditingTeamMember] = React.useState<any | null>(null);
  const [teamMemberDialogOpen, setTeamMemberDialogOpen] = React.useState(false);

  // Categories
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<CategoryRow | null>(null);
  const [deletingCategory, setDeletingCategory] = React.useState<CategoryRow | null>(null);
  const [confirmCategoryDeleteOpen, setConfirmCategoryDeleteOpen] = React.useState(false);
  const [savingCategory, setSavingCategory] = React.useState(false);

  // Inventory — movement history
  const [inventoryMovementProduct, setInventoryMovementProduct] = React.useState<Product | null>(
    null,
  );
  const [inventoryMovementPage] = React.useState(1);

  // Orders — mark paid
  const [markPaidOrderId, setMarkPaidOrderId] = React.useState<number | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = React.useState("bank_transfer");
  const [markingPaid, setMarkingPaid] = React.useState(false);

  // Quotes — respond panel
  const [quoteAmount, setQuoteAmount] = React.useState("");
  const [quoteValidUntil, setQuoteValidUntil] = React.useState("");
  const [quoteReplyMsg, setQuoteReplyMsg] = React.useState("");
  const [quoteSending, setQuoteSending] = React.useState(false);
  const [quoteItems, setQuoteItems] = React.useState<any[]>([]);
  const [quoteItemEditing, setQuoteItemEditing] = React.useState<{
    id?: number;
    product_id: number | null;
    product_name: string;
    quantity: string;
    unit_price: string;
  } | null>(null);
  const [savingQuoteItems, setSavingQuoteItems] = React.useState(false);

  // Customer detail
  const [selectedCustomerTarget, setSelectedCustomerTarget] = React.useState<{
    user_id?: number | null;
    email?: string;
  } | null>(null);
  const [customerDetailOpen, setCustomerDetailOpen] = React.useState(false);

  // Support — selected ticket + reply
  const [selectedTicket, setSelectedTicket] = React.useState<any | null>(null);
  const [ticketReplyInternal, setTicketReplyInternal] = React.useState(false);

  // Audit logs — filters
  const [auditFilters, setAuditFilters] = React.useState({
    startDate: "",
    endDate: "",
    actor: "",
    action: "",
    entityType: "",
    page: 1,
    limit: 50,
  });
  const [auditChangesId, setAuditChangesId] = React.useState<number | null>(null);

  // Reports — date range
  const [reportStart, setReportStart] = React.useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [reportEnd, setReportEnd] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [reportData, setReportData] = React.useState<any | null>(null);
  const [reportLoading, setReportLoading] = React.useState(false);

  // Server functions
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchOrders = useServerFn(getOrdersPage);
  const fetchCatalog = useServerFn(getProducts);
  const fetchQuotesList = useServerFn(getAdminData);
  const fetchCustomerList = useServerFn(getCustomers);
  const mutateSaveProduct = useServerFn(saveProduct);
  const mutateDeleteProduct = useServerFn(deleteProduct);
  const mutateOrderStatus = useServerFn(setOrderStatus);
  const mutateQuoteStatus = useServerFn(setQuoteStatus);
  const mutateStock = useServerFn(updateProductStock);
  const mutateReplyMessage = useServerFn(replyContactMessage);
  const mutateReplyTicket = useServerFn(replySupportTicket);
  const fetchAuditLogs = useServerFn(getAuditLogs);
  const mutateUserRole = useServerFn(updateUserRole);
  const mutateAddOrderNote = useServerFn(addOrderInternalNote);
  const mutateDispatchOrder = useServerFn(recordOrderDispatch);
  const mutateCompleteDelivery = useServerFn(completeOrderDelivery);
  const fetchOrderHistory = useServerFn(getOrderStatusHistory);
  const fetchStockAdjustments = useServerFn(getStockAdjustments);
  const mutateApproveStockAdj = useServerFn(approveStockAdjustment);
  const mutateRejectStockAdj = useServerFn(rejectStockAdjustment);
  const fetchContactMessages = useServerFn(getContactMessages);
  const mutateArchiveMessage = useServerFn(archiveContactMessage);
  const mutateDeleteMessage = useServerFn(deleteContactMessage);
  const fetchSupportTickets = useServerFn(getSupportTickets);
  const mutateAssignTicket = useServerFn(assignSupportTicket);
  const mutateTicketStatus = useServerFn(updateSupportTicketStatus);
  const mutateApproveQuote = useServerFn(approveQuote);
  const fetchCompanySettings = useServerFn(getCompanySettings);
  const mutateCompanySetting = useServerFn(updateCompanySetting);
  const mutateCreateTeamMember = useServerFn(createTeamMember);
  const mutateLogExportAction = useServerFn(logExportAction);

  // New server functions
  const fetchCategories = useServerFn(getCategories);
  const mutateSaveCategory = useServerFn(saveCategory);
  const mutateDeleteCategory = useServerFn(deleteCategory);
  const mutateReorderCategories = useServerFn(reorderCategories);
  const fetchStockMovements = useServerFn(getStockMovements);
  const mutateExpireQuotes = useServerFn(expireQuotes);
  const fetchQuoteItems = useServerFn(getQuoteItems);
  const mutateSaveQuoteItems = useServerFn(saveQuoteItems);
  const mutateMarkOrderPaid = useServerFn(markOrderPaid);
  const mutateBlockCustomer = useServerFn(blockCustomer);
  const fetchCustomerDetail = useServerFn(getCustomerDetail);
  const fetchExportCustomersCSV = useServerFn(exportCustomersCSV);
  const mutateMarkMessageRead = useServerFn(markMessageRead);
  const fetchContactMessageReplies = useServerFn(getContactMessageReplies);
  const fetchSupportTicketReplies = useServerFn(getSupportTicketReplies);
  const mutateCreateSupportTicket = useServerFn(createSupportTicket);
  const fetchSalesReport = useServerFn(getSalesReport);
  const fetchExportReportCSV = useServerFn(exportReportCSV);
  const mutateUpdateAdminProfile = useServerFn(updateAdminProfile);
  const mutateDeactivateTeamMember = useServerFn(deactivateTeamMember);
  const mutateEditTeamMember = useServerFn(editTeamMember);
  const mutateChangePassword = useServerFn(changePassword);
  const mutateConvertQuoteToOrder = useServerFn(convertQuoteToOrder);
  const mutateSoftDeleteProduct = useServerFn(softDeleteProduct);
  const mutateSaveProductImages = useServerFn(saveProductImages);

  const isStaff = user?.role === "staff";
  const isStaffOrAdmin = user?.role === "admin" || isStaff;
  const canViewRevenue = user?.role === "admin" || hasPermission("revenue.view");

  // Queries
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetchOverview(),
    enabled: isStaffOrAdmin,
  });

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", ordersPage, ordersSearch, ordersStatus],
    queryFn: () =>
      fetchOrders({
        data: {
          page: ordersPage,
          pageSize: ordersPageSize,
          search: ordersSearch,
          status: ordersStatus,
        },
      }),
    enabled: isStaffOrAdmin,
  });

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => fetchCatalog(),
    enabled: isStaffOrAdmin,
  });

  const adminDataQuery = useQuery({
    queryKey: ["admin", "data"],
    queryFn: () => fetchQuotesList(),
    enabled: isStaffOrAdmin,
  });

  const customersQuery = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => fetchCustomerList(),
    enabled: isStaffOrAdmin,
  });

  const stockAdjustmentsQuery = useQuery({
    queryKey: ["admin", "stock-adjustments"],
    queryFn: () => fetchStockAdjustments(),
    enabled: isStaffOrAdmin && activeTab === "inventory",
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => fetchCategories(),
    enabled: isStaffOrAdmin,
  });

  const contactMessagesQuery = useQuery({
    queryKey: ["admin", "contact-messages"],
    queryFn: () => fetchContactMessages(),
    enabled: isStaffOrAdmin,
    staleTime: 60_000,
  });

  const contactMessageRepliesQuery = useQuery({
    queryKey: ["admin", "message-replies", selectedMessage?.id],
    queryFn: () =>
      fetchContactMessageReplies({ data: { message_id: selectedMessage!.id } } as any),
    enabled: isStaffOrAdmin && !!selectedMessage?.id,
  });

  const supportTicketsQuery = useQuery({
    queryKey: ["admin", "support-tickets"],
    queryFn: () => fetchSupportTickets(),
    enabled: isStaffOrAdmin && activeTab === "support",
  });

  const ticketRepliesQuery = useQuery({
    queryKey: ["admin", "ticket-replies", selectedTicket?.id],
    queryFn: () =>
      fetchSupportTicketReplies({ data: { ticket_id: Number(selectedTicket?.id) } } as any),
    enabled: !!selectedTicket?.id,
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin", "audit-logs-v2", auditFilters],
    queryFn: () =>
      fetchAuditLogs({
        data: {
          ...auditFilters,
          startDate: auditFilters.startDate || undefined,
          endDate: auditFilters.endDate || undefined,
          actor: auditFilters.actor || undefined,
          action: auditFilters.action || undefined,
          entityType: auditFilters.entityType || undefined,
        },
      } as any),
    enabled: isStaffOrAdmin && activeTab === "audit-logs",
  });

  const companySettingsQuery = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => fetchCompanySettings(),
    enabled: isStaffOrAdmin && activeTab === "settings",
  });

  const customerDetailQuery = useQuery({
    queryKey: [
      "customer-detail",
      selectedCustomerTarget?.user_id,
      selectedCustomerTarget?.email,
    ],
    queryFn: () =>
      fetchCustomerDetail({
        data: {
          user_id: selectedCustomerTarget?.user_id ?? null,
          email: selectedCustomerTarget?.email ?? null,
        },
      } as any),
    enabled:
      !!selectedCustomerTarget &&
      (selectedCustomerTarget.user_id != null || !!selectedCustomerTarget.email),
  });

  const stockMovementsQuery = useQuery({
    queryKey: [
      "admin",
      "stock-movements",
      inventoryMovementProduct?.product_id,
      inventoryMovementPage,
    ],
    queryFn: () =>
      fetchStockMovements({
        data: {
          product_id: inventoryMovementProduct!.product_id,
          page: inventoryMovementPage,
          limit: 50,
        },
      } as any),
    enabled: !!inventoryMovementProduct,
  });

  // Sync company settings into form state
  React.useEffect(() => {
    if (companySettingsQuery.data && Array.isArray(companySettingsQuery.data)) {
      const map: Record<string, string> = {};
      (companySettingsQuery.data as any[]).forEach((s: any) => {
        map[s.setting_key] = s.setting_value;
      });
      setCompanyForm(map);
    }
  }, [companySettingsQuery.data]);

  // Load line items for the selected quote
  React.useEffect(() => {
    if (!selectedQuote) {
      setQuoteItems([]);
      return;
    }
    (async () => {
      try {
        const res = await fetchQuoteItems({ data: { quote_id: selectedQuote.quote_id } });
        setQuoteItems(res ?? []);
      } catch {
        setQuoteItems([]);
      }
    })();
  }, [selectedQuote]);

  // Non-staff/admin guard
  if (!user || !isStaffOrAdmin) {
    return (
      <NotAuthorized
        userRole={user?.role}
        message="You must be logged in with a staff or administrator account to access the management portal."
      />
    );
  }

  // First-login mandatory password change
  if (user.must_change_password) {
    return <MustChangePasswordModal user={user} onComplete={() => refreshUser()} />;
  }

  // Calculations & KPIs
  const overview = overviewQuery.data;
  const kpis = overview?.kpis;
  const attention = overview?.attention;
  const allProducts = productsQuery.data ?? [];
  const allCustomers = customersQuery.data ?? [];
  const allOrders = ordersQuery.data?.orders ?? [];
  const allQuotes = adminDataQuery.data?.quotes ?? [];

  const dbMessages = (contactMessagesQuery.data ?? []) as any[];

  // All KPIs come directly from backend SQL aggregations (getAdminOverview) with fallbacks to loaded collections
  const totalOrdersCount = kpis?.totalOrders ?? (ordersQuery.data?.total || allOrders.length);
  const pendingOrderCount =
    kpis?.pendingOrders ?? allOrders.filter((o: any) => o.status === "Pending").length;
  const completedOrdersCount =
    kpis?.completedOrders ?? allOrders.filter((o: any) => o.status === "Delivered").length;
  const newQuotesCount =
    kpis?.newQuotes ?? allQuotes.filter((q: any) => q.status === "New").length;
  const lowStockCount =
    kpis?.lowStockCount ?? allProducts.filter((p: any) => (p.stock ?? 0) <= 5).length;
  const unreadMessagesCount =
    kpis?.unreadMessages ?? dbMessages.filter((m: any) => !m.is_read).length;
  const customerCount =
    kpis?.customers ?? allCustomers.length;
  const deliveredRevenue = kpis?.totalRevenue ?? 0;

  // Recent Orders & Quotes
  const recentOrdersList = (
    attention?.pendingOrders?.length ? attention.pendingOrders : allOrders
  ).slice(0, 5);
  const recentQuotesList = (attention?.newQuotes.length ? attention.newQuotes : allQuotes).slice(
    0,
    5,
  );

  // Handlers
  const handleOrderStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    setStatusUpdating(true);
    try {
      await mutateOrderStatus({ data: { id: orderId, status: newStatus } });
      toast.success(`Order #${orderId} status set to ${newStatus}`);
      if (selectedOrder && selectedOrder.order_id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Failed to update order status";
      if (msg.includes("Invalid order status transition from Pending to In Production")) {
        msg =
          "Order must first be Confirmed before entering In Production (Pending → Confirmed → In Production).";
      }
      toast.error(msg);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDispatchOrder = async (orderId: number) => {
    setStatusUpdating(true);
    try {
      await mutateDispatchOrder({ data: { order_id: orderId } });
      toast.success(`Order #${orderId} dispatched`);
      if (selectedOrder && selectedOrder.order_id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: "Out for Delivery" });
      }
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: ["order-delivery", orderId] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dispatch order");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCompleteDelivery = async (orderId: number) => {
    setStatusUpdating(true);
    try {
      await mutateCompleteDelivery({ data: { order_id: orderId } });
      toast.success(`Order #${orderId} marked delivered`);
      if (selectedOrder && selectedOrder.order_id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: "Delivered" });
      }
      await qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      await qc.invalidateQueries({ queryKey: ["order-delivery", orderId] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete delivery");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleQuoteStatusChange = async (quoteId: number, newStatus: QuoteStatus) => {
    try {
      await mutateQuoteStatus({ data: { id: quoteId, status: newStatus } });
      toast.success(`Quote #${quoteId} status set to ${newStatus}`);
      if (selectedQuote && selectedQuote.quote_id === quoteId) {
        setSelectedQuote({ ...selectedQuote, status: newStatus });
      }
      await qc.invalidateQueries({ queryKey: ["admin", "data"] });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update quote status");
    }
  };

  const handleProductSave = async (prod: Product, extraImages: ProductImage[]) => {
    setSavingProduct(true);
    try {
      const result = await mutateSaveProduct({ data: prod });
      const productId = prod.product_id || (result as any)?.product_id;
      // Save extra images if any
      if (productId && extraImages.length > 0) {
        await mutateSaveProductImages({ data: { product_id: productId, images: extraImages } });
      }
      toast.success(
        prod.product_id ? "Product updated successfully" : "Product created successfully",
      );
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleProductDelete = async () => {
    if (!deletingProduct) return;
    try {
      await mutateSoftDeleteProduct({ data: { product_id: deletingProduct.product_id } });
      toast.success(`"${deletingProduct.name}" archived (soft-deleted)`);
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
    }
  };

  const handleQuickStockAdjust = (product: Product, delta: number) => {
    setStockReasonPrompt({ product, delta });
    setStockReasonText("");
  };

  const handleConfirmStockAdjust = async () => {
    if (!stockReasonPrompt) return;
    if (!stockReasonText.trim()) {
      toast.error("A mandatory reason must be provided for stock adjustments.");
      return;
    }
    const { product, delta } = stockReasonPrompt;
    setStockUpdatingId(product.product_id);
    try {
      const res = await mutateStock({
        data: {
          id: product.product_id,
          delta: delta,
          reason: stockReasonText.trim(),
        },
      });
      if ((res as any).pendingApproval) {
        toast.info((res as any).message);
      } else {
        toast.success(`Stock for ${product.name} updated (${delta > 0 ? `+${delta}` : delta})`);
      }
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: productsKey });
      await qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      await qc.invalidateQueries({ queryKey: ["admin", "stock-adjustments"] });
      setStockReasonPrompt(null);
      setStockReasonText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setStockUpdatingId(null);
    }
  };

  // CSV Export for orders
  const exportOrdersCSV = () => {
    const orders = ordersQuery.data?.orders ?? [];
    if (!orders.length) {
      toast.error("No orders available to export.");
      return;
    }
    const headers = [
      "Order ID",
      "Customer",
      "Date",
      "Status",
      "Address",
      "Items Summary",
      "Total (ETB)",
    ];
    const rows = orders.map((o) => [
      o.order_id,
      `"${(o.customer ?? "Guest").replace(/"/g, '""')}"`,
      o.created_at,
      o.status,
      `"${o.address.replace(/"/g, '""')}"`,
      `"${o.items
        .map((i) => `${i.quantity}x ${i.product_name}`)
        .join("; ")
        .replace(/"/g, '""')}"`,
      o.total,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsv(csvContent, `polarfiber_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    mutateLogExportAction({ data: { count: orders.length } }).catch(() => {});
    toast.success("Orders exported to CSV");
  };

  const printInvoice = (order: Order) => {
    const itemsHtml = order.items
      .map(
        (i) => `
      <tr>
        <td>${i.product_name}</td>
        <td style="text-align:center">${i.quantity}</td>
        <td style="text-align:right">${etb(i.unit_price)}</td>
        <td style="text-align:right">${etb(i.unit_price * i.quantity)}</td>
      </tr>
    `,
      )
      .join("");

    const invoiceHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice #${order.order_id}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
        .logo { font-size: 24px; font-weight: bold; color: #0ea5e9; }
        .invoice-title { font-size: 20px; font-weight: bold; text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #e2e8f0; }
        td { padding: 8px; border: 1px solid #e2e8f0; }
        .total-row { font-weight: bold; background: #f8fafc; }
        .footer { margin-top: 40px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        .print-only { display: block; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div style="max-width: 800px; margin: 0 auto; padding: 32px;">
        <div class="header">
          <div class="logo">Polar Fiber</div>
          <div class="invoice-title">Invoice #${order.order_id}</div>
        </div>
        <div style="margin-bottom: 32px;">
          <div><strong>Customer:</strong> ${order.customer ?? "Guest"}</div>
          <div><strong>Date:</strong> ${order.created_at}</div>
          <div><strong>Status:</strong> ${order.status}</div>
          <div><strong>Payment:</strong> ${order.payment_method ?? "—"} (${
        order.is_paid ? "Paid" : "Unpaid"
      })</div>
          <div><strong>Address:</strong> ${order.address}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:right">Unit Price</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3" style="text-align:right">Order Total</td>
              <td style="text-align:right">${etb(order.total)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">
          Polar Fiber Manufacturing PLC · Addis Ababa, Ethiopia<br />
          Thank you for your business!
        </div>
      </div>
      <script>window.print();</script>
    </body>
    </html>
    `;

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Unable to open print window. Please allow popups.");
      return;
    }
    win.document.write(invoiceHtml);
    win.document.close();
  };

  // Filtering products
  const filteredProducts = allProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCategory = productCategoryFilter === "all" || p.category === productCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtering inventory
  const filteredInventory = allProducts.filter((p) => {
    return (
      p.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      p.category.toLowerCase().includes(inventorySearch.toLowerCase())
    );
  });

  // Total inventory metrics
  const totalStockUnits = allProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalStockValue = allProducts.reduce((sum, p) => sum + p.stock * p.price, 0);
  const outOfStockCount = allProducts.filter((p) => p.stock === 0).length;

  // Filtering quotes
  const filteredQuotes = allQuotes.filter((q) => {
    return quoteFilter === "all" || q.status === quoteFilter;
  });

  // Filtering customers
  const filteredCustomers = allCustomers.filter((c: any) => {
    const query = customerSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      (c.name || "").toLowerCase().includes(query) ||
      (c.email || "").toLowerCase().includes(query) ||
      (c.phone || "").toLowerCase().includes(query) ||
      (c.role || "").toLowerCase().includes(query)
    );
  });

  // Filtering messages
  const filteredMessages = dbMessages.filter((m: any) => {
    return (
      (m.name ?? "").toLowerCase().includes(messageSearch.toLowerCase()) ||
      (m.subject ?? "").toLowerCase().includes(messageSearch.toLowerCase()) ||
      (m.message ?? "").toLowerCase().includes(messageSearch.toLowerCase())
    );
  });

  // Filtering tickets
  const dbTickets = (supportTicketsQuery.data ?? []) as any[];
  const filteredTickets = dbTickets.filter((t: any) => {
    const matchesQuery =
      (t.customer_name ?? t.customer ?? "").toLowerCase().includes(ticketSearch.toLowerCase()) ||
      (t.subject ?? "").toLowerCase().includes(ticketSearch.toLowerCase()) ||
      String(t.id ?? "")
        .toLowerCase()
        .includes(ticketSearch.toLowerCase());
    const matchesPriority = ticketPriorityFilter === "all" || t.priority === ticketPriorityFilter;
    return matchesQuery && matchesPriority;
  });

  // Audit logs from DB
  const auditLogs = ((auditLogsQuery.data as any)?.logs ?? []) as any[];
  const auditTotal = ((auditLogsQuery.data as any)?.total ?? 0) as number;

  // Filter logs by the UI category selector (maps to entity_type prefix)
  const filteredLogs =
    logCategoryFilter === "all"
      ? auditLogs
      : auditLogs.filter((l: any) => {
          const et = (l.entity_type ?? "").toLowerCase();
          return (
            et.includes(logCategoryFilter.toLowerCase()) ||
            (l.action ?? "").toLowerCase().includes(logCategoryFilter.toLowerCase())
          );
        });

  // Sidebar badges — orders shows pending count, not total
  const sidebarBadges = {
    orders: pendingOrderCount > 0 ? String(pendingOrderCount) : undefined,
    quotes: kpis?.newQuotes ? String(kpis.newQuotes) : undefined,
    inventory: lowStockCount > 0 ? `${lowStockCount} low` : undefined,
    messages: unreadMessagesCount > 0 ? String(unreadMessagesCount) : undefined,
  };

  return (
    <AdminSidebarLayout activeTab={activeTab} onTabChange={setActiveTab} badges={sidebarBadges}>
      {/* ======================================================== */}
      {/* 1. OVERVIEW TAB (Exact match to requested visual design)  */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-7 animate-in fade-in-50 duration-200">
          {/* Header Title & Subtitle */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isStaff ? "Staff Overview" : "Dashboard Overview"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isStaff ? "Live operational metrics and active queues" : "Monitor your business at a glance"}
            </p>
          </div>

          {/* Stat Cards Grid: 8 cards for admin, 7 cards for staff */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 ${
              hasPermission("revenue.view") ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-4"
            } gap-4.5`}
          >
            {/* 1. Total Orders */}
            <div
              onClick={() => setActiveTab("orders")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Total Orders</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">
                  {totalOrdersCount}
                </p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <ShoppingCart className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 2. Pending Orders */}
            <div
              onClick={() => {
                setOrdersStatus("Pending");
                setActiveTab("orders");
              }}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Pending Orders</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">
                  {pendingOrderCount}
                </p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                <Package className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 3. Revenue (Delivered) */}
            <Can permission="revenue.view">
              <div className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Revenue (Delivered)</p>
                  <p className="text-2xl font-bold text-foreground mt-1.5">
                    {etb(deliveredRevenue)}
                  </p>
                </div>
                <div className="h-13 w-13 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                  <DollarSign className="h-6 w-6 stroke-[2.2]" />
                </div>
              </div>
            </Can>

            {/* 4. Pending Quotes */}
            <div
              onClick={() => {
                setQuoteFilter("New");
                setActiveTab("quotes");
              }}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Pending Quotes</p>
                  <p className="text-3xl font-bold text-foreground mt-1.5">
                    {newQuotesCount}
                  </p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-500 group-hover:scale-105 transition-transform">
                <FileText className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 5. Customers */}
            <div
              onClick={() => setActiveTab("customers")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Customers</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{customerCount}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
                <Users className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 6. Low Stock */}
            <div
              onClick={() => setActiveTab("inventory")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Low Stock</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{lowStockCount}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:scale-105 transition-transform">
                <AlertTriangle className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 7. New Messages */}
            <div
              onClick={() => setActiveTab("messages")}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">New Messages</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{unreadMessagesCount}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-105 transition-transform">
                <Bell className="h-6 w-6 stroke-[2]" />
              </div>
            </div>

            {/* 8. Completed Orders */}
            <div
              onClick={() => {
                setOrdersStatus("Delivered");
                setActiveTab("orders");
              }}
              className="group bg-card border border-border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-all hover:shadow-md hover:border-border cursor-pointer"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Completed Orders</p>
                <p className="text-3xl font-bold text-foreground mt-1.5">{completedOrdersCount}</p>
              </div>
              <div className="h-13 w-13 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="h-6 w-6 stroke-[2]" />
              </div>
            </div>
          </div>

          {/* Lower 2 Cards: Recent Orders & Recent Quotes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h2 className="text-base font-bold text-foreground">Recent Orders</h2>
                  {recentOrdersList.length > 0 && (
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="pt-4">
                  {recentOrdersList.length === 0 ? (
                    <div className="py-12 text-muted-foreground/60 text-sm font-normal">
                      No orders yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {recentOrdersList.map((ord) => (
                        <div
                          key={ord.order_id}
                          onClick={() => {
                            setSelectedOrder(ord);
                            setOrderDrawerOpen(true);
                          }}
                          className="py-3 flex items-center justify-between hover:bg-muted/50 px-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                Order #{ord.order_id}
                              </span>
                              <StatusBadge s={ord.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ord.customer ?? "Guest"}
                            </p>
                          </div>
                          {hasPermission("revenue.view") ? (
                            <span className="text-sm font-bold text-primary">{etb(ord.total)}</span>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md">
                              {ord.items?.length ?? 0} {ord.items?.length === 1 ? "item" : "items"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {recentOrdersList.length === 0 && (
                <div className="pt-4 border-t border-border/40 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("orders")}
                    className="text-xs text-muted-foreground"
                  >
                    Open Orders Manager
                  </Button>
                </div>
              )}
            </div>

            {/* Recent Quotes Card */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <h2 className="text-base font-bold text-foreground">Recent Quotes</h2>
                  {recentQuotesList.length > 0 && (
                    <button
                      onClick={() => setActiveTab("quotes")}
                      className="text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="pt-4">
                  {recentQuotesList.length === 0 ? (
                    <div className="py-12 text-muted-foreground/60 text-sm font-normal">
                      No quotes yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {recentQuotesList.map((q) => (
                        <div
                          key={q.quote_id}
                          onClick={() => {
                            setSelectedQuote(q);
                            setActiveTab("quotes");
                          }}
                          className="py-3 flex items-center justify-between hover:bg-muted/50 px-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground truncate">
                                {q.subject}
                              </span>
                              <StatusBadge s={q.status} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {q.name} · {q.created_at}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-primary shrink-0"
                          >
                            Inspect
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {recentQuotesList.length === 0 && (
                <div className="pt-4 border-t border-border/40 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("quotes")}
                    className="text-xs text-muted-foreground"
                  >
                    Open Quotes Manager
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PRODUCTS TAB (Complete Catalog Management)           */}
      {/* ======================================================== */}
      {activeTab === "products" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Products Catalog
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage fiberglass listings, technical specs, and prices
              </p>
            </div>
            <Can permission="products.create">
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setProductDialogOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </Can>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search products by name or description..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <select
              value={productCategoryFilter}
              onChange={(e) => setProductCategoryFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Product Details</th>
                    <th className="px-5 py-4">SKU</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Capacity</th>
                    <th className="px-5 py-4">Price</th>
                    <th className="px-5 py-4">Stock</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-12 text-center text-muted-foreground/60 text-sm"
                      >
                        No products match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = p.stock <= 5;
                      return (
                        <tr key={p.product_id} className="hover:bg-muted/50/60 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3.5">
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="h-11 w-11 rounded-xl object-cover border border-border"
                                />
                              ) : (
                                <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/60">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{p.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                                  {p.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                            {p.sku || "—"}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground font-medium">
                            {p.category}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{p.capacity || "—"}</td>
                          <td className="px-5 py-4 font-bold text-primary">{etb(p.price)}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                isLow
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {isLow && <AlertTriangle className="h-3 w-3" />}
                              {p.stock} in stock
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                (p.status ?? "active") === "active"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : (p.status ?? "active") === "draft"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {p.status ?? "active"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Can permission="products.delete">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setDeletingProduct(p);
                                    setConfirmDeleteDialogOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </Can>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CATEGORIES TAB                                       */}
      {/* ======================================================== */}
      {activeTab === "categories" &&
        (!hasPermission("categories.view") ? (
          <NotAuthorized
            userRole={user?.role}
            message="Product categories management is restricted to administrators."
          />
        ) : (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Product Categories</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage taxonomy with parent/child, ordering, and safe delete
                </p>
              </div>
              <Can permission="categories.create">
                <Button
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" /> Add Category
                </Button>
              </Can>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4">Order</th>
                      <th className="px-5 py-4">Name / Slug</th>
                      <th className="px-5 py-4">Parent</th>
                      <th className="px-5 py-4">Products</th>
                      <th className="px-5 py-4">Active</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoriesQuery.isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        Loading categories...
                      </td>
                    </tr>
                  ) : categoriesQuery.isError ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-rose-500 text-sm">
                        <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-rose-500" />
                        <p className="font-semibold">Failed to load categories</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {categoriesQuery.error instanceof Error
                            ? categoriesQuery.error.message
                            : "An unexpected error occurred."}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => categoriesQuery.refetch()}
                          className="mt-3 text-xs"
                        >
                          Retry
                        </Button>
                      </td>
                    </tr>
                  ) : ((categoriesQuery.data ?? []) as CategoryRow[]).length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-muted-foreground/60 text-sm"
                      >
                        No categories yet.
                      </td>
                    </tr>
                  ) : (
                    ((categoriesQuery.data ?? []) as CategoryRow[]).map((cat, idx, arr) => (
                      <tr key={cat.category_id} className="hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <div className="inline-flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={idx === 0}
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                const prev = arr[idx - 1];
                                if (!prev) return;
                                await mutateReorderCategories({
                                  data: {
                                    items: [
                                      { category_id: cat.category_id, sort_order: prev.sort_order },
                                      { category_id: prev.category_id, sort_order: cat.sort_order },
                                    ],
                                  },
                                } as any);
                                categoriesQuery.refetch();
                              }}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={idx === arr.length - 1}
                              className="h-6 w-6 p-0"
                              onClick={async () => {
                                const next = arr[idx + 1];
                                if (!next) return;
                                await mutateReorderCategories({
                                  data: {
                                    items: [
                                      { category_id: cat.category_id, sort_order: next.sort_order },
                                      { category_id: next.category_id, sort_order: cat.sort_order },
                                    ],
                                  },
                                } as any);
                                categoriesQuery.refetch();
                              }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold">{cat.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">/{cat.slug}</p>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          {cat.parent_name ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          <span className="font-semibold text-foreground">{cat.product_count}</span>{" "}
                          <span className="text-muted-foreground">
                            {cat.product_count === 1 ? "product" : "products"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              cat.is_active !== 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {cat.is_active !== 0 ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs font-medium"
                              onClick={async () => {
                                try {
                                  await mutateSaveCategory({
                                    data: {
                                      ...cat,
                                      is_active: cat.is_active === 0,
                                    },
                                  } as any);
                                  toast.success(
                                    `Category ${cat.is_active === 0 ? "activated" : "deactivated"}`,
                                  );
                                  categoriesQuery.refetch();
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Failed to toggle category",
                                  );
                                }
                              }}
                            >
                              {cat.is_active !== 0 ? (
                                <span className="text-xs text-rose-600">Deactivate</span>
                              ) : (
                                <span className="text-xs text-emerald-600">Activate</span>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              title="Edit category"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCategoryDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Can permission="categories.delete">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={cat.product_count > 0}
                                title={
                                  cat.product_count > 0
                                    ? "Cannot delete — has active products"
                                    : "Delete category"
                                }
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 disabled:opacity-30"
                                onClick={() => {
                                  setDeletingCategory(cat);
                                  setConfirmCategoryDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </Can>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {categoryDialogOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingCategory ? "Edit Category" : "New Category"}
                  </h3>
                  <CategoryForm
                    initial={editingCategory}
                    categories={(categoriesQuery.data ?? []) as CategoryRow[]}
                    onClose={() => setCategoryDialogOpen(false)}
                    onSave={async (payload: any) => {
                      setSavingCategory(true);
                      try {
                        await mutateSaveCategory({ data: payload } as any);
                        toast.success(
                          payload.category_id ? "Category updated" : "Category created",
                        );
                        categoriesQuery.refetch();
                        setCategoryDialogOpen(false);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to save category");
                      } finally {
                        setSavingCategory(false);
                      }
                    }}
                    saving={savingCategory}
                  />
                </div>
              </div>
            )}

            <ConfirmDialog
              open={confirmCategoryDeleteOpen}
              onOpenChange={setConfirmCategoryDeleteOpen}
              title={`Delete "${deletingCategory?.name}"?`}
              description="This permanently removes the category. Products using it must be reassigned first."
              confirmLabel="Delete Category"
              variant="destructive"
              onConfirm={async () => {
                if (!deletingCategory) return;
                try {
                  await mutateDeleteCategory({ data: { id: deletingCategory.category_id } } as any);
                  toast.success("Category deleted");
                  categoriesQuery.refetch();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to delete");
                }
              }}
            />
          </div>
        ))}

      {/* ======================================================== */}
      {/* 4. INVENTORY TAB                                        */}
      {/* ======================================================== */}
      {activeTab === "inventory" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Inventory Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track warehouse stock levels, low-stock alerts, and fast adjustments
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">Total Catalog SKUs</p>
              <p className="text-3xl font-bold text-foreground mt-1.5">{allProducts.length}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">Total Units In Stock</p>
              <p className="text-3xl font-bold text-primary mt-1.5">{totalStockUnits}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <p className="text-xs font-semibold text-muted-foreground">Low Stock Warnings</p>
              <p className="text-3xl font-bold text-amber-500 mt-1.5">{lowStockCount}</p>
            </div>
            <Can permission="revenue.view">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <p className="text-xs font-semibold text-muted-foreground">Stock Inventory Value</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1.5">{etb(totalStockValue)}</p>
              </div>
            </Can>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b border-border gap-4">
            <button
              onClick={() => setInventorySubTab("stock")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                inventorySubTab === "stock"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Warehouse Stock ({filteredInventory.length})
            </button>
            <button
              onClick={() => setInventorySubTab("approvals")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                inventorySubTab === "approvals"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Pending Approvals
              {(stockAdjustmentsQuery.data?.filter((a) => a.status === "pending_approval")
                ?.length ?? 0) > 0 && (
                <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {
                    stockAdjustmentsQuery.data?.filter((a) => a.status === "pending_approval")
                      .length
                  }
                </span>
              )}
            </button>
          </div>

          {inventorySubTab === "stock" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Filter by product name..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pl-9 bg-card border-border"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-4">Item</th>
                        <th className="px-5 py-4">Category</th>
                        <th className="px-5 py-4">Current Stock</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4 text-right">Quick Restock / Adjust</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredInventory.map((p) => {
                        const isUpdating = stockUpdatingId === p.product_id;
                        const isLow = p.stock <= 5;
                        const isOut = p.stock === 0;

                        return (
                          <tr key={p.product_id} className="hover:bg-muted/50/60 transition-colors">
                            <td className="px-5 py-4">
                              <p className="font-semibold text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground/60">
                                Unit Price: {etb(p.price)}
                              </p>
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{p.category}</td>
                            <td className="px-5 py-4 font-bold text-base text-foreground">
                              {p.stock} units
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  isOut
                                    ? "bg-rose-100 text-rose-800"
                                    : isLow
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {isOut ? "Out of Stock" : isLow ? "Low Stock" : "Well Stocked"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isUpdating || p.stock === 0}
                                  onClick={() => handleQuickStockAdjust(p, -1)}
                                  className="h-8 px-2 text-xs"
                                >
                                  -1
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isUpdating}
                                  onClick={() => handleQuickStockAdjust(p, 1)}
                                  className="h-8 px-2 text-xs font-semibold text-primary"
                                >
                                  +1
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isUpdating}
                                  onClick={() => handleQuickStockAdjust(p, 5)}
                                  className="h-8 px-2 text-xs font-semibold text-emerald-600"
                                >
                                  +5
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isUpdating}
                                  onClick={() => handleQuickStockAdjust(p, 10)}
                                  className="h-8 px-2 text-xs font-semibold text-indigo-600"
                                >
                                  +10
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setInventoryMovementProduct(p)}
                                  className="h-8 px-2 text-xs"
                                  title="View movement history"
                                >
                                  <History className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-4">Request #</th>
                        <th className="px-5 py-4">Product</th>
                        <th className="px-5 py-4">Requested Delta</th>
                        <th className="px-5 py-4">Reason</th>
                        <th className="px-5 py-4">Requested By</th>
                        <th className="px-5 py-4">Date</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {!(stockAdjustmentsQuery.data && stockAdjustmentsQuery.data.length > 0) ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-12 text-center text-muted-foreground/60 text-sm"
                          >
                            No stock adjustment requests found.
                          </td>
                        </tr>
                      ) : (
                        stockAdjustmentsQuery.data.map((adj) => (
                          <tr key={adj.id} className="hover:bg-muted/50/60 transition-colors">
                            <td className="px-5 py-4 font-mono font-bold text-primary">
                              #{adj.id}
                            </td>
                            <td className="px-5 py-4 font-semibold text-foreground">
                              {adj.product_name ?? `Product #${adj.product_id}`}
                            </td>
                            <td className="px-5 py-4 font-bold">
                              <span
                                className={adj.quantity > 0 ? "text-emerald-600" : "text-rose-600"}
                              >
                                {adj.quantity > 0 ? `+${adj.quantity}` : adj.quantity} units
                              </span>
                            </td>
                            <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs">
                              {adj.reason}
                            </td>
                            <td className="px-5 py-4 text-foreground font-medium">
                              {adj.staff_name ?? `User #${adj.staff_id}`}
                            </td>
                            <td className="px-5 py-4 text-xs text-muted-foreground/60">
                              {adj.created_at}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  adj.status === "approved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : adj.status === "rejected"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {adj.status === "pending_approval"
                                  ? "Pending Admin Approval"
                                  : adj.status === "approved"
                                    ? "Approved"
                                    : "Rejected"}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              {adj.status === "pending_approval" ? (
                                <Can
                                  permission="inventory.adjust_unlimited"
                                  fallback={
                                    <span className="text-xs text-muted-foreground italic">
                                      Awaiting Admin
                                    </span>
                                  }
                                >
                                  <div className="inline-flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await mutateApproveStockAdj({ data: { id: adj.id } });
                                          toast.success(`Adjustment #${adj.id} approved`);
                                          stockAdjustmentsQuery.refetch();
                                          productsQuery.refetch();
                                        } catch (err) {
                                          toast.error(
                                            err instanceof Error
                                              ? err.message
                                              : "Failed to approve",
                                          );
                                        }
                                      }}
                                      className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          await mutateRejectStockAdj({ data: { id: adj.id } });
                                          toast.success(`Adjustment #${adj.id} rejected`);
                                          stockAdjustmentsQuery.refetch();
                                        } catch (err) {
                                          toast.error(
                                            err instanceof Error ? err.message : "Failed to reject",
                                          );
                                        }
                                      }}
                                      className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                </Can>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
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

          {/* Stock Movement History Panel */}
          {inventoryMovementProduct && (
            <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
              <div className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Stock Movement History</h3>
                    <p className="text-sm text-muted-foreground">{inventoryMovementProduct.name}</p>
                  </div>
                  <Button variant="ghost" onClick={() => setInventoryMovementProduct(null)}>
                    ✕
                  </Button>
                </div>
                {stockMovementsQuery.isFetching ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Qty</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {((stockMovementsQuery.data as any)?.movements ?? []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-8 text-center text-muted-foreground/60 text-sm"
                            >
                              No movement history.
                            </td>
                          </tr>
                        ) : (
                          ((stockMovementsQuery.data as any)?.movements ?? []).map((mv: any) => (
                            <tr key={mv.id} className="hover:bg-muted/40">
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {String(mv.created_at ?? "").slice(0, 10)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${mv.type === "in" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
                                >
                                  {mv.type === "in" ? "In" : "Out"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold">
                                {mv.quantity > 0 ? `+${mv.quantity}` : mv.quantity}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {mv.reference_type} #{mv.reference_id}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {mv.note ?? "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mandatory Stock Reason Prompt Dialog */}
          {stockReasonPrompt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
              <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4">
                <h3 className="font-bold text-lg text-foreground">Confirm Stock Adjustment</h3>
                <div className="rounded-xl bg-muted/50 p-4 text-xs space-y-1">
                  <p>
                    <strong className="text-foreground">Product:</strong>{" "}
                    {stockReasonPrompt.product.name}
                  </p>
                  <p>
                    <strong className="text-foreground">Adjustment:</strong>{" "}
                    <span
                      className={
                        stockReasonPrompt.delta > 0
                          ? "text-emerald-600 font-bold"
                          : "text-rose-600 font-bold"
                      }
                    >
                      {stockReasonPrompt.delta > 0
                        ? `+${stockReasonPrompt.delta}`
                        : stockReasonPrompt.delta}{" "}
                      units
                    </span>
                  </p>
                  <p>
                    <strong className="text-foreground">New Stock:</strong>{" "}
                    {Math.max(0, stockReasonPrompt.product.stock + stockReasonPrompt.delta)} units
                  </p>
                </div>

                {user?.role === "staff" && Math.abs(stockReasonPrompt.delta) > 50 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Adjustment of {Math.abs(stockReasonPrompt.delta)} units exceeds the 50-unit
                      staff limit and requires admin approval. This will create a pending request
                      for review.
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Mandatory Reason for Adjustment *
                  </Label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Received new shipment from manufacturing / damaged during transport..."
                    value={stockReasonText}
                    onChange={(e) => setStockReasonText(e.target.value)}
                    className="w-full rounded-xl border border-border p-3 text-xs focus:outline-sky-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStockReasonPrompt(null);
                      setStockReasonText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!stockReasonText.trim()}
                    onClick={handleConfirmStockAdjust}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Confirm Adjustment
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. ORDERS TAB                                           */}
      {/* ======================================================== */}
      {activeTab === "orders" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Order Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Track customer orders, manage statuses, and export fulfillment records
              </p>
            </div>
            <Can permission="reports.export">
              <Button
                size="sm"
                variant="outline"
                onClick={exportOrdersCSV}
                className="gap-2 text-muted-foreground bg-card"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </Can>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search order #, customer, address..."
                value={ordersSearch}
                onChange={(e) => {
                  setOrdersSearch(e.target.value);
                  setOrdersPage(1);
                }}
                className="pl-9 bg-card border-border"
              />
            </div>
            <select
              value={ordersStatus}
              onChange={(e) => {
                setOrdersStatus(e.target.value);
                setOrdersPage(1);
              }}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Statuses</option>
              {ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Order #</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Items Summary</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-muted-foreground/60 text-sm"
                      >
                        No orders found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    allOrders.map((o) => (
                      <tr
                        key={o.order_id}
                        onClick={() => {
                          setSelectedOrder(o);
                          setOrderDrawerOpen(true);
                        }}
                        className="hover:bg-muted/50/60 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4 font-bold text-foreground">#{o.order_id}</td>
                        <td className="px-5 py-4 font-semibold text-foreground">
                          {o.customer ?? "Guest"}
                        </td>
                        <td className="px-5 py-4 text-muted-foreground text-xs">{o.created_at}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                          {o.items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}
                        </td>
                        <td className="px-5 py-4 font-bold text-primary">{etb(o.total)}</td>
                        <td className="px-5 py-4">
                          <StatusBadge s={o.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-primary font-semibold"
                              onClick={() => {
                                setSelectedOrder(o);
                                setOrderDrawerOpen(true);
                              }}
                            >
                              Manage
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-primary font-semibold h-8 w-8 p-0"
                              onClick={() => printInvoice(o)}
                              title="Print Invoice"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {allOrders.length} of {ordersQuery.data?.total ?? 0} orders
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Per page:</span>
                <select
                  value={ordersPageSize}
                  onChange={(e) => {
                    setOrdersPageSize(Number(e.target.value));
                    setOrdersPage(1);
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ordersPage <= 1}
                  onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  Page {ordersPage} of {Math.max(1, ordersQuery.data?.totalPages ?? 1)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ordersPage >= Math.max(1, ordersQuery.data?.totalPages ?? 1)}
                  onClick={() => setOrdersPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. QUOTES TAB                                           */}
      {/* ======================================================== */}
      {activeTab === "quotes" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Customer Quote Requests
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Review technical requests, send pricing quotations, and communicate with clients
              </p>
            </div>
            <Can permission="admin">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await mutateExpireQuotes();
                    toast.success(
                      res.expired > 0
                        ? `Expired ${res.expired} overdue quotes`
                        : "No overdue quotes to expire",
                    );
                    qc.invalidateQueries({ queryKey: ["admin", "data"] });
                    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to expire quotes");
                  }
                }}
              >
                <RotateCcw className="h-4 w-4" /> Expire Overdue
              </Button>
            </Can>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={quoteFilter}
              onChange={(e) => setQuoteFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Quote Statuses</option>
              {QUOTE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inbox */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Inquiries Inbox ({filteredQuotes.length})
              </h3>
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {filteredQuotes.length === 0 ? (
                  <p className="p-8 text-center text-xs text-muted-foreground/60">
                    No quote requests found.
                  </p>
                ) : (
                  filteredQuotes.map((q) => {
                    const isSelected = selectedQuote?.quote_id === q.quote_id;
                    const isNew = q.status === "New";
                    return (
                      <div
                        key={q.quote_id}
                        onClick={() => setSelectedQuote(q)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-xs"
                            : isNew
                              ? "border-amber-200 bg-amber-50/40 hover:bg-muted/50"
                              : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {q.subject}
                          </p>
                          <StatusBadge s={q.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          {q.name} · {q.created_at}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Viewer */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-2">
              {selectedQuote ? (
                <div className="space-y-6 flex flex-col justify-between h-full">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div>
                        <span className="text-xs text-muted-foreground/60">
                          Inquiry #{selectedQuote.quote_id}
                        </span>
                        <h2 className="text-lg font-bold text-foreground mt-0.5">
                          {selectedQuote.subject}
                        </h2>
                      </div>
                      <StatusBadge s={selectedQuote.status} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4 text-xs">
                      <div>
                        <span className="text-muted-foreground/60">Customer Name:</span>
                        <p className="font-semibold text-foreground text-sm mt-0.5">
                          {selectedQuote.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/60">Email:</span>
                        <p className="font-semibold text-primary text-sm mt-0.5">
                          {selectedQuote.email}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground/60">Submission Date:</span>
                        <p className="font-semibold text-foreground mt-0.5">
                          {selectedQuote.created_at}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Client Message / Requirements
                      </h4>
                      <div className="mt-2 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {selectedQuote.message}
                      </div>
                    </div>

                    {/* Quote Line Items */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Requested Items ({quoteItems.length})
                      </h4>
                      <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden">
                        {quoteItems.length === 0 ? (
                          <p className="p-3 text-xs text-muted-foreground/70 text-center">
                            No line items specified in this quote yet.
                          </p>
                        ) : (
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-muted/50 border-b border-border">
                                <th className="px-3 py-2 text-left text-xs text-muted-foreground font-medium">
                                  Product
                                </th>
                                <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium">
                                  Qty
                                </th>
                                <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium">
                                  Unit Price
                                </th>
                                <th className="px-3 py-2 text-right text-xs text-muted-foreground font-medium">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {quoteItems.map((item) => (
                                <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                                  <td className="px-3 py-2 text-foreground text-xs font-medium">
                                    {item.product_name}
                                    {item.product_id ? (
                                      <span className="text-muted-foreground/50 text-[10px] ml-1">
                                        (#{item.product_id})
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 text-right text-xs text-foreground">
                                    {item.quantity}
                                  </td>
                                  <td className="px-3 py-2 text-right text-xs text-foreground">
                                    {etb(item.unit_price)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-xs text-foreground font-medium">
                                    {etb(item.unit_price * item.quantity)}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-muted/50 border-t border-border">
                                <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-foreground">
                                  Items Total
                                </td>
                                <td className="px-3 py-2 text-right text-xs font-semibold text-primary">
                                  {etb(
                                    quoteItems.reduce(
                                      (sum, it) => sum + it.unit_price * it.quantity,
                                      0,
                                    ),
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <Button
                      asChild
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                      <a
                        href={`mailto:${selectedQuote.email}?subject=RE: ${encodeURIComponent(selectedQuote.subject)}`}
                      >
                        <Mail className="h-4 w-4" />
                        Reply by Email
                      </a>
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuoteStatusChange(selectedQuote.quote_id, "Replied")}
                        disabled={selectedQuote.status === "Replied"}
                      >
                        Mark Replied
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleQuoteStatusChange(selectedQuote.quote_id, "Closed")}
                        disabled={selectedQuote.status === "Closed"}
                      >
                        Close
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuoteStatusChange(selectedQuote.quote_id, "Accepted")}
                        disabled={selectedQuote.status === "Accepted"}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>

                  {/* Quote Response Panel */}
                  {[
                    "New",
                    "Replied",
                    "Reviewing",
                    "Accepted",
                  ].includes(selectedQuote.status) && (
                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 mt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Send Quote Response
                      </h4>
                      {(selectedQuote as any).delivery_location && (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {(selectedQuote as any).delivery_location}
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Quoted Amount (ETB) *</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 125000"
                            value={quoteAmount}
                            onChange={(e) => setQuoteAmount(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Valid Until *</Label>
                          <Input
                            type="date"
                            value={quoteValidUntil}
                            onChange={(e) => setQuoteValidUntil(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-xs font-semibold">Reply Message (optional)</Label>
                          <textarea
                            rows={3}
                            placeholder="Dear customer, please find the quotation for your request..."
                            value={quoteReplyMsg}
                            onChange={(e) => setQuoteReplyMsg(e.target.value)}
                            className="w-full rounded-xl border border-border p-2.5 text-xs focus:outline-sky-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={quoteSending || !quoteAmount || !quoteValidUntil}
                          onClick={async () => {
                            setQuoteSending(true);
                            try {
                              const res = await mutateQuoteStatus({
                                data: {
                                  id: selectedQuote.quote_id,
                                  status: "Replied",
                                  quoted_amount: Number(quoteAmount),
                                  valid_until: quoteValidUntil,
                                  reply_message: quoteReplyMsg || undefined,
                                },
                              } as any);
                              if ((res as any)?.pendingApproval) {
                                toast.info((res as any).message);
                              } else {
                                toast.success("Quote response sent to customer");
                              }
                              setQuoteAmount("");
                              setQuoteValidUntil("");
                              setQuoteReplyMsg("");
                              await qc.invalidateQueries({ queryKey: ["admin", "data"] });
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Failed to send quote",
                              );
                            } finally {
                              setQuoteSending(false);
                            }
                          }}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {quoteSending ? "Sending…" : "Send Quote"}
                        </Button>
                        <Can permission="admin">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!(selectedQuote as any).quoted_amount}
                            title={
                              !(selectedQuote as any).quoted_amount
                                ? "Set a quoted amount first"
                                : "Convert to an order"
                            }
                            onClick={async () => {
                              try {
                                await mutateConvertQuoteToOrder({
                                  data: { quote_id: selectedQuote.quote_id },
                                } as any);
                                toast.success("Order created from quote");
                                await qc.invalidateQueries({ queryKey: ["admin", "data"] });
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to convert",
                                );
                              }
                            }}
                          >
                            Convert to Order
                          </Button>
                        </Can>
                      </div>

                      {/* Add / Edit Line Items */}
                      <div className="mt-3 border border-border rounded-xl p-3 bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Line Items
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setQuoteItemEditing(null)}
                            disabled={savingQuoteItems}
                          >
                            <Plus className="h-3 w-3" /> Add Item
                          </Button>
                        </div>
                        {quoteItemEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                            <Input
                              value={quoteItemEditing.product_name}
                              onChange={(e) =>
                                setQuoteItemEditing({
                                  ...quoteItemEditing,
                                  product_name: e.target.value,
                                })
                              }
                              placeholder="Product name"
                              className="h-8 text-xs"
                            />
                            <Input
                              type="number"
                              value={quoteItemEditing.quantity}
                              onChange={(e) =>
                                setQuoteItemEditing({ ...quoteItemEditing, quantity: e.target.value })
                              }
                              placeholder="Qty"
                              className="h-8 text-xs"
                            />
                            <Input
                              type="number"
                              value={quoteItemEditing.unit_price}
                              onChange={(e) =>
                                setQuoteItemEditing({
                                  ...quoteItemEditing,
                                  unit_price: e.target.value,
                                })
                              }
                              placeholder="Unit price"
                              className="h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={async () => {
                                setSavingQuoteItems(true);
                                try {
                                  const next = [
                                    ...quoteItems.filter((i) => i.id !== quoteItemEditing?.id),
                                    {
                                      product_id: quoteItemEditing?.product_id ?? null,
                                      product_name: quoteItemEditing!.product_name,
                                      quantity: Number(quoteItemEditing!.quantity),
                                      unit_price: Number(quoteItemEditing!.unit_price),
                                    },
                                  ];
                                  await mutateSaveQuoteItems({
                                    data: { quote_id: selectedQuote!.quote_id, items: next },
                                  } as any);
                                  setQuoteItems(next);
                                  setQuoteItemEditing(null);
                                  toast.success("Line item saved");
                                  await qc.invalidateQueries({ queryKey: ["admin", "data"] });
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error ? err.message : "Failed to save line item",
                                  );
                                } finally {
                                  setSavingQuoteItems(false);
                                }
                              }}
                              disabled={savingQuoteItems || !quoteItemEditing?.product_name || !quoteItemEditing?.quantity || !quoteItemEditing?.unit_price}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQuoteItemEditing(null)}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground/70">
                            Click "Add Item" to define requested products and quantities for this
                            quote.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No quote selected"
                  description="Select a quote request from the left inbox to view full message content and reply."
                  className="border-none py-20"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. CUSTOMERS TAB                                        */}
      {/* ======================================================== */}
      {activeTab === "customers" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Customer Directory
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review registered client accounts, order counts, and lifetime spending
            </p>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search by customer name, email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <Can permission="customers.export">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 ml-auto"
                onClick={() =>
                  fetchExportCustomersCSV()
                    .then((result: any) => {
                      downloadCsv(result.csv, "customers.csv");
                      toast.success(`Exported ${result.count} customers`);
                    })
                    .catch((e: Error) => toast.error(e.message))
                }
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </Can>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Customer Name</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Phone</th>
                    <th className="px-5 py-4">Role / Type</th>
                    <th className="px-5 py-4">Orders Placed</th>
                    {hasPermission("revenue.view") && (
                      <th className="px-5 py-4">Lifetime Spend</th>
                    )}
                    <th className="px-5 py-4">Joined / First Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={hasPermission("revenue.view") ? 7 : 6}
                        className="py-12 text-center text-muted-foreground/60 text-sm"
                      >
                        No customers found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c: any) => (
                      <tr
                        key={c.id || c.email || c.user_id}
                        className="hover:bg-muted/50/60 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedCustomerTarget({ user_id: c.user_id, email: c.email });
                          setCustomerDetailOpen(true);
                        }}
                      >
                        <td className="px-5 py-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            {c.is_guest && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                Guest
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{c.email}</td>
                        <td className="px-5 py-4 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="px-5 py-4">
                          {c.is_guest ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400">
                              Guest
                            </span>
                          ) : (
                            <Can
                              permission="team.update"
                              fallback={
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                                    c.role === "admin"
                                      ? "bg-primary/15 text-primary"
                                      : c.role === "staff"
                                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                        : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {c.role}
                                </span>
                              }
                            >
                              <select
                                value={c.role}
                                onClick={(e) => e.stopPropagation()}
                                onChange={async (e) => {
                                  e.stopPropagation();
                                  const newRole = e.target.value as "customer" | "admin" | "staff";
                                  try {
                                    await mutateUserRole({
                                      data: { userId: c.user_id, role: newRole },
                                    });
                                    toast.success(`Updated ${c.name}'s role to ${newRole}`);
                                    customersQuery.refetch();
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error ? err.message : "Failed to update role",
                                    );
                                  }
                                }}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize border border-border bg-card cursor-pointer focus:ring-1 focus:ring-primary ${
                                  c.role === "admin"
                                    ? "text-primary border-primary/30"
                                    : c.role === "staff"
                                      ? "text-amber-600 border-amber-500/30 dark:text-amber-400"
                                      : "text-muted-foreground"
                                }`}
                              >
                                <option value="customer">Customer</option>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>
                            </Can>
                          )}
                        </td>
                        <td className="px-5 py-4 font-semibold text-foreground">
                          {c.orders_count}
                        </td>
                        {hasPermission("revenue.view") && (
                          <td className="px-5 py-4 font-bold text-primary">
                            {etb(c.total_spent)}
                          </td>
                        )}
                        <td className="px-5 py-4 text-xs text-muted-foreground/60">
                          {c.created_at}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Detail Modal */}
          {customerDetailOpen && selectedCustomerTarget && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
                <div className="flex justify-between items-center pb-3 border-b border-border">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Customer Record</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Contact details, complete order & quote history, and recorded communications
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomerDetailOpen(false);
                      setSelectedCustomerTarget(null);
                    }}
                  >
                    ✕
                  </Button>
                </div>
                {customerDetailQuery.data ? (
                  (() => {
                    const cust = customerDetailQuery.data as any;
                    return (
                      <div className="space-y-6">
                        {/* Summary Badges & Contact */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border border-border">
                          <div>
                            <span className="text-xs text-muted-foreground">Name</span>
                            <p className="font-semibold text-foreground">{cust.name}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Email</span>
                            <p className="font-semibold text-foreground text-sm break-all">
                              {cust.email}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Phone</span>
                            <p className="font-medium text-foreground">{cust.phone || "—"}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Account Type</span>
                            <p className="font-semibold text-foreground capitalize">
                              {cust.is_guest ? "Guest Customer" : cust.role}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Total Orders</span>
                            <p className="font-bold text-lg text-foreground">
                              {cust.orders_count}
                            </p>
                          </div>
                          {canViewRevenue && (
                            <div>
                              <span className="text-xs text-muted-foreground">
                                Completed Spend (Delivered)
                              </span>
                              <p className="font-bold text-lg text-primary">
                                {etb(cust.total_spent)}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-xs text-muted-foreground">Joined / First Seen</span>
                            <p className="text-sm text-foreground">{cust.created_at}</p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Account Status</span>
                            <p className="text-sm font-medium">
                              {cust.is_guest ? (
                                <span className="text-sky-600">Guest Record</span>
                              ) : cust.is_active ? (
                                <span className="text-emerald-600">Active Account</span>
                              ) : (
                                <span className="text-rose-600">Blocked Account</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Guest Notice or Block Button */}
                        {!cust.is_guest && cust.user_id ? (
                          <Can permission="customers.block">
                            <Button
                              size="sm"
                              variant={cust.is_active ? "destructive" : "outline"}
                              onClick={() =>
                                mutateBlockCustomer({
                                  data: {
                                    user_id: cust.user_id,
                                    block: !!cust.is_active,
                                  },
                                } as any)
                                  .then(() => {
                                    toast.success(
                                      cust.is_active
                                        ? "Customer account blocked"
                                        : "Customer account unblocked",
                                    );
                                    qc.invalidateQueries({ queryKey: ["admin", "customers"] });
                                    qc.invalidateQueries({
                                      queryKey: [
                                        "customer-detail",
                                        selectedCustomerTarget?.user_id,
                                        selectedCustomerTarget?.email,
                                      ],
                                    });
                                    setCustomerDetailOpen(false);
                                  })
                                  .catch((e: Error) => toast.error(e.message))
                              }
                            >
                              {cust.is_active ? "Block Customer Account" : "Unblock Customer Account"}
                            </Button>
                          </Can>
                        ) : (
                          <div className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/20">
                            <strong>Guest Customer:</strong> Aggregated from verified order, quote, and contact message records without requiring account registration.
                          </div>
                        )}

                        {/* Order History */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center justify-between text-foreground">
                            <span>Order History</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {(cust.recent_orders ?? []).length} orders recorded
                            </span>
                          </h4>
                          <div className="overflow-hidden rounded-xl border border-border">
                            <table className="w-full text-sm text-left">
                              <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                                <tr>
                                  <th className="px-4 py-2.5">Order</th>
                                  {canViewRevenue && <th className="px-4 py-2.5">Total</th>}
                                  <th className="px-4 py-2.5">Status</th>
                                  <th className="px-4 py-2.5">Address</th>
                                  <th className="px-4 py-2.5">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {(cust.recent_orders ?? []).length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={canViewRevenue ? 5 : 4}
                                      className="py-6 text-center text-muted-foreground/60 text-xs"
                                    >
                                      No orders recorded for this customer.
                                    </td>
                                  </tr>
                                ) : (
                                  (cust.recent_orders ?? []).map((o: any) => (
                                    <tr key={o.order_id}>
                                      <td className="px-4 py-2.5 font-bold text-primary font-mono text-xs">
                                        #{o.order_id}
                                      </td>
                                      {canViewRevenue && (
                                        <td className="px-4 py-2.5 font-semibold text-foreground">
                                          {etb(o.total)}
                                        </td>
                                      )}
                                      <td className="px-4 py-2.5">
                                        <StatusBadge s={o.status} />
                                      </td>
                                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                                        {o.address || "—"}
                                      </td>
                                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                        {o.created_at}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Quote History */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm flex items-center justify-between text-foreground">
                            <span>Quote Requests</span>
                            <span className="text-xs text-muted-foreground font-normal">
                              {(cust.recent_quotes ?? []).length} quotes recorded
                            </span>
                          </h4>
                          <div className="overflow-hidden rounded-xl border border-border">
                            <table className="w-full text-sm text-left">
                              <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                                <tr>
                                  <th className="px-4 py-2.5">Quote</th>
                                  <th className="px-4 py-2.5">Subject</th>
                                  {canViewRevenue && <th className="px-4 py-2.5">Amount</th>}
                                  <th className="px-4 py-2.5">Status</th>
                                  <th className="px-4 py-2.5">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {(cust.recent_quotes ?? []).length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={canViewRevenue ? 5 : 4}
                                      className="py-6 text-center text-muted-foreground/60 text-xs"
                                    >
                                      No quote requests found.
                                    </td>
                                  </tr>
                                ) : (
                                  (cust.recent_quotes ?? []).map((q: any) => (
                                    <tr key={q.quote_id}>
                                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">
                                        #{q.quote_id}
                                      </td>
                                      <td className="px-4 py-2.5 text-foreground">{q.subject}</td>
                                      {canViewRevenue && (
                                        <td className="px-4 py-2.5 font-semibold text-foreground">
                                          {q.quoted_amount ? etb(q.quoted_amount) : "—"}
                                        </td>
                                      )}
                                      <td className="px-4 py-2.5">
                                        <StatusBadge s={q.status} />
                                      </td>
                                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                        {q.created_at}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Communication History */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-sm text-foreground">
                            Communication History
                          </h4>

                          {/* Contact Inquiries */}
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Inbound Inquiries & Messages
                            </span>
                            <div className="overflow-hidden rounded-xl border border-border">
                              <table className="w-full text-sm text-left">
                                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                                  <tr>
                                    <th className="px-4 py-2.5">#</th>
                                    <th className="px-4 py-2.5">Subject</th>
                                    <th className="px-4 py-2.5">Message Excerpt</th>
                                    <th className="px-4 py-2.5">Status</th>
                                    <th className="px-4 py-2.5">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {(cust.recent_messages ?? []).length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={5}
                                        className="py-4 text-center text-muted-foreground/60 text-xs"
                                      >
                                        No contact inquiries found.
                                      </td>
                                    </tr>
                                  ) : (
                                    (cust.recent_messages ?? []).map((m: any) => (
                                      <tr key={m.id}>
                                        <td className="px-4 py-2.5 font-mono text-xs">#{m.id}</td>
                                        <td className="px-4 py-2.5 font-medium text-foreground">
                                          {m.subject}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[250px] truncate">
                                          {m.message || "—"}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                              m.is_read
                                                ? "bg-muted text-muted-foreground"
                                                : "bg-primary/15 text-primary"
                                            }`}
                                          >
                                            {m.is_read ? "Read" : "Unread"}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                          {m.created_at}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Support Tickets */}
                          {(cust.recent_tickets ?? []).length > 0 && (
                            <div className="space-y-2">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Support & Warranty Tickets
                              </span>
                              <div className="overflow-hidden rounded-xl border border-border">
                                <table className="w-full text-sm text-left">
                                  <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                                    <tr>
                                      <th className="px-4 py-2.5">Ticket</th>
                                      <th className="px-4 py-2.5">Subject</th>
                                      <th className="px-4 py-2.5">Category</th>
                                      <th className="px-4 py-2.5">Priority</th>
                                      <th className="px-4 py-2.5">Status</th>
                                      <th className="px-4 py-2.5">Date</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {(cust.recent_tickets ?? []).map((t: any) => (
                                      <tr key={t.id}>
                                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-primary">
                                          {t.ticket_code || `#${t.id}`}
                                        </td>
                                        <td className="px-4 py-2.5 font-medium text-foreground">
                                          {t.subject}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                          {t.category}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs">
                                          <span
                                            className={`px-2 py-0.5 rounded-full font-semibold ${
                                              t.priority === "Urgent"
                                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                                : t.priority === "High"
                                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                                  : "bg-muted text-muted-foreground"
                                            }`}
                                          >
                                            {t.priority}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <StatusBadge s={t.status} />
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                          {t.created_at}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Order Messages */}
                          {(cust.recent_order_messages ?? []).length > 0 && (
                            <div className="space-y-2">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Order Communication Feed
                              </span>
                              <div className="overflow-hidden rounded-xl border border-border">
                                <table className="w-full text-sm text-left">
                                  <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                                    <tr>
                                      <th className="px-4 py-2.5">Order</th>
                                      <th className="px-4 py-2.5">Sender</th>
                                      <th className="px-4 py-2.5">Message</th>
                                      <th className="px-4 py-2.5">Timestamp</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {(cust.recent_order_messages ?? []).map((om: any) => (
                                      <tr key={om.id}>
                                        <td className="px-4 py-2.5 font-mono text-xs text-primary font-bold">
                                          #{om.order_id}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs font-semibold text-foreground">
                                          {om.sender_name} ({om.sender_type})
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[300px] truncate">
                                          {om.body}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                          {om.created_at}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Loading customer records…
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. MESSAGES TAB                                         */}
      {/* ======================================================== */}
      {activeTab === "messages" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Inbound Messages</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Direct inquiries, feedback, and questions from website visitors
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  placeholder="Search messages..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  className="pl-8 text-xs bg-muted/50 border-border h-8"
                />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredMessages.map((m: any) => {
                  const isSelected = selectedMessage?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMessage(m);
                        if (!m.is_read) {
                          mutateMarkMessageRead({ data: { id: m.id } } as any)
                            .then(() => contactMessagesQuery.refetch())
                            .catch(() => {});
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : !m.is_read
                            ? "border-primary/20 bg-primary/10/30 font-semibold"
                            : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-foreground truncate">{m.name}</p>
                        {!m.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{m.subject}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{m.created_at}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-xs lg:col-span-2">
              {selectedMessage ? (
                <div className="space-y-6">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-lg font-bold text-foreground">{selectedMessage.subject}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      From: <strong className="text-foreground">{selectedMessage.name}</strong> (
                      {selectedMessage.email}) · {selectedMessage.phone}
                    </p>
                  </div>

                  <div className="rounded-xl bg-muted/50 p-5 text-sm text-foreground leading-relaxed">
                    {selectedMessage.message}
                  </div>

                  {/* ---- Conversation Thread / Reply History ---- */}
                  {contactMessageRepliesQuery.data &&
                    (contactMessageRepliesQuery.data as any[]).length > 0 && (
                      <div className="space-y-3 pt-2">
                        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5" />
                          Conversation History ({(contactMessageRepliesQuery.data as any[]).length})
                        </Label>
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                          {(contactMessageRepliesQuery.data as any[]).map((reply: any) => (
                            <div
                              key={reply.id}
                              className={`rounded-lg p-3 text-sm border ${
                                reply.is_internal
                                  ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                                  : "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                  {reply.staff_name}
                                  {reply.is_internal ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400">
                                      <Lock className="h-2.5 w-2.5" />
                                      Internal
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400">
                                      <Eye className="h-2.5 w-2.5" />
                                      Sent
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {reply.created_at}
                                </span>
                              </div>
                              <p className="text-foreground/80 whitespace-pre-wrap text-xs leading-relaxed">
                                {reply.reply_text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* ---- Reply Form ---- */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {messageReplyInternal ? "Internal Note" : "Quick Reply"}
                    </Label>
                    <textarea
                      rows={4}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        messageReplyInternal
                          ? "Write an internal note (not visible to the customer)..."
                          : "Type your response to the customer..."
                      }
                      className={`w-full rounded-xl border p-3 text-sm focus:outline-sky-500 ${
                        messageReplyInternal
                          ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-700"
                          : "border-border"
                      }`}
                    />

                    {/* Internal note toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={messageReplyInternal}
                        onChange={(e) => setMessageReplyInternal(e.target.checked)}
                        className="rounded border-border accent-amber-500"
                      />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Internal Note (confidential, not sent to customer)
                      </span>
                    </label>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await mutateArchiveMessage({ data: { id: selectedMessage.id } });
                              toast.success("Message archived");
                              setSelectedMessage(null);
                              contactMessagesQuery.refetch();
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Failed to archive message",
                              );
                            }
                          }}
                          className="text-xs text-muted-foreground gap-1.5"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </Button>
                        <Can permission="messages.delete">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await mutateDeleteMessage({ data: { id: selectedMessage.id } });
                                toast.success("Message deleted");
                                setSelectedMessage(null);
                                contactMessagesQuery.refetch();
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to delete message",
                                );
                              }
                            }}
                            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </Can>
                      </div>

                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!replyText.trim()) {
                            toast.error(
                              messageReplyInternal
                                ? "Please enter a note."
                                : "Please enter a reply message.",
                            );
                            return;
                          }
                          const msg = replyText.trim();
                          setReplyText("");
                          try {
                            await mutateReplyMessage({
                              data: {
                                message_id: selectedMessage.id,
                                email: selectedMessage.email,
                                message: msg,
                                is_internal: messageReplyInternal,
                              },
                            } as any);
                            toast.success(
                              messageReplyInternal
                                ? "Internal note saved"
                                : `Reply sent to ${selectedMessage.email}`,
                            );
                            setMessageReplyInternal(false);
                            contactMessagesQuery.refetch();
                            contactMessageRepliesQuery.refetch();
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Failed to send reply",
                            );
                          }
                        }}
                        className={
                          messageReplyInternal
                            ? "bg-amber-600 hover:bg-amber-700 text-white gap-2"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                        }
                      >
                        {messageReplyInternal ? (
                          <>
                            <Lock className="h-4 w-4" />
                            Save Internal Note
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send Reply &amp; Email Customer
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="No message selected"
                  description="Choose an inquiry from the inbox to read and respond."
                  className="border-none py-20"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. SUPPORT TAB                                          */}
      {/* ======================================================== */}
      {activeTab === "support" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Technical Support Queue
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Engineering support, installation inquiries, and warranty tickets
              </p>
            </div>
            <Button
              onClick={() => setNewTicketDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Search ticket ID or client..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <select
              value={ticketPriorityFilter}
              onChange={(e) => setTicketPriorityFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Ticket</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Subject</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Assigned To</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTickets.map((t: any) => (
                    <tr
                      key={t.id}
                      className="hover:bg-muted/50/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedTicket(t)}
                    >
                      <td className="px-5 py-4 font-bold text-primary">{t.id}</td>
                      <td className="px-5 py-4 font-semibold text-foreground">
                        <div>{t.customer_name ?? t.customer}</div>
                        {t.customer_email ? (
                          <div className="text-xs text-muted-foreground font-normal">
                            {t.customer_email}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-foreground">{t.subject}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{t.category}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            t.priority === "Urgent"
                              ? "bg-rose-100 text-rose-700"
                              : t.priority === "High"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            t.status === "Resolved"
                              ? "bg-emerald-100 text-emerald-800"
                              : t.status === "In Progress"
                                ? "bg-primary/15 text-primary"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {t.assigned_to ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              t.assigned_to === user.user_id
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {t.assigned_to === user.user_id
                              ? "Assigned to You"
                              : t.assigned_name || "Assigned"}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await mutateAssignTicket({
                                  data: { ticket_id: Number(t.id), assigned_to: user.user_id },
                                });
                                toast.success(`Ticket #${t.id} assigned to you`);
                                supportTicketsQuery.refetch();
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to assign ticket",
                                );
                              }
                            }}
                            className="text-xs h-7 px-2 text-primary hover:bg-primary/10"
                          >
                            Assign to Me
                          </Button>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const newStatus = t.status === "Resolved" ? "In Progress" : "Resolved";
                            await mutateReplyTicket({
                              data: {
                                ticket_id: t.id,
                                customer_email:
                                  t.customer_email ??
                                  (t.customer?.includes?.("@") ? t.customer : undefined),
                                reply: `Ticket status updated to ${newStatus}`,
                              },
                            }).catch(() => {});
                            toast.success(`Ticket ${t.id} updated`);
                            supportTicketsQuery.refetch();
                          }}
                          className="text-xs"
                        >
                          {t.status === "Resolved" ? "Reopen" : "Mark Resolved"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ticket Replies Panel */}
          {selectedTicket && (
            <div className="mt-6 bg-card border border-border rounded-2xl p-6">
              <div className="flex justify-between mb-4">
                <h3 className="font-semibold">
                  Ticket #{selectedTicket.id} — {selectedTicket.subject}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)}>
                  ✕
                </Button>
              </div>
              <div className="space-y-2 mb-4">
                {(ticketRepliesQuery.data ?? ([] as any[])).map((r: any) => (
                  <div
                    key={r.id}
                    className={`p-3 rounded-lg mb-2 ${r.is_internal ? "bg-amber-50 border border-amber-200" : "bg-gray-50"}`}
                  >
                    {r.is_internal && (
                      <span className="text-xs font-semibold text-amber-700 mr-2">
                        Internal Note
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {r.sender_name} · {r.created_at}
                    </span>
                    <p className="mt-1 text-sm">{r.message}</p>
                  </div>
                ))}
                {((ticketRepliesQuery.data ?? []) as any[]).length === 0 && (
                  <p className="text-xs text-gray-400">No replies yet.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ticketReplyInternal}
                    onChange={(e) => setTicketReplyInternal(e.target.checked)}
                  />
                  Internal Note (not visible to customer)
                </Label>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply message..."
                  className="w-full rounded-xl border border-border p-3 text-sm"
                />
                <Button
                  onClick={async () => {
                    if (!replyText.trim()) {
                      toast.error("Enter a reply");
                      return;
                    }
                    try {
                      await mutateReplyTicket({
                        data: {
                          ticket_id: String(selectedTicket.id),
                          customer_email: selectedTicket.customer_email,
                          reply: replyText.trim(),
                          is_internal: ticketReplyInternal,
                        },
                      } as any);
                      toast.success("Reply sent");
                      setReplyText("");
                      ticketRepliesQuery.refetch();
                      supportTicketsQuery.refetch();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  Send Reply
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. REPORTS TAB                                         */}
      {/* ======================================================== */}
      {activeTab === "reports" &&
        (!hasPermission("reports.view") ? (
          <NotAuthorized
            userRole={user?.role}
            message="Reports are restricted to authorized users."
          />
        ) : (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {canViewRevenue ? "Analytics & Sales Reports" : "Operational Reports"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {canViewRevenue
                    ? "Date-range reports on delivered revenue, top products, and more"
                    : "Date-range reports on order volume, fulfillment, and product sales counts"}
                </p>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Label className="text-sm">From</Label>
                <Input
                  type="date"
                  value={reportStart}
                  onChange={(e) => setReportStart(e.target.value)}
                  className="w-36"
                />
                <Label className="text-sm">To</Label>
                <Input
                  type="date"
                  value={reportEnd}
                  onChange={(e) => setReportEnd(e.target.value)}
                  className="w-36"
                />
                <Button
                  onClick={async () => {
                    setReportLoading(true);
                    try {
                      setReportData(
                        await fetchSalesReport({
                          data: { startDate: reportStart, endDate: reportEnd },
                        } as any),
                      );
                    } catch (e: any) {
                      toast.error(e.message);
                    } finally {
                      setReportLoading(false);
                    }
                  }}
                  disabled={reportLoading}
                >
                  {reportLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Run Report"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!reportData) {
                      toast.error("Run report first");
                      return;
                    }
                    const w = window.open("", "_blank");
                    if (!w) return;
                    const html = document.querySelector(".space-y-8")?.outerHTML || "";
                    w.document.write(
                      `<!DOCTYPE html><html><head><title>Report ${reportStart} to ${reportEnd}</title><style>body{font-family:sans-serif;padding:32px;max-width:1000px;margin:auto}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f3f4f6}h1{color:#0ea5e9}.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}.kpi>div{border:1px solid #e5e7eb;padding:16px;border-radius:8px}@media print{button{display:none!important}.no-print{display:none!important}}</style></head><body><h1>${canViewRevenue ? "Analytics Report" : "Operational Report"}</h1><p>Date Range: ${reportStart} to ${reportEnd}</p>${html}<script>window.print();<\/script></body></html>`,
                    );
                    w.document.close();
                  }}
                  className="gap-1.5"
                >
                  <FileText className="w-4 h-4" /> Print PDF
                </Button>
              </div>
            </div>
            {!reportData && !reportLoading && (
              <EmptyState
                icon={BarChart2}
                title="No report generated"
                description="Select a date range and click Run Report to generate the report."
              />
            )}
            {reportData && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold text-muted-foreground">Total Orders</p>
                    <p className="text-3xl font-bold text-foreground mt-1.5">
                      {reportData.summary?.total_orders ?? 0}
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                    <p className="text-xs font-semibold text-muted-foreground">Delivered Orders</p>
                    <p className="text-3xl font-bold text-foreground mt-1.5">
                      {reportData.summary?.delivered_orders ?? 0}
                    </p>
                  </div>
                  {canViewRevenue ? (
                    <>
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                        <p className="text-xs font-semibold text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-foreground mt-1.5">
                          {etb(reportData.summary?.total_revenue ?? 0)}
                        </p>
                      </div>
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                        <p className="text-xs font-semibold text-muted-foreground">Delivered Revenue</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1.5">
                          {etb(reportData.summary?.delivered_revenue ?? 0)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                        <p className="text-xs font-semibold text-muted-foreground">Pending Orders</p>
                        <p className="text-3xl font-bold text-foreground mt-1.5">
                          {pendingOrderCount}
                        </p>
                      </div>
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                        <p className="text-xs font-semibold text-muted-foreground">Low Stock Items</p>
                        <p className="text-3xl font-bold text-amber-600 mt-1.5">
                          {lowStockCount}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Daily Revenue Chart — Admin Only */}
                {canViewRevenue && (
                  <div className="bg-white rounded-xl border p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold">Daily Revenue (Delivered)</h3>
                      <Can permission="reports.export">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            fetchExportReportCSV({
                              data: { type: "sales", startDate: reportStart, endDate: reportEnd },
                            } as any).then((r: any) => {
                              downloadCsv(r.csv, r.filename ?? "report.csv");
                            })
                          }
                        >
                          <Download className="w-3 h-3 mr-1" />
                          CSV
                        </Button>
                      </Can>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={reportData.daily ?? []}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => etb(Number(v))} />
                        <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top 10 Products Table */}
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Top 10 Products</h3>
                    <Can permission="reports.export">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          fetchExportReportCSV({
                            data: { type: "products", startDate: reportStart, endDate: reportEnd },
                          } as any).then((r: any) => {
                            downloadCsv(r.csv, r.filename ?? "products.csv");
                          })
                        }
                      >
                        <Download className="w-3 h-3 mr-1" />
                        CSV
                      </Button>
                    </Can>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Qty Sold</th>
                          {canViewRevenue && <th className="px-4 py-3">Revenue</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(reportData.top_products ?? []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={canViewRevenue ? 3 : 2}
                              className="py-6 text-center text-muted-foreground/60 text-sm"
                            >
                              No delivered orders in this period.
                            </td>
                          </tr>
                        ) : (
                          (reportData.top_products ?? []).map((p: any, i: number) => (
                            <tr key={i}>
                              <td className="px-4 py-3">{p.product_name}</td>
                              <td className="px-4 py-3">{p.qty}</td>
                              {canViewRevenue && (
                                <td className="px-4 py-3 font-semibold">{etb(p.revenue)}</td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className={`grid grid-cols-1 ${canViewRevenue ? "md:grid-cols-2" : ""} gap-6`}>
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="font-semibold mb-3">Orders by Status</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={reportData.by_status ?? []}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ status }: any) => status}
                        >
                          {(reportData.by_status ?? []).map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {canViewRevenue && (
                    <div className="bg-white rounded-xl border p-4">
                      <h3 className="font-semibold mb-3">Revenue by Category</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={reportData.by_category ?? []}>
                          <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => etb(Number(v))} />
                          <Bar dataKey="revenue" fill="#6366f1" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Quote Conversion Metrics */}
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold mb-3">Quote Conversion</h3>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-3xl font-bold">{reportData.quotes?.total ?? 0}</p>
                      <p className="text-xs text-gray-500">Total Quotes</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-green-600">
                        {reportData.quotes?.accepted ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">Accepted</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-blue-600">
                        {reportData.quotes?.converted ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">Converted</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">
                        {(reportData.quotes?.total ?? 0) > 0
                          ? Math.round(
                              ((reportData.quotes?.accepted ?? 0) / reportData.quotes.total) * 100,
                            )
                          : 0}
                        %
                      </p>
                      <p className="text-xs text-gray-500">Acceptance Rate</p>
                    </div>
                  </div>
                </div>

                {/* Low Stock Items Table */}
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Low Stock Items</h3>
                    <Can permission="reports.export">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          fetchExportReportCSV({
                            data: { type: "low_stock", startDate: reportStart, endDate: reportEnd },
                          } as any).then((r: any) => {
                            downloadCsv(r.csv, r.filename ?? "low_stock.csv");
                          })
                        }
                      >
                        <Download className="w-3 h-3 mr-1" />
                        CSV
                      </Button>
                    </Can>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm text-left">
                      <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Stock</th>
                          <th className="px-4 py-3">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-border">
                        {(reportData.low_stock ?? []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-6 text-center text-muted-foreground/60 text-sm"
                            >
                              No low-stock items.
                            </td>
                          </tr>
                        ) : (
                          (reportData.low_stock ?? []).map((p: any, i: number) => (
                            <tr key={i}>
                              <td className="px-4 py-3">{p.name}</td>
                              <td className="px-4 py-3">
                                <span className="text-red-600 font-semibold">{p.stock}</span>
                              </td>
                              <td className="px-4 py-3">{p.category}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

      {/* ======================================================== */}
      {/* 11. AUDIT LOGS TAB                                      */}
      {/* ======================================================== */}
      {activeTab === "audit-logs" &&
        (!hasPermission("audit.view") ? (
          <NotAuthorized
            userRole={user?.role}
            message="System audit logs and compliance records are restricted to administrators."
          />
        ) : (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  System Audit Logs
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Security traceability, catalog changes, and administrative actions
                </p>
              </div>
              <select
                value={logCategoryFilter}
                onChange={(e) => setLogCategoryFilter(e.target.value)}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
              >
                <option value="all">All Event Categories</option>
                <option value="Orders">Orders</option>
                <option value="Catalog">Catalog</option>
                <option value="Inventory">Inventory</option>
                <option value="Quotes">Quotes</option>
              </select>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4">Timestamp</th>
                      <th className="px-5 py-4">Actor</th>
                      <th className="px-5 py-4">Action</th>
                      <th className="px-5 py-4">Entity Type</th>
                      <th className="px-5 py-4">Entity ID</th>
                      <th className="px-5 py-4">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-muted-foreground/60 text-sm"
                        >
                          No audit log entries found.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-muted/50/60 transition-colors">
                          <td className="px-5 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {String(log.created_at ?? "").slice(0, 19)}
                          </td>
                          <td className="px-5 py-4 font-semibold text-foreground">
                            {log.actor_name ?? "System"}
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                            {log.entity_type}
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            #{log.entity_id}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={() =>
                                setAuditChangesId(auditChangesId === log.id ? null : log.id)
                              }
                            >
                              {auditChangesId === log.id ? "Hide" : "View"}
                            </button>
                            {auditChangesId === log.id && (
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                <div className="bg-rose-50 rounded p-2 border border-rose-100 font-mono whitespace-pre-wrap break-all">
                                  <p className="font-semibold text-rose-700 mb-1">Before</p>
                                  {log.old_values
                                    ? JSON.stringify(
                                        typeof log.old_values === "string"
                                          ? JSON.parse(log.old_values)
                                          : log.old_values,
                                        null,
                                        2,
                                      )
                                    : "—"}
                                </div>
                                <div className="bg-emerald-50 rounded p-2 border border-emerald-100 font-mono whitespace-pre-wrap break-all">
                                  <p className="font-semibold text-emerald-700 mb-1">After</p>
                                  {log.new_values
                                    ? JSON.stringify(
                                        typeof log.new_values === "string"
                                          ? JSON.parse(log.new_values)
                                          : log.new_values,
                                        null,
                                        2,
                                      )
                                    : "—"}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}

      {/* ======================================================== */}
      {/* 12. SETTINGS TAB                                        */}
      {/* ======================================================== */}
      {activeTab === "settings" &&
        (!hasPermission("settings.view") ? (
          <NotAuthorized
            userRole={user?.role}
            message="Access Denied - Administrator privilege required."
          />
        ) : (
          <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {isStaff ? "My Profile" : "Admin & Business Settings"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isStaff
                  ? "Update your personal profile and account credentials"
                  : "Configure company details, team members, and alert rules"}
              </p>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-border gap-4">
              {!isStaff && (
                <>
                  <button
                    onClick={() => setSettingsSubTab("company")}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                      settingsSubTab === "company"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Company Settings
                  </button>
                  <button
                    onClick={() => setSettingsSubTab("team")}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                      settingsSubTab === "team"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Team Management
                  </button>
                </>
              )}
              <button
                onClick={() => setSettingsSubTab("profile")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  settingsSubTab === "profile"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                My Profile
              </button>
            </div>

            {!isStaff && settingsSubTab === "company" ? (
              <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
                <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
                  Company & Factory Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Company Name
                    </Label>
                    <Input
                      value={settingsData.companyName}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, companyName: e.target.value })
                      }
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Support Email
                    </Label>
                    <Input
                      value={settingsData.supportEmail}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, supportEmail: e.target.value })
                      }
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Contact Phone
                    </Label>
                    <Input
                      value={settingsData.phone}
                      onChange={(e) => setSettingsData({ ...settingsData, phone: e.target.value })}
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Default Currency
                    </Label>
                    <Input
                      value={settingsData.currency}
                      disabled
                      className="bg-muted text-muted-foreground"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Physical Address
                    </Label>
                    <Input
                      value={settingsData.address}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, address: e.target.value })
                      }
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <h3 className="font-bold text-base text-foreground border-b border-border pb-3 pt-2">
                  Notifications & Inventory Alerts
                </h3>

                <div className="space-y-4 text-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsData.emailOrderNotify}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, emailOrderNotify: e.target.checked })
                      }
                      className="h-4 w-4 rounded text-primary focus:ring-sky-500"
                    />
                    <span className="text-muted-foreground font-medium">
                      Send email notification when an order is submitted
                    </span>
                  </label>

                  <div className="flex items-center justify-between max-w-sm pt-2">
                    <span className="text-muted-foreground font-medium">
                      Low stock warning threshold:
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={settingsData.lowStockThreshold}
                        onChange={(e) =>
                          setSettingsData({
                            ...settingsData,
                            lowStockThreshold: Number(e.target.value) || 5,
                          })
                        }
                        className="w-20 text-center h-8"
                      />
                      <span className="text-xs text-muted-foreground">units</span>
                    </div>
                  </div>
                </div>

                <h3 className="font-bold text-base text-foreground border-b border-border pb-3 pt-4">
                  SMTP Email Configuration
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Password is encrypted at rest using AES-256-GCM. Leave password blank to keep
                  existing.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">SMTP Host</Label>
                    <Input
                      value={settingsData.smtpHost}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, smtpHost: e.target.value })
                      }
                      placeholder="smtp.example.com"
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">SMTP Port</Label>
                    <Input
                      type="number"
                      value={settingsData.smtpPort}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, smtpPort: e.target.value })
                      }
                      className="w-24 bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      SMTP Username
                    </Label>
                    <Input
                      value={settingsData.smtpUser}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, smtpUser: e.target.value })
                      }
                      placeholder="smtp_user"
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      From Email
                    </Label>
                    <Input
                      value={settingsData.smtpFrom}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, smtpFrom: e.target.value })
                      }
                      placeholder="noreply@polarfiber.et"
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      SMTP Password
                    </Label>
                    <Input
                      type="password"
                      value={settingsData.smtpPassword}
                      onChange={(e) =>
                        setSettingsData({ ...settingsData, smtpPassword: e.target.value })
                      }
                      placeholder="•••••••• (leave blank to keep current)"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button
                    onClick={async () => {
                      try {
                        const updates: Array<{ key: string; value: string }> = [
                          {
                            key: "company_name",
                            value: companyForm["company_name"] ?? settingsData.companyName,
                          },
                          {
                            key: "support_email",
                            value: companyForm["support_email"] ?? settingsData.supportEmail,
                          },
                          {
                            key: "company_phone",
                            value: companyForm["company_phone"] ?? settingsData.phone,
                          },
                          {
                            key: "company_address",
                            value: companyForm["company_address"] ?? settingsData.address,
                          },
                          {
                            key: "vat_rate",
                            value: String(companyForm["vat_rate"] ?? settingsData.vatRate),
                          },
                          { key: "delivery_fee", value: String(companyForm["delivery_fee"] ?? 0) },
                          {
                            key: "low_stock_threshold",
                            value: String(settingsData.lowStockThreshold),
                          },
                          { key: "smtp_host", value: settingsData.smtpHost },
                          { key: "smtp_port", value: settingsData.smtpPort },
                          { key: "smtp_user", value: settingsData.smtpUser },
                          { key: "smtp_from", value: settingsData.smtpFrom },
                        ];
                        if (settingsData.smtpPassword.trim()) {
                          updates.push({ key: "smtp_password", value: settingsData.smtpPassword });
                        }
                        for (const { key, value } of updates) {
                          await mutateCompanySetting({ data: { key, value } });
                        }
                        toast.success("Settings saved successfully!");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to save settings");
                      }
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Settings
                  </Button>
                </div>
              </div>
            ) : !isStaff && settingsSubTab === "team" ? (
              <div className="space-y-6">
                {/* Invite Staff Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="font-bold text-base text-foreground">Add New Staff Member</h3>
                      <p className="text-xs text-muted-foreground">
                        Staff accounts will be required to change their temporary password upon
                        first login.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Full Name *</Label>
                      <Input
                        placeholder="e.g. Samuel Desta"
                        value={newTeamMember.name}
                        onChange={(e) =>
                          setNewTeamMember({ ...newTeamMember, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Email Address *</Label>
                      <Input
                        type="email"
                        placeholder="staff@polarfiber.com"
                        value={newTeamMember.email}
                        onChange={(e) =>
                          setNewTeamMember({ ...newTeamMember, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        placeholder="+251 911 000 000"
                        value={newTeamMember.phone}
                        onChange={(e) =>
                          setNewTeamMember({ ...newTeamMember, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Role *</Label>
                      <select
                        value={newTeamMember.role}
                        onChange={(e) =>
                          setNewTeamMember({
                            ...newTeamMember,
                            role: e.target.value as "staff" | "admin",
                          })
                        }
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="staff">Staff Member</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Temporary Password *</Label>
                        <button
                          type="button"
                          onClick={() => {
                            const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                            let pwd = "";
                            for (let i = 0; i < 10; i++) {
                              pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            setNewTeamMember({ ...newTeamMember, temporaryPassword: pwd });
                          }}
                          className="text-xs text-primary hover:underline font-medium cursor-pointer"
                        >
                          Generate Secure Password
                        </button>
                      </div>
                      <Input
                        type="text"
                        placeholder="Temporary password (min 6 characters)"
                        value={newTeamMember.temporaryPassword}
                        onChange={(e) =>
                          setNewTeamMember({ ...newTeamMember, temporaryPassword: e.target.value })
                        }
                      />
                      {newTeamMember.temporaryPassword.length > 0 &&
                        newTeamMember.temporaryPassword.length < 6 && (
                          <p className="text-xs text-rose-500">
                            Password must be at least 6 characters.
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      disabled={
                        creatingMember ||
                        !newTeamMember.name.trim() ||
                        !newTeamMember.email.trim() ||
                        newTeamMember.temporaryPassword.length < 6
                      }
                      onClick={async () => {
                        setCreatingMember(true);
                        try {
                          await mutateCreateTeamMember({
                            data: {
                              name: newTeamMember.name.trim(),
                              email: newTeamMember.email.trim(),
                              phone: newTeamMember.phone.trim(),
                              role: newTeamMember.role,
                              temporaryPassword: newTeamMember.temporaryPassword,
                            },
                          });
                          toast.success(`Staff account for ${newTeamMember.name} created!`);
                          setNewTeamMember({
                            name: "",
                            email: "",
                            phone: "",
                            role: "staff",
                            temporaryPassword: "",
                          });
                          customersQuery.refetch();
                        } catch (err) {
                          let rawMsg =
                            err instanceof Error ? err.message : "Failed to create team member";
                          try {
                            const parsed = JSON.parse(rawMsg);
                            if (Array.isArray(parsed) && parsed[0]?.message) {
                              rawMsg = parsed.map((p) => p.message).join(", ");
                            }
                          } catch {}
                          toast.error(rawMsg);
                        } finally {
                          setCreatingMember(false);
                        }
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      {creatingMember ? "Creating..." : "Create Staff Account"}
                    </Button>
                  </div>
                </div>

                {/* Team Members List */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
                    Active Team Members & Roles
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {allCustomers
                          .filter((c) => c.role === "admin" || c.role === "staff")
                          .map((m) => (
                            <tr key={m.user_id}>
                              <td className="px-4 py-3 font-semibold text-foreground">{m.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                                    m.role === "admin"
                                      ? "bg-primary/15 text-primary"
                                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  }`}
                                >
                                  {m.role}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-emerald-600 font-semibold">
                                Active
                              </td>
                              <td className="px-4 py-3 text-right">
                                {m.user_id !== user.user_id && (
                                  <div className="inline-flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => {
                                        setEditingTeamMember(m);
                                        setTeamMemberDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-3 w-3 mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                                      onClick={async () => {
                                        if (
                                          !window.confirm(
                                            `Deactivate ${m.name}? They will lose login access.`,
                                          )
                                        )
                                          return;
                                        try {
                                          await mutateDeactivateTeamMember({
                                            data: { user_id: m.user_id },
                                          } as any);
                                          toast.success(`${m.name} deactivated`);
                                          customersQuery.refetch();
                                        } catch (err) {
                                          toast.error(
                                            err instanceof Error ? err.message : "Failed",
                                          );
                                        }
                                      }}
                                    >
                                      Deactivate
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
                  <div>
                    <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
                      My Profile
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      Update your own name, email and phone. Password changes are scoped to your
                      account only.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Full Name</Label>
                      <Input
                        value={profileForm.name ?? user?.name ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Email Address</Label>
                      <Input
                        type="email"
                        value={profileForm.email ?? user?.email ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        value={profileForm.phone ?? user?.phone ?? ""}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Role</Label>
                      <Input
                        value={user?.role === "staff" ? "Staff Member" : "Administrator"}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end">
                    <Button
                      onClick={async () => {
                        const name = (profileForm.name ?? "").trim();
                        const email = (profileForm.email ?? "").trim();
                        if (!name || !email) {
                          toast.error("Name and email are required.");
                          return;
                        }
                        try {
                          await mutateUpdateAdminProfile({
                            data: {
                              name,
                              email,
                              phone: (profileForm.phone ?? "").trim(),
                            },
                          });
                          toast.success("Profile updated successfully!");
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Failed to update profile",
                          );
                        }
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Profile
                    </Button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
                  <div>
                    <h3 className="font-bold text-base text-foreground border-b border-border pb-3">
                      Change Password
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2">
                      Minimum 8 characters. You must confirm your current password first.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Current Password</Label>
                      <Input
                        type="password"
                        value={profileForm.currentPassword}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, currentPassword: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">New Password</Label>
                      <Input
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, newPassword: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Confirm New Password</Label>
                      <Input
                        type="password"
                        value={profileForm.confirmPassword}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, confirmPassword: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end">
                    <Button
                      variant="outline"
                      disabled={
                        !profileForm.currentPassword ||
                        !profileForm.newPassword ||
                        profileForm.newPassword !== profileForm.confirmPassword
                      }
                      onClick={async () => {
                        if (profileForm.newPassword !== profileForm.confirmPassword) {
                          toast.error("New passwords do not match.");
                          return;
                        }
                        if (profileForm.newPassword.length < 8) {
                          toast.error("New password must be at least 8 characters.");
                          return;
                        }
                        try {
                          await mutateChangePassword({
                            data: {
                              currentPassword: profileForm.currentPassword,
                              newPassword: profileForm.newPassword,
                            },
                          });
                          toast.success("Password changed successfully!");
                          setProfileForm({
                            name: profileForm.name,
                            email: profileForm.email,
                            phone: profileForm.phone,
                            currentPassword: "",
                            newPassword: "",
                            confirmPassword: "",
                          });
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Failed to change password",
                          );
                        }
                      }}
                      className="gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Update Password
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

      {/* ======================================================== */}
      {/* MODALS & DRAWERS                                         */}
      {/* ======================================================== */}

      {/* Order Details Drawer */}{/* Order Details Drawer */}
      <OrderDrawer
        order={selectedOrder}
        open={orderDrawerOpen}
        onOpenChange={setOrderDrawerOpen}
        mode="admin"
        onStatusChange={handleOrderStatusChange}
        statusUpdating={statusUpdating}
        onAddNote={async (orderId, note) => {
          try {
            await mutateAddOrderNote({ data: { order_id: orderId, note } });
            toast.success("Internal note added");
            // The drawer keeps its own note list query and refetches it itself.
            await ordersQuery.refetch();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to add internal note");
          }
        }}
        onDispatch={handleDispatchOrder}
        onCompleteDelivery={handleCompleteDelivery}
      />

      {/* Mark Paid Modal */}
      {markPaidOrderId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-foreground">
              Mark Order #{markPaidOrderId} as Paid
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Method</Label>
              <select
                value={markPaidMethod}
                onChange={(e) => setMarkPaidMethod(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cash_on_delivery">Cash on Delivery</option>
                <option value="cheque">Cheque</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setMarkPaidOrderId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={markingPaid}
                onClick={async () => {
                  setMarkingPaid(true);
                  try {
                    await mutateMarkOrderPaid({
                      data: { order_id: markPaidOrderId, payment_method: markPaidMethod },
                    } as any);
                    toast.success(`Order #${markPaidOrderId} marked as paid`);
                    setMarkPaidOrderId(null);
                    await ordersQuery.refetch();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to mark paid");
                  } finally {
                    setMarkingPaid(false);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {markingPaid ? "Saving…" : "Confirm Payment"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Order Actions Panel (Print Invoice + Mark Paid trigger) */}
      {orderDrawerOpen && selectedOrder && (
        <div className="fixed bottom-4 right-4 z-40 bg-white border rounded-xl shadow-lg p-4 space-y-3 w-72">
          <p className="text-xs font-semibold text-gray-500">
            Order #{selectedOrder.order_id} Actions
          </p>
          <Can permission="orders.mark_paid">
            {!(selectedOrder as any).is_paid && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => setMarkPaidOrderId(selectedOrder.order_id)}
              >
                <CreditCard className="w-4 h-4" />
                Mark as Paid
              </Button>
            )}
          </Can>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5"
            onClick={() => {
              const w = window.open("", "_blank");
              if (!w || !selectedOrder) return;
              w.document.write(
                `<!DOCTYPE html><html><head><title>Invoice #${selectedOrder.order_id}</title><style>body{font-family:sans-serif;padding:32px;max-width:640px;margin:auto}h1{color:#0ea5e9}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f3f4f6}.total{font-weight:bold;font-size:18px}</style></head><body><h1>Polar Fiber Invoice</h1><p><strong>Order #${selectedOrder.order_id}</strong> &nbsp;|&nbsp; ${selectedOrder.created_at}</p><p><strong>Customer:</strong> ${selectedOrder.customer ?? "Guest"}</p><p><strong>Delivery Address:</strong> ${selectedOrder.address ?? ""}</p><p><strong>Payment:</strong> ${(selectedOrder as any).is_paid ? "Paid" : "Unpaid"} &mdash; ${(selectedOrder as any).payment_method ?? "&mdash;"}</p><table><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${(selectedOrder.items ?? []).map((i: any) => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${etb(i.unit_price)}</td><td>${etb(i.quantity * i.unit_price)}</td></tr>`).join("")}</tbody></table><p class="total" style="margin-top:16px">Total: ${etb(selectedOrder.total)}</p><script>window.print();<\/script></body></html>`,
              );
              w.document.close();
            }}
          >
            <FileText className="w-4 h-4" />
            Print Invoice
          </Button>
        </div>
      )}

      {/* Product Add/Edit Dialog */}
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        onSave={handleProductSave}
        loading={savingProduct}
      />

      {/* Delete Product Confirmation */}
      <ConfirmDialog
        open={confirmDeleteDialogOpen}
        onOpenChange={setConfirmDeleteDialogOpen}
        title={`Archive "${deletingProduct?.name}"?`}
        description="This will soft-delete the product — it will no longer appear in the store or inventory, but its order history is preserved."
        confirmLabel="Archive Product"
        variant="destructive"
        onConfirm={handleProductDelete}
      />

      {/* New Support Ticket Dialog */}
      {newTicketDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-foreground">Create Support Ticket</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Client Name *</Label>
                <Input
                  value={newTicketData.customer}
                  onChange={(e) => setNewTicketData({ ...newTicketData, customer: e.target.value })}
                  placeholder="e.g. Heineken Breweries SC"
                />
              </div>
              <div>
                <Label className="text-xs">Client Email (Optional)</Label>
                <Input
                  type="email"
                  value={newTicketData.customer_email}
                  onChange={(e) =>
                    setNewTicketData({ ...newTicketData, customer_email: e.target.value })
                  }
                  placeholder="e.g. contact@client.com"
                />
              </div>
              <div>
                <Label className="text-xs">Issue Subject *</Label>
                <Input
                  value={newTicketData.subject}
                  onChange={(e) => setNewTicketData({ ...newTicketData, subject: e.target.value })}
                  placeholder="e.g. Tank nozzle flange replacement"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select
                  value={newTicketData.category}
                  onChange={(e) =>
                    setNewTicketData({
                      ...newTicketData,
                      category: e.target.value as any,
                    })
                  }
                  className="w-full h-10 rounded-lg border border-border px-3 text-sm"
                >
                  <option value="Technical Specs">Technical Specs</option>
                  <option value="Installation">Installation</option>
                  <option value="Warranty">Warranty</option>
                  <option value="Custom Fabrication">Custom Fabrication</option>
                  <option value="General">General</option>
                  <option value="Billing">Billing</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <select
                  value={newTicketData.priority}
                  onChange={(e) =>
                    setNewTicketData({
                      ...newTicketData,
                      priority: e.target.value as DBSupportTicket["priority"],
                    })
                  }
                  className="w-full h-10 rounded-lg border border-border px-3 text-sm"
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Initial Message / Notes (Optional)</Label>
                <textarea
                  value={newTicketData.message}
                  onChange={(e) => setNewTicketData({ ...newTicketData, message: e.target.value })}
                  placeholder="Describe the issue or initial details..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setNewTicketDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!newTicketData.customer.trim() || !newTicketData.subject.trim()) {
                    toast.error("Please fill in client name and subject.");
                    return;
                  }
                  const emailTrimmed = newTicketData.customer_email.trim();
                  if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
                    toast.error("Please enter a valid email address or leave it blank.");
                    return;
                  }
                  try {
                    await mutateCreateSupportTicket({
                      data: {
                        customer_name: newTicketData.customer.trim(),
                        customer_email: emailTrimmed,
                        subject: newTicketData.subject.trim(),
                        category: newTicketData.category,
                        priority: newTicketData.priority,
                        message: newTicketData.message.trim(),
                      },
                    } as any);
                    toast.success("Support ticket created");
                    setNewTicketDialogOpen(false);
                    setNewTicketData({
                      customer: "",
                      customer_email: "",
                      subject: "",
                      category: "Technical Specs",
                      priority: "Normal",
                      message: "",
                    });
                    supportTicketsQuery.refetch();
                  } catch (e: any) {
                    let errMsg = e?.message || "Failed to create support ticket";
                    try {
                      const parsed = JSON.parse(errMsg);
                      if (Array.isArray(parsed) && parsed[0]?.message) {
                        errMsg = parsed[0].message;
                      }
                    } catch {
                      // ignore parse error
                    }
                    toast.error(errMsg);
                  }
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Team Member Dialog */}
      {teamMemberDialogOpen && editingTeamMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg">Edit Team Member</h3>
            <EditTeamMemberForm
              member={editingTeamMember}
              onClose={() => {
                setTeamMemberDialogOpen(false);
                setEditingTeamMember(null);
              }}
              onSave={async (payload: any) => {
                try {
                  await mutateEditTeamMember({ data: payload } as any);
                  toast.success(`${payload.name} updated`);
                  setTeamMemberDialogOpen(false);
                  setEditingTeamMember(null);
                  customersQuery.refetch();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to update");
                }
              }}
            />
          </div>
        </div>
      )}
    </AdminSidebarLayout>
  );
}
