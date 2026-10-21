# My Vault architecture

The deployed application is the supplied static Thai My Vault website in `site/`. Do not scaffold another framework or switch deployment to the unrelated TanStack app from the uploaded archive. The owner's explicit preference is to preserve the original design and menu set. This is a shared members-only vault using Netlify Identity. The current owner request requires signup and authentication before accessing any vault data.

- `site/index.html`: public Thai signup/login/recovery landing page. `site/auth.js` handles Identity callbacks.
- `private/vault.html`: original menu sections, collection forms, rendering, imports, exports, search and seed data. The main async initializer loads cloud data before running the original code.
- `site/cloud.js`: transient read cache and ordered write queue. `get` returns clones so callers cannot mutate the comparison baseline. Collection changes send record upserts/deletions, not full collection replacements. Errors retain the queue; the status bar provides retry and beforeunload guards against accidental loss. This cache is never durable storage.
- `site/manage.js`: accessible native dialog editor for existing records across all collections and JSON backup/restore (merge by ID). Editing waits for the write queue before refreshing the original views.
- `site/import-data.js`: original import parser shared by the converter and Collector.
- `site/navigation.js`: responsive and keyboard navigation from the supplied website.
- `netlify/functions/vault.mts`: database read and write endpoint. Allowed collection names are explicit. Row locks and record patches merge independent concurrent edits. Same-record edits are last writer wins. Seed flags also live in Postgres.
- `netlify/functions/files.mts`: file metadata in Postgres; binary data in strong-consistency Netlify Blobs. Upload uses chunks up to 3 MB, finalizes up to 10 MB, and removes successfully finalized chunks. Downloads stream to avoid the buffered response size limit. Interrupted uploads can leave orphan chunks; no automatic orphan cleanup is currently implemented.
- `netlify/functions/image.mts`: constrained image fetch for ZIP exports, rejecting private network targets, non-image responses and oversized images. Follow redirects only after validating the next target.
- `netlify/functions/search.mts`: source search from the supplied project. Upstream failures must remain distinct from no results.
- `db/schema.ts`: Drizzle schema, with a JSONB collection value per named collection and file metadata per file key. `db/index.ts` creates the native Netlify Database adapter. Structured records and flags must remain in Database, binaries in Blobs.
- `netlify/database/migrations/`: generated migrations applied by the platform. Keep Drizzle packages on beta because the native adapter requires it. Do not apply migrations manually.

Use Thai for user-facing UI, preserve the original warm background and green accent, escape interpolated text and validate link protocols. Never add credentials or print environment values. The site head contains the product's site name and description; the platform supplies the social image. No frontend build is required. The run's build pipeline performs validation; do not run local build, start, typecheck or test commands during agent tasks unless later instructions permit them.

The JSON backup covers text collections, not uploaded file bytes. Existing browser-local data is not silently imported. External source access and third-party CDN availability cannot be guaranteed. The reload button is the explicit refresh mechanism for changes made by other visitors; there is no realtime subscription.

- `netlify/functions/workspace.mts`: serves the original HTML at `/work` only after Identity validation. Never move this HTML back into the public publish directory.
- Every data Function uses `getUser()` from `@netlify/identity` before processing requests. Keep downloaded data private and uncached.
- `netlify/functions/members.mts` and `identity-members.mts`: Database member directory and per-tab presence. Only display member names, never directory emails. Presence heartbeats run every 30 seconds with a 90-second online window.
- `site/vendor/identity/`: pinned browser SDK and browser shims. Keep its imports local when updating.
