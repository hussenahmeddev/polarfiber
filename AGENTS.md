<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

- Data lives in Aiven MySQL, reached only from server functions (`src/lib/api.functions.ts` → `db.server.ts`); schema in `db/schema.sql`, applied by `node db/setup.mjs`. Why: credentials must never reach the browser.
- MySQL connection opens per request and closes after. Why: the edge server runtime cannot keep long-lived pools.
- Auth is a server-signed httpOnly cookie (HMAC with SESSION_SECRET), passwords hashed with bcryptjs. Why: no third-party auth provider is used.
- Roles live in the separate `user_roles` table and are checked server-side on every admin call; the first registered account becomes admin. Why: prevent privilege escalation via profile edits.
- Order prices are recomputed from the database on the server. Why: browser-sent prices cannot be trusted.
- Cart is kept in browser localStorage only. Why: it is pre-order scratch data.
