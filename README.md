# Polar Fiber — E-Commerce & Operations Management Platform

A modern, full-stack web application and operations management platform for **Polar Fiber** (Addis Ababa, Ethiopia) — manufacturers of rotomolded and blow-molded food-grade water tankers with a 10-year warranty, fiber pipes, flower pots, and roofing sheets.

Built with **TanStack Start**, **React 19**, **Vite**, **Tailwind CSS v4**, and backed by **Aiven Cloud MySQL 8**.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Order Lifecycle State Machine](#-order-lifecycle-state-machine)
- [Customer Conversation Portal](#-customer-conversation-portal)
- [Project Structure](#-project-structure)
- [Database & Schema](#-database--schema)
- [Authentication & Security](#-authentication--security)
- [API & Server Functions](#-api--server-functions)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Database Setup & Seeding](#database-setup--seeding)
  - [Running the Development Server](#running-the-development-server)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Deployment & Build](#-deployment--build)

---

## 🌟 Overview

Polar Fiber delivers durable, food-grade water storage solutions engineered to endure extreme temperature variations (-10°C to 60°C) without cracking or warping. This platform provides:

1. **A public storefront & brand portal** mirroring the design, product line, and aesthetic of the official brand.
2. **An instant quotation engine** allowing potential customers to submit project specifications and inquiries directly from any page.
3. **A complete e-commerce workflow** featuring client-side cart management and tamper-proof server-side order calculations in Ethiopian Birr (ETB).
4. **Self-service order tracking (`/order-tracking`)** for customers to verify live progress, delivery details, and item statuses using their order reference code and security credentials.
5. **Customer conversation links (`/conversation/$token`)** providing secure, expiring, direct-access inquiry and quote response portals for guest clients without requiring an account.
6. **A complete Staff Console & Administrative Suite (`/admin`)** providing role-tailored management across 11 key operational modules:
   - **Overview**: Live counters with working filter links; financial revenue cards masked for staff.
   - **Products**: Multi-image uploads and catalog management; price and SKU are read-only for staff; product deletion is restricted to administrators.
   - **Categories**: Category listing and product association; category mutations are admin-restricted.
   - **Inventory**: Real-time stock levels, low-stock warnings, mandatory reason audit tracking on all adjustments, and negative stock prevention.
   - **Orders**: Enforces sequential lifecycle progression (`Pending` ➔ `Confirmed` ➔ `In Production` ➔ `Out for Delivery` ➔ `Delivered`), internal confidential notes, and customer email alerts.
   - **Quotes**: Quote inquiry viewer, custom response amounts, validity terms, and admin-only conversion to orders.
   - **Customers**: Unified directory with related orders, quotes, and inquiry messages; financial totals masked for staff.
   - **Messages**: Direct conversation threads, internal staff notes, customer lookup tokens, and linked order/quote references.
   - **Support**: Multi-priority ticket management with staff assignment and private internal notes.
   - **Reports**: Role-tailored reporting — staff receives operational metrics (counts, delivery rate, low stock); admin receives sales revenue, category breakdowns, and CSV export tools.
   - **Settings**: Staff profile management and mandatory first-login password changes, with business details, team management, and SMTP configuration restricted to administrators.

---

## ✨ Key Features

### 🛒 Customer & Public Experience

- **Hero & Instant Quote**: Rapid quote request form integrated directly into the homepage banner and dedicated quote route (`/quote`).
- **Product Catalog (`/products`)**: Browse water tankers (500L to 25,000L), garden flower pots, fiber roof sheets, and fiber pipes with live pricing, stock availability, and image previews.
- **Product Details (`/products/$id`)**: Deep-dive product specifications (capacity, food-grade LLDPE material info, UV stabilization, price, and descriptions).
- **Persistent Shopping Cart (`/cart`)**: Local browser-persisted cart state with item quantity adjustments and instant ETB total calculations.
- **Secure Checkout & Order Placement**: Orders are placed with delivery address validation; order pricing is strictly re-computed against the live database on the server to prevent client-side price tampering.
- **Order Confirmation (`/order-confirmation`)**: Instant receipt with access pass for easy post-checkout tracking.
- **Self-Service Order Tracking (`/order-tracking`)**: Customers track live order fulfillment stages with order reference code and security credentials.
- **Customer Inquiry Portal (`/conversation/$token`)**: Cryptographically signed access links allowing guest customers to view staff responses and reply directly.

### 🛡️ Administrative & Staff Console (`/admin`)

- **Role-Tailored Dashboards**: Granular capability model distinguishing full Administrators from Operational Staff.
- **Financial Masking**: Staff members see operational volume metrics (order counts, fulfillment rates, low stock items) while sales revenue, grand totals, and customer financial lifetime values remain strictly hidden.
- **Guided Order Progression**: Intuitive step-by-step buttons ("Confirm Order", "Start Production", "Dispatch", "Complete Delivery") that prevent invalid out-of-order state transitions.
- **Audit & Compliance**: Mandatory reasons required for every inventory change; immutable system audit log for security-sensitive operations.
- **Secure Team Management**: Temporary password generator with automated expiration and mandatory change-on-first-login enforcement.

---

## 🏗️ Architecture & Tech Stack

| Layer             | Technology                                                                 | Description                                                           |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Framework**     | [TanStack Start](https://tanstack.com/start) + [Vite](https://vitejs.dev/) | Full-stack SSR and server functions framework built for React 19      |
| **Routing**       | [TanStack Router](https://tanstack.com/router)                             | Type-safe file-based client and server routing                        |
| **State & Cache** | [TanStack Query](https://tanstack.com/query)                               | Server-state caching, invalidation, and data synchronization          |
| **Styling**       | [Tailwind CSS v4](https://tailwindcss.com/) + Vanilla CSS tokens           | Fast utility classes paired with branded design tokens                |
| **UI Components** | [Radix UI](https://www.radix-ui.com/) & Lucide React                       | Accessible, headless UI primitives and iconography                    |
| **Database**      | [Aiven Cloud MySQL 8](https://aiven.io/)                                   | Managed MySQL instance with strict SSL/TLS encryption                 |
| **Driver**        | `mysql2/promise`                                                           | Connection-per-request edge-compatible database driver                |
| **Validation**    | [Zod](https://zod.dev/)                                                    | Strict input parsing and schema verification on client and server     |
| **Auth**          | Custom HMAC-SHA256 Sessions                                                | HttpOnly server-signed session cookies with bcryptjs password hashing |
| **Testing**       | [Vitest](https://vitest.dev/) + React Testing Library                      | Unit, security, and component integration tests                       |

---

## 👥 Role-Based Access Control (RBAC)

The platform implements a strict permission model with distinct capabilities for **Administrators** and **Staff**:

| Capability / Section | Admin Role | Staff Role |
| :--- | :---: | :---: |
| **Financial Revenue & Sales Totals** | Full Access | Hidden / Masked |
| **Product Catalog Creation** | Allowed | Allowed (Price & SKU Read-Only) |
| **Product Price & SKU Editing** | Allowed | Read-Only |
| **Product Deletion** | Allowed | Hidden |
| **Category Creation, Edits & Deletion** | Allowed | Hidden / View-Only |
| **Order Status Workflow (Sequential)** | Allowed | Allowed |
| **Order Deletion & Refunds** | Allowed | Hidden |
| **Stock Adjustments (With Mandatory Reason)** | Allowed | Allowed |
| **Unlimited / High Stock Overrides** | Allowed | Hidden |
| **Quotes Inbox & Staff Responses** | Allowed | Allowed |
| **Convert Quote to Order** | Allowed | Hidden (Admin Only) |
| **Expire Overdue Quotes** | Allowed | Hidden (Admin Only) |
| **Customer Directory & Linked Records** | Full Data | Total Spent Hidden |
| **Customer Blocking & Data Export** | Allowed | Hidden |
| **Message Threading & Internal Notes** | Allowed | Allowed |
| **Support Ticket Queue & Assignment** | Allowed | Allowed |
| **Reports: Operational Metrics** | Full Access | Allowed |
| **Reports: Financial Analytics & CSV** | Full Access | Hidden |
| **Company Business & SMTP Settings** | Allowed | Hidden |
| **Team Management & Role Changes** | Allowed | Hidden |
| **My Profile & Password Self-Service** | Allowed | Allowed |

---

## 🔄 Order Lifecycle State Machine

Order state changes are strictly governed by [`shared/order-status.ts`](shared/order-status.ts) to guarantee business workflow integrity:

```
[ Pending ] ──► [ Confirmed ] ──► [ In Production ] ──► [ Out for Delivery ] ──► [ Delivered ]
     │               │                   │
     ▼               ▼                   ▼
[ Cancelled ]   [ Cancelled ]       [ Cancelled ]
```

- **Stage Skipping Prohibited**: An order cannot jump directly from `Pending` to `In Production` or `Delivered`.
- **Cancellation Protection**: Cancellation is permitted from `Pending`, `Confirmed`, or `In Production`. Once an order is `Out for Delivery` or `Delivered`, cancellation is forbidden.
- **Stock Restoration**: Cancelling an order automatically restores inventory with row-level locks (`SELECT ... FOR UPDATE`).
- **Delivery Safeguard**: Marking an order `Delivered` requires either verified payment or confirmed Cash on Delivery.

---

## 💬 Customer Conversation Portal

Guest customers can securely view staff responses to their quotes and inquiries without account registration:

- **Cryptographic Tokens**: Generates 64-hex-character expiring tokens stored in `conversation_tokens`.
- **Private Staff Notes**: Internal staff notes (`is_internal = 1`) are strictly isolated and omitted from customer-facing endpoints.
- **Multi-Channel Sync**: Customer responses automatically update the staff console in real time and send email alerts.

---

## 📁 Project Structure

```
polarfiber/
├── backend/                  # Server-only execution layer (never exposed to browser)
│   ├── api.functions.ts      # TanStack Start server functions (auth, catalog, orders, quotes, admin)
│   ├── db.server.ts          # MySQL connection lifecycle & SSL PEM normalizer
│   ├── email.ts              # SMTP mail delivery and templating
│   ├── session.server.ts     # Cookie signing (HMAC-SHA256), timingSafeEqual verification & RBAC
│   ├── server.ts             # Framework server entry & error boundaries
│   ├── start.ts              # TanStack Start router middleware with CSRF protection
│   ├── error-capture.ts      # Structured server-side error capturing
│   └── error-page.ts         # Server-rendered error recovery pages
│
├── frontend/                 # Client UI application (React 19)
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # Base primitives (button, dialog, input, label, tabs, textarea, sonner)
│   │   ├── AdminDashboard.tsx# Comprehensive admin & staff operations suite
│   │   ├── AdminSidebarLayout.tsx # Navigation sidebar with permissions-aware routing
│   │   ├── Can.tsx           # Declarative RBAC permission gate component
│   │   ├── OrderDrawer.tsx   # Detailed order view, notes, audit, and sequential dispatch actions
│   │   ├── ProductCard.tsx   # Product display card with image and pricing
│   │   ├── ProductDialog.tsx # Product creation and editing modal (price/SKU locked for staff)
│   │   ├── QuoteForm.tsx     # Homepage and dedicated quote submission form
│   │   ├── SiteHeader.tsx    # Branded navigation header and footer
│   │   └── StatusBadge.tsx   # Visual status badge for orders and quotes
│   ├── routes/               # File-based routes (TanStack Router)
│   │   ├── __root.tsx        # Shell layout, QueryClientProvider, and global Toaster
│   │   ├── index.tsx         # Homepage with hero, quote form, about, and photo gallery
│   │   ├── about.tsx         # Company history, vision, and manufacturing standards
│   │   ├── products.index.tsx# Product catalog with category filter & sorting
│   │   ├── products.$id.tsx  # Product detail view
│   │   ├── cart.tsx          # Shopping cart & order placement
│   │   ├── order-confirmation.tsx # Post-checkout confirmation and access pass display
│   │   ├── order-tracking.tsx# Enhanced live order tracking with status milestones
│   │   ├── track-order.tsx   # Backward-compatible redirect to order-tracking
│   │   ├── conversation.$token.tsx # Token-authenticated customer messaging portal
│   │   ├── login.tsx         # Staff & Administrator portal sign-in
│   │   ├── admin.tsx         # Operations dashboard route
│   │   ├── quote.tsx         # Standalone quote request page
│   │   ├── contact.tsx       # Contact information, phone lines, and factory location
│   │   ├── faq.tsx           # Frequently asked questions
│   │   └── services.tsx      # Services, warranties, and custom manufacturing info
│   ├── routeTree.gen.ts      # Auto-generated TanStack route tree
│   ├── router.tsx            # Router factory initialization
│   ├── store.tsx             # Global client context (cart localStorage, current session user)
│   └── test/                 # Vitest test suites (16 test files, 101 tests)
│
├── shared/                   # Code shared across client and server
│   ├── data.ts               # TypeScript interfaces, constants, and ETB helper
│   ├── permissions.ts        # RBAC definitions (STAFF_PERMISSIONS, FORBIDDEN_STAFF_PERMISSIONS)
│   ├── order-access.ts       # Secure password hashing and verification for guest tracking
│   └── order-status.ts       # State transition rules and validation for orders
│
├── utils/                    # Helper utilities
│   ├── audit.ts              # System audit log recorders
│   ├── conversation-tokens.ts# Cryptographic token generator and validator
│   ├── notify.ts             # Email and operational notifications
│   ├── rate-limit.ts         # In-memory request rate limiting
│   ├── sanitize.ts           # Input sanitization and XSS prevention
│   └── stock.ts              # Inventory movement calculations
│
├── db/                       # Database migrations and scripts
│   ├── schema.sql            # Full MySQL DDL schema
│   ├── migrate.sql           # Incremental schema migration updates
│   ├── rollback.sql          # Safe rollback script
│   ├── migrate.mjs           # Automated migration runner
│   └── setup.mjs             # Database table creation and seeder script
│
├── public/                   # Static assets
│   ├── images/               # Branded product photography and hero imagery
│   └── favicon.ico           # Application favicon
│
├── .env                      # Local environment configuration (git-ignored)
├── package.json              # Dependencies and execution scripts
├── vite.config.ts            # Vite build configuration with TanStack Start plugin
├── vitest.config.ts          # Vitest testing configuration
└── tsconfig.json             # TypeScript compiler settings
```

---

## 🗄️ Database & Schema

The system uses an **Aiven Cloud MySQL 8** instance with a normalized relational schema:

1. **`users` & `user_roles`**: Administrative and staff accounts with bcrypt password hashes, active flags, and `must_change_password` first-login policy.
2. **`products` & `categories`**: Catalog items with capacity, pricing, stock, images, and category associations.
3. **`orders` & `order_items`**: Order records with customer contact, status, payment details, and line items.
4. **`order_access`**: Secure hashed guest access passes for order tracking without user registration.
5. **`order_status_history`**: Audit trail of order status progression with timestamps and staff user attribution.
6. **`order_deliveries`**: Delivery dispatch records, driver assignments, and delivery notes.
7. **`order_internal_notes`**: Confidential staff notes kept separate from customer-visible communication.
8. **`quote_requests` & `quote_replies`**: Inbound quote inquiries, price responses, validity terms, and customer threads.
9. **`conversation_tokens`**: Expiring cryptographic tokens for token-authenticated customer messaging.
10. **`stock_adjustments` & `stock_movements`**: Inventory adjustment requests with mandatory reasons and approvals.
11. **`contact_messages` & `contact_message_replies`**: Storefront inquiries and response threads.
12. **`support_tickets` & `support_ticket_replies`**: Structured customer support tickets with priority levels.
13. **`audit_logs`**: System audit records capturing administrative and staff actions.
14. **`app_settings`**: Key-value business configurations (company contact, VAT, staff quote thresholds).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm** or **bun**
- An active **MySQL 8** database (e.g., [Aiven Cloud MySQL](https://aiven.io/))

### Environment Variables

Create a `.env` file in the root directory:

```env
# Aiven MySQL Configuration
MYSQL_HOST=your-aiven-mysql-host.aivencloud.com
MYSQL_PORT=18349
MYSQL_USER=avnadmin
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=defaultdb

# Full Aiven CA Certificate (in PEM format or single line)
MYSQL_CA_CERT="-----BEGIN CERTIFICATE-----\nMIID...[CA CONTENT]...==\n-----END CERTIFICATE-----"

# Session Signing Key
SESSION_SECRET="your-cryptographically-secure-random-secret"

# Optional SMTP Mail Server Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=no-reply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=Polar Fiber <no-reply@example.com>
```

> **Note**: The application automatically normalizes multiline or collapsed PEM certificates via `normalizeCa()` in `backend/db.server.ts`.

### Database Setup & Seeding

Initialize the database tables and populate sample products:

```sh
# Run database migrations and seed catalog items
node db/setup.mjs

# Run incremental migrations (if updating an existing database)
node db/migrate.mjs
```

### Running the Development Server

Start the local development server with Vite hot-reloading:

```sh
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 🧪 Testing & Quality Assurance

The test suite includes 16 test files covering all 11 console modules, security gates, order transitions, and customer portals:

```sh
# Run full Vitest test suite (101 tests)
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📦 Deployment & Build

To build the application for production:

```sh
npm run build
```

The production output will be generated in the `.output/` directory, ready to deploy to Node.js environments or edge runtime platforms supporting TanStack Start.
