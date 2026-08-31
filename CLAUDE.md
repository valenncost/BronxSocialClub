# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bronx Social Club — a ticketing site for a boliche (nightclub) in Bahía Blanca, Argentina (Casanova 888, since 2017, @bronx.socialclub, dueño Nano Rabbione). Static frontend (no build step, no framework, no package.json) that talks directly to Supabase from the browser.

**This repo started as a fork of an existing ticketing site (codename "torino") for a different client.** Phase 1 rebranded it; Phase 2 replaced its pricing model. Anything not listed as done in "Current status" below is still torino code — don't assume it matches what Bronx needs.

Full business requirements, the client's current ticket line-up, and the target architecture change are in **`BRONX-SPEC.md`** at the repo root — read it before doing any non-cosmetic work here. It is the source of truth for what Bronx needs; this file is about how the code is put together.

## Current status (Phase 2 done — múltiples tipos de ticket)

What's done:
- **Phase 1 (rebrand).** All app files copied from torino, brand text swapped to "Bronx Social Club", palette repointed (background `#0A0A0B`, gradient `#F4526B → #F58C29`, solid orange `#F58C29`), `iconos/*.png` regenerated in orange (flat-color generated PNGs — regenerate with a script, don't hand-edit). Supabase credentials point at **Bronx's own project** (`wxoxonthagjwhhzwlahz`). `ADMIN_EMAIL` is still the developer's address, not the client's — per `BRONX-SPEC.md` §6 it becomes Nano Rabbione's before handoff, **in both `js/app.js` and `sql/02-rls.sql`**.
- **Phase 2 (pricing model).** Sequential `lotes` are gone — replaced by the `tipos_ticket` table: several ticket types on sale at the same time, grouped into TICKETS and COMBOS on the event page, each with its own quantity picker; one purchase can mix types. See "Tipos de ticket" below. `eventos` no longer has `precio_general`, `lotes` or `lote_activo`.
- **`sql/`** now holds every SQL the project needs (tables, RLS, the `ventas_por_tipo` view, the storage bucket). See `sql/README.md` for the order to run them.

What's **not** done yet:
- **Nothing has been run against the live database.** The SQL in `sql/` was written but never executed — until it is, the app connects and fails on missing tables rather than falling back to demo mode. The `crear-pago` Edge Function has not been written or deployed either.
- **Free tickets** ($0, skip Mercado Pago). The `tipos_ticket.precio` column allows 0 and the UI would render it, but checkout would send an invalid total — so `validarTipos()` in the admin deliberately rejects a price of 0 until this is built.
- **Hidden tickets.** `tipos_ticket.oculto` / `codigo_acceso` exist and the RLS policy hides them from the public, but there's no unlock UI and no way to fetch them — that needs an RPC (see `sql/README.md`).
- **Combos with a bottle voucher.** `accesos` is stored on the type and copied to each `compras` row, but a combo of 5 accesses still emits **one** QR per unit purchased, not 5 + a voucher. `BRONX-SPEC.md` §9 decides the target; the scanner side is step 8 of the plan.
- Minimum age, "duplicate event" for the weekly recurring shows — `BRONX-SPEC.md` §4.
- The 4-step FlashPass-style checkout (DNI per attendee, order number, deferred delivery) — `BRONX-SPEC.md` §10. Current checkout is still a single modal, now fed by the multi-type selection.
- No GitHub-to-Cloudflare deploy or Mercado Pago credentials for Bronx yet (`BRONX-SPEC.md` §6). `MP_ACCESS_TOKEN` must be Bronx's so the money lands in their account.
- Service fee is still `SERVICIO_PCT = 0.08`; Bronx's commercial target is 10% (`BRONX-SPEC.md` §8).

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
- `css/estilos.css` — all styles, shared by every page. Tokens in `:root` define the theme — see "Design system" below.
- `index.html` — Eventos (event list) + Detalle (event detail + buy modal). Two `.page` sections in one file, switched client-side.
- `entradas.html` — "Mis Entradas": a logged-in user's tickets, looked up by their Supabase session.
- `cuenta.html` — login / register / profile (Supabase Auth: email+password and Google OAuth).
- `admin.html` — the **Studio** (the panel is called Studio in the UI, though the route stays `/admin`): login + dashboard with a sidebar (Resumen, Eventos, Compradores, Usuarios, Equipo, Escáner). Past events/gallery live inside Eventos.
- `escaner.html` — QR scanner for door check-in (uses the `html5-qrcode` library from a CDN). Also the only page that registers the service worker and links the manifest.
- `sw.js` + `manifest.webmanifest` + `iconos/` — installable-app plumbing for the scanner (see Modo puerta below).
- `sql/` — every SQL statement the Supabase project needs, numbered in run order (`01-tablas` → `02-rls` → `03-vistas` → `04-storage`). `sql/README.md` explains the order and what still needs SQL that isn't written yet. **This is the schema's source of truth** — when you change what the app reads or writes, change these files too.
- `BRONX-SPEC.md` — the client brief: business context, target pricing model, feature gaps vs. FlashPass (the incumbent), and the phased work plan. Read this first for *why*; this file is for *how the code works*.

Every HTML page loads the same `js/app.js` and `css/estilos.css`, and declares which page it is via `<body data-page="...">`. `initPage()` at the bottom of `app.js` (run on `DOMContentLoaded`) branches on that attribute to decide what to load/render.

## Design system

`css/estilos.css` was rewritten as a single flat design system — the old file had an "IDENTIDAD BRONX" block at the bottom overriding the base rules with `!important`; that pattern is gone, don't reintroduce it. Reference points for the look: FlashPass, Dice, Resident Advisor.

**Tokens** (`:root`) — these names are also used inline from `js/app.js`, so renaming one means updating both:
- `--bg:#08080A` page background (flat black), `--surface:#0F0F12` cards, `--surface-2:#16161A` elevated/hover, `--border:#1F1F24` all 1px borders.
- `--text:#FAFAFA`, `--text-dim:#8B8B93`, `--text-faint:#55555C`.
- `--accent:#F58C29` brand orange, `--accent-2:#F4526B` the pink of the logo, `--gradient` the pink→orange brand gradient.
- `--ok`/`--warn`/`--bad` for semantic states (scanner, purchase status).

**Rules the stylesheet enforces — keep to them when adding UI:**
- The background is flat black plus a **luz de ambiente**: two static radial halos on `body::before` (fixed, `z-index:-1`, `pointer-events:none`) at alpha `0.055` orange and `0.035` pink. The intent is club lighting, not a glow — measured, they lift the background by about 6/255. If a halo reads as a visible smudge it's too strong. **No blur and no animation on that layer**, and the old full-strength glows and the grain texture stay gone.
- Accent light is allowed only in these four places, at these strengths: card hover border `rgba(245,140,41,0.25)`; input focus ring `0 0 0 3px rgba(245,140,41,0.12)`; primary-button hover `0 4px 16px rgba(245,140,41,0.20)`; selected item (`.tipo-card.elegida`, `.dash-nav-item.activo`) accent border over `rgba(245,140,41,0.04)`. Secondary buttons deliberately cast no shadow — that reserve belongs to the primary.
- Otherwise `--accent` is for the primary button, active states, and small details. `--accent-2` and `--gradient` belong to the logo — don't paint text or surfaces with them.
- The only `linear-gradient`s are black scrims for legibility over photos and the "Ver más" mask. Not decorative.
- Type is **Inter** (400/500/600/700/800). Scale is set once on `h1`–`h4` and on a shared label rule (`label`, `th`, `.d-section-title`, `.tipos-titulo`, …) — reuse those instead of restating sizes. No forced uppercase on long titles.
- Spacing on a 4px scale. Radii: 8px inputs/buttons, 12px cards, 999px pills. Box shadows only on `.modal` and the accent-light cases above.
- Transitions are `150ms ease` (`var(--transicion)`). **No entrance animations** — the `fadeUp` keyframe and its staggered `nth-child` delays were deleted. Note headless Chrome reports `prefers-reduced-motion: reduce` by default, so screenshots always come out with transitions off; that's the reduced-motion rule working, not a bug.
- No emoji in the interface. `✕` (close) and `✓` (valid at the door) stay — they're typographic symbols, not emoji.
- **Don't put widths in inline `style=` attributes.** Use the modifiers: `section.angosta` (480px single-column page — cuenta, escáner), `.btn.ancho` (full-width button), `.alta-staff` (the team-email input row). Layout that repeats belongs in the stylesheet, not in five copies of `style="width:100%"`.

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

Tables (defined in `sql/01-tablas.sql`, policies in `sql/02-rls.sql`):
- `eventos` — events. Flags: `activo`, `pasado`, `agotado`, `ubicacion_secreta`. **No price columns** — pricing lives entirely in `tipos_ticket`.
- `tipos_ticket` — the ticket types of an event, all on sale simultaneously: `evento_id`, `nombre`, `descripcion`, `precio`, `cantidad` (cupo, null = sin límite), `orden`, `categoria` (`ticket`|`combo`), `accesos`, `activo`, `oculto`, `codigo_acceso`, `valido_desde`, `valido_hasta`.
- `compras` — purchases/tickets, one row per QR. `grupo` (order number, groups the rows of one checkout), `evento`/`evento_id`, `tipo`/`tipo_ticket_id`, `accesos`, `nombre`, `apellido`, `email`, `total` (what that one ticket cost, service fee included), `codigo` (QR code), `estado` (`pendiente`/`aprobado`/`rechazado`), `usada`/`usada_en` (check-in), `creado_en`. Names *and* ids are stored so a ticket stays readable after its event or type is deleted.
- `galeria` — photos/videos attached to a past event (`evento_id`, `tipo`: `foto`|`video`, `url`, `orden`).
- `perfiles` — user profile mirror (name/surname/phone), filled by an `auth.users` trigger, read by the admin panel's "Usuarios registrados" table.
- `staff` — emails with scanner/admin-panel access (see Roles).
- `ventas_por_tipo` — **view**, not a table: approved ticket counts per `tipo_ticket_id`, the only purchase data `anon` may read (see below).

None of this exists yet in a live database — the SQL has not been run.

### Backend that lives outside this repo

Real payments call a Supabase **Edge Function** the client expects at `${SUPABASE_URL}/functions/v1/crear-pago` (see `confirmBuy()`). Its code is not in this repository — it's deployed separately in the Supabase project. From the client's perspective:
1. `confirmBuy()` POSTs the order to `crear-pago`, which is expected to create a Mercado Pago preference and return `{ init_point }`, and the browser redirects there. The payload shape is documented in a comment right above that `fetch` — `{evento, evento_id, fecha_texto, lugar, email, items[], asistentes[], total}`, where `items` is one entry per ticket type with its quantity and `asistentes` is one per QR to emit. The function is expected to insert the `compras` rows itself with the service_role key (the browser has no insert policy on `compras`).
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

The scanner does **not** yet handle `accesos > 1`: a combo row carries `accesos: 5` but its QR still admits one person. `BRONX-SPEC.md` §9 decides on 5 entry QRs plus a separate bottle-voucher QR — neither is implemented.

### Local-only "DEMO" mode

`DEMO` is `!SUPABASE_URL` — blank out the credential at the top of `js/app.js` and the app runs entirely in memory (`DEMO_EVENTS`, `DEMO_TIPOS`, `DEMO_PURCHASES`, fake login) with no network calls, showing the demo banner. Useful for UI work without touching real data. With Bronx's credentials filled in (the current state) `DEMO` is `false`. Keep the `DEMO` branches working when changing shared functions — `saveEvento`, `confirmBuy`, `login` etc. all branch on it.

### Roles: admin vs staff

There is no separate "admin login" — `cuenta.html`'s Supabase Auth *is* the admin/staff login too (unified session, see `restoreAdminSession()`). Role is computed client-side by `determinarRol(email, token)`:
- The email in `ADMIN_EMAIL` (js/app.js) is always `"admin"` — full access. It must match the email hardcoded in `es_admin()` in `sql/02-rls.sql`: `ADMIN_EMAIL` decides what the panel *shows*, `es_admin()` decides what the database *accepts*. Change one without the other and the panel either goes blank or shows buttons that fail.
- Any email present in the `staff` table is `"staff"` — scanner + read-only "Compradores" view only.
- Everyone else gets `null` and is denied entry to `/admin`.

`aplicarRol()` hides admin-only DOM sections (`sec-eventos`, `sec-pasados`, `sec-usuarios`, `sec-equipo`, the "borrar pendientes" button) for staff. **This is UI-only gating** — real enforcement of what staff can/can't write must live in Supabase RLS policies, since a staff member has a valid bearer token and could otherwise call the REST API directly. Admins manage the `staff` table from "Equipo" in the admin panel (`agregarStaff`/`quitarStaff`/`toggleStaff`).

### Tipos de ticket (the pricing model)

Every ticket type of an event is on sale **at the same time** — there is no active tier, no automatic advance. An event with no types is announced but not purchasable.

`TIPOS` is `{evento_id: [tipo, ...]}`, sorted by `orden`. `cargarTipos(todos)` fills it: the public page asks for `activo=true&oculto=false`, the admin panel passes `true` to get every type including paused and hidden ones.

Sold counts live in `VENTAS_TIPO` (`{tipo_ticket_id: n}`), keyed by **id**, not name:
- **Public pages**: `cargarVentasTipo()` reads the `ventas_por_tipo` view. Both it and `cargarTipos()` must be awaited *before* `loadEvents()`/`openDetail()`, or everything renders from a count of zero. If the view doesn't exist the error is swallowed, `VENTAS_VISTA_OK` stays false (the admin shows a warning) and all counts are zero.
- **Admin**: `loadPurchases()` overwrites it via `ventasTipoDesdePurchases()`, computed from the full `compras` rows the panel already loads, so the numbers are exact even without the view.

The derived helpers are the ones to reuse — don't recompute this inline:
- `restantesTipo(t)` — `cantidad == null` means no quota, so it returns `Infinity`.
- `tipoAgotado(t)` / `tipoDisponible(t)`.
- `precioDesde(ev)` — the cheapest type that still has room, or `null` (the card then reads "Próximamente"). `sinVenta(ev)` is the no-types-at-all case.
- `eventoAgotado(ev)` — the manual `agotado` flag, **or** every type sold out. An event with zero types is not "agotado".

**Selection and checkout.** `SELECCION` is `{tipo_ticket_id: cantidad}`, picked on the event detail page (`renderTiposDetalle` groups by `categoria` into TICKETS and COMBOS). `chTipo()` clamps to `min(MAX_POR_TIPO, restantesTipo)`. From there:
- `itemsSeleccionados()` → `[{tipo, cantidad}]`, one per chosen type.
- `unidadesSeleccionadas()` → one entry per QR to emit, in the same order the modal renders attendee rows and `confirmBuy()` reads them back. **These two orders must stay in sync** — both derive from `tiposALaVenta(cur)`, so don't sort one of them independently.
- `totalesSeleccion()` → `{entradas, subtotal, servicio, total}`.

A service fee (`SERVICIO_PCT`, currently 8% — Bronx's commercial target is 10%, see `BRONX-SPEC.md` §8) is added per ticket via `servicioDe(precio)`. The percentage shown in the UI is rendered from that same constant — don't hardcode it in the HTML.

**Admin editor.** `TIPOS_FORM` is an editable copy of the event's types; `TIPOS_BORRADOS` holds ids to delete. Nothing touches the database until "Guardar evento": `saveEvento()` writes the event first (a new one needs its id), then `sincronizarTipos(eventoId)` deletes, updates and inserts. The inputs write straight into `TIPOS_FORM` via `setTipoCampo()` and only add/move/delete re-render — re-rendering on every keystroke would drop focus mid-word.

### Required SQL: the `ventas_por_tipo` view

Public visitors must never be able to read `compras` — it holds `codigo`, the exact value the door scanner accepts, plus every buyer's name and email. Counting tickets therefore goes through an aggregate-only view (`sql/03-vistas.sql`) that returns nothing but `tipo_ticket_id` and a count, and runs with its owner's permissions so it can read `compras` while the caller can't.

Never widen this to expose per-row purchase data to `anon`.

## Conventions

- **Spanish throughout**: variable/function names, DOM ids, table/column names, user-facing text. Match this when adding code — don't introduce English identifiers into `app.js`.
- No modules/bundler: everything is a global function/variable in `app.js`, called via inline `onclick="..."` attributes in the HTML. New features follow the same pattern (a function in `app.js`, wired up with `onclick`/`onchange` in the HTML).
- `esc()` (js/app.js) escapes `<`, `>` and both quote characters before interpolating any user-supplied string into `innerHTML`. Every place that builds HTML from `eventos`/`tipos_ticket`/`compras`/user input uses it — always use it for new interpolated HTML too, including inside `value="..."` attributes.
- `fmt()` formats prices as `$` + `es-AR` locale thousands separators; use it for any new price display instead of raw numbers.
- Forms follow a repeated pattern: a hidden `*-id` input distinguishes create vs. edit, `reset*Form()`/`edit*()` pairs manage that, and `*-err`/`*-ok` `<p>` elements show inline validation/success messages (see the `ev-*` event form and `pe-*` past-event form for the template to copy).
- `admin.html` is a dashboard: a fixed 240px sidebar plus a content column with a breadcrumb header. Each `.admin-section` is one tab, shown one at a time by `mostrarSeccionAdmin(clave)` toggling `.activa`; the list of tabs is `SECCIONES_ADMIN` in `app.js`. To add a section you need three things: the `<div class="admin-section" id="sec-<clave>">`, a `<button class="dash-nav-item" id="nav-<clave>">` in the sidebar, and an entry in `SECCIONES_ADMIN`. If it's admin-only, add **both** ids to the list in `aplicarRol()` — hiding the section without hiding its sidebar button leaves staff a tab that opens an empty panel. (The old `initColapsables()` collapsible sections are gone; sections are tabs now.)
