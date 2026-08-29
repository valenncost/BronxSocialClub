# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bronx Social Club — a ticketing site for a boliche (nightclub) in Bahía Blanca, Argentina (Casanova 888, since 2017, @bronx.socialclub, dueño Nano Rabbione). Static frontend (no build step, no framework, no package.json) that talks directly to Supabase from the browser.

**This repo is a fork of an existing ticketing site (codename "torino") for a different client.** It was cloned file-for-file and only rebranded so far — see "Current status" below before assuming any business logic matches what Bronx actually needs.

Full business requirements, the client's current ticket line-up, and the target architecture change are in **`BRONX-SPEC.md`** at the repo root — read it before doing any non-cosmetic work here. It is the source of truth for what Bronx needs; this file is about how the code is put together.

## Current status (Phase 1 — rebrand only, logic untouched)

What's done:
- All app files copied from the torino project: `index.html`, `admin.html`, `entradas.html`, `escaner.html`, `cuenta.html`, `css/estilos.css`, `js/app.js`, plus the scanner PWA plumbing (`manifest.webmanifest`, `sw.js`, `iconos/`).
- Brand text swapped from "torino" to "Bronx Social Club" (nav logo, page `<title>`s, hero copy, footers, admin login copy, scanner login copy, manifest app name, service-worker cache namespace).
- Color palette repointed to Bronx's identity: background `#0A0A0B`, accent gradient `#F4526B → #F58C29` (`--accent-gradient` / `--accent-gradient-diag` in `css/estilos.css`), solid `#F58C29` orange for small text/borders/badges (the `--red` variable, kept under its old name since it's referenced everywhere). See "Palette" below.
- `iconos/*.png` regenerated in Bronx orange (same scanner-frame drawing as torino's, `#e10600` → `#F58C29`). They're flat-color generated PNGs, not photos — regenerate them with a script rather than hand-editing.
- Supabase credentials point at **Bronx's own project** (`wxoxonthagjwhhzwlahz`), not torino's. `ADMIN_EMAIL` is currently the developer's address, not the client's — per `BRONX-SPEC.md` §6 it should become Nano Rabbione's before handoff.

What's **not** done yet (still exactly as in torino — do not assume otherwise):
- **Pricing model.** The site still sells through torino's sequential `lotes` (tiers that auto-advance as they sell out: Early Bird → Lote 1 → Lote 2 → Lote 3). Bronx needs **`tipos_ticket`**, several ticket types sold simultaneously (see `BRONX-SPEC.md` §3) — this is the single biggest change still pending, and it touches the DB schema, the admin event form, the event detail page, the buy modal, and the scanner.
- Hidden/unlockable ticket types, free tickets (skip Mercado Pago), per-type validity windows, minimum age, "duplicate event" for the weekly recurring shows, multi-access tickets (combos) with a separate bottle-voucher QR — all pending, all detailed in `BRONX-SPEC.md` §4 and §9.
- The 4-step FlashPass-style checkout (nominated tickets with DNI, order number, deferred delivery, etc.) — see `BRONX-SPEC.md` §10. Current checkout is still torino's single-modal flow.
- The Supabase project exists but is **empty as far as this repo knows** — no table/RLS/migration files are committed here, and the `crear-pago` Edge Function has not been deployed. Until the schema and RLS policies are set up on the Supabase side, the app will connect and fail on missing tables rather than fall back to demo mode.
- No GitHub-to-Cloudflare deploy or Mercado Pago credentials for Bronx yet (`BRONX-SPEC.md` §6). `MP_ACCESS_TOKEN` must be Bronx's so the money lands in their account.

Because of the above, everything under "Architecture" below describes the **inherited torino architecture as it stands right now**, not the target Bronx design. Treat the `lotes`/`lote_activo` sections as due for replacement, not as a spec to preserve.

## Running locally

No build/install step — it's plain HTML/CSS/JS served as static files. Browser APIs used (camera for the scanner) require a real server, not `file://`:

```
python -m http.server 8000
```

Then open `http://localhost:8000`. There is no test suite, linter, or bundler configured.

## Deploy

Not deployed yet. Per `BRONX-SPEC.md` §6, this needs its own GitHub repo and its own Cloudflare Workers deploy (the torino Workers project must **not** be reused). Once set up, the routing convention to preserve is the same as torino: `go()`'s `PAGINAS` map in `js/app.js` navigates to extensionless paths (`/entradas`, `/admin`, `/escaner`, `/cuenta`), relying on the host mapping those to the matching `.html` file. Keep new pages to the same `<name>.html` → `/<name>` convention.

## File map

- `js/app.js` — **the entire application logic**, shared by every page (~1700 lines, no modules). Config constants (`SUPABASE_URL`, `SUPABASE_KEY`, `ADMIN_EMAIL`, `SERVICIO_PCT`) live at the very top.
- `css/estilos.css` — all styles, shared by every page. CSS variables in `:root` define the Bronx theme — see "Palette" below.
- `index.html` — Eventos (event list) + Detalle (event detail + buy modal). Two `.page` sections in one file, switched client-side.
- `entradas.html` — "Mis Entradas": a logged-in user's tickets, looked up by their Supabase session.
- `cuenta.html` — login / register / profile (Supabase Auth: email+password and Google OAuth).
- `admin.html` — login + admin panel (events, past events/gallery, buyers table, registered users, staff/team management).
- `escaner.html` — QR scanner for door check-in (uses the `html5-qrcode` library from a CDN). Also the only page that registers the service worker and links the manifest.
- `sw.js` + `manifest.webmanifest` + `iconos/` — installable-app plumbing for the scanner (see Modo puerta below).
- `BRONX-SPEC.md` — the client brief: business context, target pricing model, feature gaps vs. FlashPass (the incumbent), and the phased work plan. Read this first for *why*; this file is for *how the code works*.

Every HTML page loads the same `js/app.js` and `css/estilos.css`, and declares which page it is via `<body data-page="...">`. `initPage()` at the bottom of `app.js` (run on `DOMContentLoaded`) branches on that attribute to decide what to load/render.

## Palette

Defined in `css/estilos.css` `:root`:
- `--black:#0A0A0B` — page background.
- `--red:#F58C29` — solid orange. Despite the old variable name (kept because it's referenced everywhere), this is **not** red anymore — it's the solid color used for small text, borders, badges, active-tab backgrounds, focus outlines, etc.
- `--red-dark:#c96a1f` — darker orange, used where the old code darkened `--red` (diagonal placeholder gradients).
- `--red-soft:#F4526B` — the pink stop of the brand gradient, used as a solid accent color for things like price emphasis and warning text.
- `--accent-gradient` (`linear-gradient(90deg,#F4526B,#F58C29)`) and `--accent-gradient-diag` (135deg version) — the two-tone pink-to-orange brand gradient, reserved for the primary CTA button, the hero glow blobs, and the ticket-card/flyer placeholder art. Everything else uses the solid orange.

When adding new UI, follow that split: gradient for the one or two flashiest brand moments on a page, solid `var(--red)` orange for everything smaller (text, borders, badges, status pills).

## Architecture

### Single shared script, multi-page site, SPA-ish navigation

There's no router or framework. `go(page)` (js/app.js) is the one navigation function:
- If a section with id `page-<name>` exists in the *current* document, it just toggles `.page.show`/`.tab.active` classes (used for Eventos ⇄ Detalle inside `index.html`).
- Otherwise it does a real `window.location.href` to the matching file, via the `PAGINAS` map (`eventos→/`, `entradas→/entradas`, `admin→/admin`, `escaner→/escaner`, `cuenta→/cuenta`).

Event detail and past-event detail deep-link via `?evento=<id>` / `?pasado=<id>` query params, restored on load and on `popstate` in `initPage()`.

### Supabase is the entire backend surface reachable from the browser

`js/app.js` talks to Supabase directly via `fetch` (no supabase-js SDK):
- `dbGet/dbInsert/dbUpdate/dbDelete` wrap the PostgREST REST API (`/rest/v1/<table>`).
- `authHeaders()` sends the Supabase anon key as `apikey`, and `Authorization: Bearer <token>` — the admin/session token when logged in, otherwise the anon key. Table-level access control is therefore enforced by **Supabase Row Level Security policies**, not by this code — the client just presents whatever token it has.
- `uploadFoto()` uploads to Supabase Storage bucket `fotos` (`/storage/v1/object/fotos/...`), used for both event cover photos and past-event gallery photos/videos.
- Supabase Auth (`/auth/v1/token`, `/auth/v1/signup`, `/auth/v1/user`, `/auth/v1/authorize?provider=google`) backs both regular user accounts and admin/staff login — **it's the same account system**, not a separate admin login (see Roles below).

Known tables (inherited from torino, inferred from `dbGet`/`dbInsert` calls — there is no migrations/schema file in this repo yet):
- `eventos` — events. Flags: `activo`, `pasado`, `agotado`, `ubicacion_secreta`. Pricing: `precio_general`, `lotes` (jsonb: `{eb,l1,l2,l3}`), `lote_activo`. **Per `BRONX-SPEC.md` §3, this pricing model is slated to be replaced by a `tipos_ticket` table** — see "Current status" above.
- `compras` — purchases/tickets. Fields include `evento`, `nombre`, `apellido`, `email`, `tipo` (lote name), `total`, `codigo` (QR code), `estado` (`pendiente`/`aprobado`/`rechazado`), `usada`/`usada_en` (check-in), `creado_en`.
- `galeria` — photos/videos attached to a past event (`evento_id`, `tipo`: `foto`|`video`, `url`, `orden`).
- `perfiles` — user profile mirror (name/surname/phone), read by the admin panel's "Usuarios registrados" table.
- `staff` — emails with scanner/admin-panel access (see Roles).
- `ventas_por_lote` — **view**, not a table: approved ticket counts per event and tier, the only purchase data `anon` may read (see Lotes below).

None of these exist yet in a live database — Bronx needs its own Supabase project created from scratch, running the torino SQL plus the new `tipos_ticket` migration (`BRONX-SPEC.md` §6).

### Backend that lives outside this repo

Real payments call a Supabase **Edge Function** the client expects at `${SUPABASE_URL}/functions/v1/crear-pago` (see `confirmBuy()`). Its code is not in this repository — it's deployed separately in the Supabase project. From the client's perspective:
1. `confirmBuy()` POSTs event/attendee/price data to `crear-pago`, which is expected to create a Mercado Pago preference and return `{ init_point }`, and the browser redirects there.
2. Mercado Pago redirects back to the site with `?pago=ok|error|pendiente` (handled by `checkReturnFromPayment()`), implying a webhook/edge function elsewhere flips `compras.estado` to `aprobado` and emails the ticket (Resend, per the client brief) — not done from this static frontend. There is no webhook handler, Mercado Pago SDK, or Resend code anywhere in this repo.

When working on payment/email behavior, remember the actual logic is server-side and invisible here — you can only change what this repo sends to `crear-pago` and how it reacts to the `pago=` redirect param. Bronx's own `MP_ACCESS_TOKEN` needs to be set on that (not-yet-created) edge function so money lands in Bronx's Mercado Pago account, not torino's (`BRONX-SPEC.md` §6).

### Modo puerta: the scanner works offline

The door is the one place where losing connectivity is unacceptable, so `escaner.html` is an installable PWA with an offline path. Two separate mechanisms, easy to confuse:

- **`sw.js`** caches only the *app shell* (page, CSS, `app.js`, the CDN QR library, icons) so the scanner opens with no signal. It is stale-while-revalidate, registered **only from `escaner.html`** so ordinary buyers never install it and can't be served a stale shell. It never caches Supabase responses. Bump `VERSION` (currently `bronx-escaner-v1`) to invalidate old caches.
- **`localStorage`** holds the *ticket data*: `tp_puerta_lista` (a `{codigo: row}` map of approved tickets, downloaded on demand by `descargarLista()`) and `tp_puerta_cola` (check-ins made offline, waiting to be PATCHed).

`onScanSuccess()` tries the network first and falls back to `validarOffline()` both when `navigator.onLine` is false *and* when the request throws mid-scan. `sincronizarPuerta()` flushes the queue on load and on the `online` event; items that fail stay queued.

Two consequences worth remembering before changing this code:
- The offline list contains **only approved tickets**, so offline a missing code can't be distinguished between "doesn't exist" and "not paid" — hence the deliberately vaguer `NO VÁLIDA`.
- `cargarIngresos()` refuses to overwrite `ingresos` while the queue is non-empty; without that guard, offline check-ins vanish from the door's screen the moment signal returns.

Offline check-ins can't see each other across phones, so two offline scanners could admit the same ticket. That's inherent, not a bug to fix client-side.

`BRONX-SPEC.md` §3 also flags a new problem the offline scanner will need to solve: combo tickets with `accesos > 1` (5 people per QR) — whether that's 5 separate QR codes or one QR with a use-counter is still an open decision, not yet implemented.

### Local-only "DEMO" mode

`DEMO` is `!SUPABASE_URL` — blank out the credential at the top of `js/app.js` and the app runs entirely in memory (`DEMO_EVENTS`, `DEMO_PURCHASES`, fake login) with no network calls, showing the demo banner. Useful for UI work without touching real data. With Bronx's credentials filled in (the current state) `DEMO` is `false`. Keep the `DEMO` branches working when changing shared functions — `saveEvento`, `confirmBuy`, `login` etc. all branch on it.

### Roles: admin vs staff

There is no separate "admin login" — `cuenta.html`'s Supabase Auth *is* the admin/staff login too (unified session, see `restoreAdminSession()`). Role is computed client-side by `determinarRol(email, token)`:
- The email in `ADMIN_EMAIL` (js/app.js, currently blank) is always `"admin"` — full access. Needs to be set to Nano Rabbione's email once Bronx's Supabase project exists.
- Any email present in the `staff` table is `"staff"` — scanner + read-only "Compradores" view only.
- Everyone else gets `null` and is denied entry to `/admin`.

`aplicarRol()` hides admin-only DOM sections (`sec-eventos`, `sec-pasados`, `sec-usuarios`, `sec-equipo`, the "borrar pendientes" button) for staff. **This is UI-only gating** — real enforcement of what staff can/can't write must live in Supabase RLS policies, since a staff member has a valid bearer token and could otherwise call the REST API directly. Admins manage the `staff` table from "Equipo" in the admin panel (`agregarStaff`/`quitarStaff`/`toggleStaff`).

### Lotes (pricing tiers) — inherited, slated for replacement

Events currently sell at a flat `precio_general` or through up to four sequential tiers stored in `eventos.lotes` (`eb`=Early Bird, `l1`, `l2`, `l3` — see `LOTE_NOMBRES`/`ORDEN_LOTES`). **Tiers advance automatically as they sell out — this is the exact opposite of what Bronx needs** (`BRONX-SPEC.md` §3: several ticket types on sale simultaneously, not one at a time). Do not extend this system for new Bronx features; it exists here only because Phase 1 was rebrand-only.

`eventos.lotes` has two shapes and both must keep working until this is replaced — `loteInfo()` normalizes them:
- Legacy: `{eb: 13000}` — a bare number, price only, **no quota**.
- Current: `{eb: {precio: 13000, cantidad: 50}}` — `cantidad: null` means no quota.

`loteActivo(ev)` is the single source of truth for the effective price/name, used everywhere pricing is shown or charged (cards, detail page, buy modal, `confirmBuy`'s call to `crear-pago`, admin summary). It walks the defined tiers in order and returns the first whose approved sales haven't reached its `cantidad`; if every tier is full it returns the last one with `todosAgotados: true`, and `eventoAgotado(ev)` (manual `agotado` flag OR `todosAgotados`) is what gates the sold-out UI.

`eventos.lote_activo` is **not** the switch that opens a tier — it's a *floor*. `loteActivo()` starts scanning from it and never returns an earlier tier. `lote_activo: "general"` means "ignore tiers, use `precio_general`".

Sold counts live in `VENTAS_LOTE` (`{"<evento nombre>": {"<lote nombre>": n}}`), keyed by **name**, because `compras.tipo` stores the tier's display name:
- **Public pages**: `cargarVentasLote()` reads the `ventas_por_lote` view. Must be awaited *before* `loadEvents()`/`openDetail()`, or prices render from a count of zero.
- **Admin**: `loadPurchases()` overwrites it via `ventasLoteDesdePurchases()`, computed from the full `compras` rows the panel already loads.

If the view doesn't exist, `cargarVentasLote()` swallows the error, leaves `VENTAS_VISTA_OK` false and all counts at zero.

A service fee (`SERVICIO_PCT`, currently 8% — Bronx's commercial target is 10%, see `BRONX-SPEC.md` §8) is added on top of the tier price at checkout, computed client-side and passed to `crear-pago`. The percentage shown in the buy modal is rendered from that same constant by `updTotal()` — don't hardcode it in the HTML.

### Required SQL: the `ventas_por_lote` view

Public visitors must never be able to read `compras` — it holds `codigo`, the exact value the door scanner accepts, plus every buyer's name and email. Counting tickets therefore goes through an aggregate-only view:

```sql
create or replace view ventas_por_lote as
  select evento, tipo, count(*)::int as vendidas
  from compras
  where lower(estado) = 'aprobado'
  group by evento, tipo;

grant select on ventas_por_lote to anon, authenticated;
```

Never widen this to expose per-row purchase data to `anon`. (When `tipos_ticket` replaces `lotes`, this view will need an equivalent rework — see `BRONX-SPEC.md` §3.)

## Conventions

- **Spanish throughout**: variable/function names, DOM ids, table/column names, user-facing text. Match this when adding code — don't introduce English identifiers into `app.js`.
- No modules/bundler: everything is a global function/variable in `app.js`, called via inline `onclick="..."` attributes in the HTML. New features follow the same pattern (a function in `app.js`, wired up with `onclick`/`onchange` in the HTML).
- `esc()` (js/app.js) escapes `<`/`>` before interpolating any user-supplied string into `innerHTML`. Every place that builds HTML from `eventos`/`compras`/user input uses it — always use it for new interpolated HTML too.
- `fmt()` formats prices as `$` + `es-AR` locale thousands separators; use it for any new price display instead of raw numbers.
- Forms follow a repeated pattern: a hidden `*-id` input distinguishes create vs. edit, `reset*Form()`/`edit*()` pairs manage that, and `*-err`/`*-ok` `<p>` elements show inline validation/success messages (see the `ev-*` event form and `pe-*` past-event form for the template to copy).
- Each `.admin-section` in `admin.html` is made collapsible generically by `initColapsables()` — don't hand-roll collapse behavior for new sections, just follow the existing `<h3>` + section markup and it's picked up automatically.
