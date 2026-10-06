# AGENTS.md

## Project structure

```
polarfiber/
  backend/          ← server-only code (never sent to the browser)
    api.functions.ts
    db.server.ts
    session.server.ts
    error-capture.ts
    error-page.ts
    server.ts       ← SSR error-handling wrapper (framework entry point)
    start.ts        ← TanStack Start instance with CSRF & error middleware
  frontend/         ← React UI: components, routes, store, styles
    components/
    hooks/
    routes/
    router.tsx
    store.tsx
    styles.css
    utils.ts
  shared/           ← types used by both sides
    data.ts
  db/               ← MySQL schema and setup scripts
```

## Architecture rules

- Data lives in Aiven MySQL, reached only from server functions (`backend/api.functions.ts` → `db.server.ts`); schema in `db/schema.sql`, applied by `node db/setup.mjs`. Credentials must never reach the browser.
- MySQL connection opens per request and closes after. The edge server runtime cannot keep long-lived pools.
- Auth is a server-signed httpOnly cookie (HMAC with SESSION_SECRET), passwords hashed with bcryptjs. No third-party auth provider is used.
- Roles live in the separate `user_roles` table and are checked server-side on every admin call; the first registered account becomes admin. This prevents privilege escalation via profile edits.
- Order prices are recomputed from the database on the server. Browser-sent prices cannot be trusted.
- Cart is kept in browser localStorage only — it is pre-order scratch data.
- Public-page media is served from local public/images assets, and the homepage quote form calls the existing quote server function; no duplicate submission endpoint is introduced.

## Import conventions

| What you need | Import from |
|---|---|
| Shared types (Product, Order, etc.) | `@/shared/data` |
| Server functions / DB / session | `@/backend/api.functions`, `@/backend/db.server`, `@/backend/session.server` |
| React store | `@/frontend/store` |
| UI utilities (`cn`) | `@/frontend/utils` |
| UI components | `@/frontend/components/...` |
| Routes | `@/frontend/routes/...` |
