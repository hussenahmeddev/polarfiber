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

- Phase 1 data lives in a browser-only store (`src/lib/store.tsx`) seeded from `src/lib/data.ts`; field names mirror the planned MySQL schema so swapping to server functions is a drop-in replacement. Why: user chose "website first, database later".
- Demo auth/roles in the store are NOT secure; real auth and role checks must move server-side when the database is connected. Why: client-side role checks can be bypassed.
