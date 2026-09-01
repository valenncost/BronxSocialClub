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
- **The `crear-pago` Edge Function** has not been written or deployed. (The SQL in `sql/` *has* been run against Bronx's live Supabase project — tables, RLS, the view, storage, and the test data are all live; the one thing still pending there is swapping `ADMIN_EMAIL`/`es_admin()` to Nano's mail before handoff, per `sql/README.md`.)
- **"Eventos pasados" + the gallery are pulled out of the UI for now.** The public "Eventos pasados" section (index.html), its Studio manager (`sec-pasados` in admin.html), and the event-detail gallery (`d-galeria-sec`) are commented out, not deleted — the matching JS (`loadPasados`, `openPasado`, `loadPasadosAdmin`, `savePasado`, etc. in `js/app.js`) is commented out right alongside them. They're going to be replaced by a different section (artists who've played Bronx) rather than restored as-is; the `galeria` table and its RLS policies stay in `sql/` untouched in the meantime.
- **Free tickets** ($0, skip Mercado Pago). The `tipos_ticket.precio` column allows 0 and the UI would render it, but checkout would send an invalid total — so `validarTipos()` in the admin deliberately rejects a price of 0 until this is built.
- **Hidden tickets.** `tipos_ticket.oculto` / `codigo_acceso` exist and the RLS policy hides them from the public, but there's no unlock UI and no way to fetch them — that needs an RPC (see `sql/README.md`).
- **Combos with a bottle voucher.** `accesos` is stored on the type and copied to each `compras` row, but a combo of 5 accesses still emits **one** QR per unit purchased, not 5 + a voucher. `BRONX-SPEC.md` §9 decides the target; the scanner side is step 8 of the plan.
- Minimum age, "duplicate event" for the weekly recurring shows — `BRONX-SPEC.md` §4.
- **Deferred delivery** of the tickets (X hours before the event) — `BRONX-SPEC.md` §10. The rest of that section (4-step checkout, DNI per attendee, order number) is done, see "Checkout de 4 pasos" below.
- **The `reenviar-entradas` Edge Function.** "Mis Entradas" has a "¿Compraste sin cuenta?" box that POSTs an email to `${SUPABASE_URL}/functions/v1/reenviar-entradas` so the tickets get re-sent there. The UI, its validation and its neutral-answer behaviour are done and tested; **the function itself does not exist yet**, so today that call always fails and the box shows its error message. Like `crear-pago`, it lives outside this repo.
- No GitHub-to-Cloudflare deploy or Mercado Pago credentials for Bronx yet (`BRONX-SPEC.md` §6). `MP_ACCESS_TOKEN` must be Bronx's so the money lands in their account.

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
- `admin.html` — the **Studio** (the panel is called Studio in the UI, though the route stays `/admin`): login + dashboard with a sidebar (Resumen, Eventos, Compradores, Usuarios, Equipo, Escáner). Past events/gallery used to live inside Eventos — pulled out for now, see "Current status".
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
- `--accent:#F58C29` brand orange (solid — borders, icons, focus), `--accent-2:#F4526B` the pink of the logo, `--gradient` the pink→orange brand gradient (logo only), `--accent-gradient` the warm identity gradient (`#FF6B35→#F7931E`) used on the primary button, hero highlighted words, and filled active states.
- `--ok`/`--warn`/`--bad` for semantic states (scanner, purchase status).

**Rules the stylesheet enforces — keep to them when adding UI:**
- The background is flat black plus a **luz de ambiente**: two static radial halos on `body::before` (fixed, `z-index:-1`, `pointer-events:none`) at alpha `0.02` orange and `0.012` pink (halved once already from an initial `0.055`/`0.035` — that's the direction "too strong" gets fixed in, don't raise them back). The intent is club lighting, not a glow. If a halo reads as a visible smudge it's too strong. **No blur and no animation on that layer**, and the old full-strength glows and the grain texture stay gone. The hero used to run a hotter version of this same halo mechanism over a blurred logo; it's been replaced by real per-slide photos (see the hero bullet below), so that exception no longer applies there — `body::before` itself was never touched either way.
- **The index.html hero background is a 3-slide photo carousel**, not the blurred-logo treatment used elsewhere (see the detail-page bullet below for that one). `.hero-bg` holds three absolutely-positioned `.hero-bg-slide` divs, each a real photo set inline (`style="background-image:..."`) in index.html — `cachengue.jpg`, `jueves-picante.jpg`, `bronx-general.jpg`, all in `/iconos/` alongside the site's other static images (not a Supabase bucket, despite the similar name) — full-bleed `cover`, no blur, crossfading via `opacity`/`.activa` the same way `.hero-slide` text does. `.hero-bg::after` sits on top of all three: a bottom-to-top dark gradient (`rgba(13,13,13,.95)→transparent`, taller/stronger under the `640px` mobile breakpoint for contrast on short screens) plus a flat `rgba(0,0,0,.25)` wash — both constant across slides, only the photo underneath changes. **Don't wire this to per-event data** — it briefly became a photo pulled from the first upcoming event with a picture; that was a misreading of a request that only meant the detail page, and got reverted once already.
- **The hero title is a 3-slide carousel** (`#hero-slides` in index.html, driven by `iniciarHeroCarrusel()`/`activarHeroSlide()` in `js/app.js`, called from `initPage()`'s `"eventos"` branch). Every 4s (`setInterval`, 4000ms) it advances through `HERO_SLIDES = ["naranja","rojo","neutro"]` and loops; each slide cross-fades in via CSS (`.hero-slide.activa`, `transition:opacity 600ms`, all three stacked in the same CSS Grid cell so the container's height is the tallest slide's — no layout jump on rotation). **`prefers-reduced-motion: reduce` stops the interval entirely and leaves slide 0 showing** — that's not just `transition:none`, the JS itself checks `matchMedia` before calling `setInterval` and returns early. `activarHeroSlide()` toggles four parallel sets of elements off the same `HERO_SLIDES[i]` key, all sharing a `data-tinte` attribute and all crossfading at the same 600ms: the `.hero-slide` text, the `.hero-bg-slide` photo, a `.hero-glow` blur blob behind the title (see next bullet), and — via plain CSS attribute selectors on `hero.dataset.tinte`, no JS involved — the "Ver próximos eventos" button's color. The "rojo" slide (Jueves Picante) replaces its `<h1>`/`<p>` with a plain white headline line plus `jueves-picante-logo.png` as an `<img>` (the pre-made lockup, script-red "Picante" wordmark) — don't recreate that logo in CSS or text, it's a supplied asset. The color rotation is scoped to selectors under `.hero`/`#hero-slides` only — it never touches the header logo, footer, or any page outside the hero.
- **`.hero-glow`**: a blurred (`filter:blur(70px)`), centered blob behind the slide's title, one per color, cross-fading via `opacity`/`.activo` in sync with everything else — final opacity `.35` (a request for "30-40%, subtle"), background is that color's own gradient (`naranja`/`rojo` reuse the same hex pairs as `--accent-gradient`/the button's red) or plain white for "neutro". It lives inside `#hero-slides` (not the whole `.hero`) so it centers on the text column instead of the full-width photo, and needs `position:relative;z-index` on both `.hero-glow` (`0`) and `.hero-slide` (`1`) — two positioned siblings in the same container don't stack by DOM order alone, so without explicit z-index the glow could paint over the text instead of behind it.
- **Identity gradient (`--accent-gradient`) vs. solid `--accent`.** `--accent` stays a solid hex — thin borders, icons, focus rings, and anywhere else a flat color is needed. The primary button (`.btn`), the hero's highlighted `<em>` words, and toggle-style active states with a filled background (`.auth-tab.active`, `.esc-tab.active`) paint with `--accent-gradient` (`linear-gradient(135deg,#FF6B35,#F7931E)`) instead — gradient text on the `<em>` uses `background-clip:text`. This is a deliberate second exception to "no decorative gradients": `--accent-gradient` is brand identity (like `--gradient` is the logo's), not per-event.
- **The hero's "Ver próximos eventos" button re-tints per slide too**, not just the title — `.hero .btn` follows the same `[data-tinte="…"]` attribute the carousel already writes on `#hero`: naranja slide gets `--accent-gradient` (default) with a warm glow, rojo gets its own red gradient (`#FF3B30→#C1121F`) with a red glow, and neutro (the "Bronx, el mejor boliche" slide) gets solid white with a cool white glow and black text. Background/box-shadow transition at `600ms ease` to stay in sync with the slide cross-fade.
- Both the **event detail page** background and (previously) the hero used the same blur treatment; only the detail page still does. `.detail-bg`/`.detail-bg::after` — that specific event's own photo, set inline via `style="background-image:..."` from `js/app.js`, at `blur(72px)` (spec range 60–80px) with a flat `rgba(8,8,10,.75)` layer on top, **no `brightness()` filter and no gradient** — either would flatten the tint the image is there to give (a sunset's orange, a map's gold). `inset:-80px` is overscan so the blur doesn't show a falloff edge at the container's bound — keep it ≥ the blur radius if you change it. No photo on that event → `.detail-bg:not([style*="background-image"])` falls back to the logo at `opacity:.05`, no blur/overlay (a plain watermark, not the blur treatment).
  - `.detail-bg`/`.detail-bg::after` (the event detail page) — that specific event's own photo, set inline via `style="background-image:..."` from `js/app.js`. No photo on that event → `.detail-bg:not([style*="background-image"])` falls back to the logo at `opacity:.05`, no blur/overlay (a plain watermark, not the blur treatment — kept different from the hero on purpose, since the hero's blurred logo already reads as the site's default mood and doesn't need repeating almost-identically one page down).
- `.map-wrap iframe` (the Google Maps embed on the event detail page) is reskinned dark with a CSS filter (`invert(90%) hue-rotate(180deg) …`) — the free `output=embed` URL takes no style parameters, that needs the paid Maps JavaScript API, which this project doesn't have. The filter applies to everything the iframe paints, zoom controls and the Google wordmark included; that's the method's ceiling, not a bug to chase.
- Accent light is allowed only in these places, at these strengths: card hover border `0.25` (`.tipo-card`, `.evento-card`, `.ev-admin-item` — the Studio/detail surfaces that still have a background and a border); input focus ring `0 0 0 3px … 0.12`; primary-button hover `0 4px 16px … 0.20`; selected item (`.tipo-card.elegida`, `.dash-nav-item.activo`) accent border over `0.04`; and the per-event glow on the public grid's `.ticket[data-color-evento] .art` (`0 8px 40px … 0.18` at rest, `0.30` on hover with a `translateY(-4px)` lift on the whole card, none when sold out or past) — that card has no surface/border/background of its own (see "FlashPass-style event grid" below), the glow *is* its edge. **The box-shadow is scoped to `.art` (the photo), not to `.ticket`** — `--acento-rgb` is a custom property so it still inherits down from the `data-color-evento` attribute on `.ticket`, but putting the shadow on the outer element let its 40px blur bleed color behind the title/date text below the photo, which read as a colored background there instead of the plain site background it's supposed to be. All of them are written `rgba(var(--acento-rgb), a)` — see "Per-event accent color" below — so they re-tint with the event. Secondary buttons deliberately cast no shadow: that reserve belongs to the primary.
- **Per-event accent color.** `eventos.color_acento` holds a *key* (`naranja`|`rojo`|`blanco`|`violeta`|`verde`), never a hex; the hex pairs live in the "COLOR DE ACENTO POR EVENTO" block of `css/estilos.css`, where each `[data-color-evento="…"]` rule redefines exactly three tokens: `--accent`, `--acento-rgb` (the same color as loose channels, for the alpha uses above) and `--acento-par` (the second stop of the pair, used only by the Studio's swatch circles). `js/app.js` writes that key as `data-color-evento` on `#page-detalle`, on `#overlay` (the buy modal lives outside the detail page) and on each `.ticket` in the grid — `pintarColorDetalle(ev)` and `colorEvento(ev)`, which falls back to `naranja` for a null or unknown key. **Never put the attribute on `<body>`, the header or the footer**: the site's own identity stays orange, and that separation is the whole point. Adding a color means one line in the CSS block, one entry in `COLORES_EVENTO`, one `<button class="color-swatch">` in `admin.html` and one value in the SQL check constraint. Recoloring something new means pointing its rule at `var(--accent)` / `rgba(var(--acento-rgb), a)` — not writing a rule per color.
- Otherwise `--accent` (solid) is for borders, icons, focus rings, and small details. `--accent-2` and `--gradient` belong to the logo — don't paint text or surfaces with them. `--accent-gradient` is the one other decorative gradient allowed, and only on the primary button, hero highlighted `<em>` words (via `background-clip:text`), the hero's per-slide CTA (see "Hero" below), and filled toggle-style active states (`.auth-tab.active`, `.esc-tab.active`) — don't spread it further without reason.
- Outside of `--accent-gradient`'s allowed spots and the hero's per-slide glows, the only other `linear-gradient`s are black scrims for legibility over photos and the "Ver más" mask. Not decorative.
- **FlashPass-style event grid** (`.grid#grid` on index.html, built by `loadEvents()` in `js/app.js`). Each `.ticket` is just the 4:5 cover photo (`.art`, `aspect-ratio:4/5`) plus a title + one gray meta line underneath (`.ticket-info` > `.ticket-nombre` + `.ticket-meta`, the latter joining `fecha_texto` and `puertas` with " · ") — no card surface, no border, no price, no "Ver más"/"Comprar" buttons. **No cover photo** (`ev.foto_url` empty): `.art` gets `.red`/`.white` (from `ev.arte`, a leftover pre-rebrand field — in practice always `"red"`, nothing in the admin UI sets it to anything else), which drops the old flat-color fill in favor of a transparent box with a dashed border (same treatment as `.empty` elsewhere) and the event's own name centered inside as the only content — `.art-name` in `js/app.js`, letters directly on the transparent/site background, not a color swatch. The whole `<article>` carries the click handler (`el.onclick = () => openDetail(ev.id)`, set as a JS property since this element is built via `createElement`+`innerHTML`, not a full template string like the rest of the codebase) and the `data-color-evento` that drives its glow (see "Accent light" above). Sold out only adds a `.tag-soldout` pill over the photo and `opacity:.5` on the card — it stays clickable. 3 columns desktop, 1 column under the `640px` mobile breakpoint (`.grid{grid-template-columns:1fr}` in the "MÓVIL" media query) — no intermediate tablet step. `precioDesde(ev)` (the "cheapest available type" helper) still exists and is documented under "Tipos de ticket" below, just unused here now that the grid has no price.
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

Event detail deep-links via `?evento=<id>`, restored on load and on `popstate` in `initPage()`. (The past-event detail deep link, `?pasado=<id>`, went away with the past-events feature — see "Current status".)

### Supabase is the entire backend surface reachable from the browser

`js/app.js` talks to Supabase directly via `fetch` (no supabase-js SDK):
- `dbGet/dbInsert/dbUpdate/dbDelete` wrap the PostgREST REST API (`/rest/v1/<table>`).
- `authHeaders()` sends the Supabase anon key as `apikey`, and `Authorization: Bearer <token>` — the admin/session token when logged in, otherwise the anon key. Table-level access control is therefore enforced by **Supabase Row Level Security policies**, not by this code — the client just presents whatever token it has.
- `uploadFoto()` uploads to Supabase Storage bucket `fotos` (`/storage/v1/object/fotos/...`), used for both event cover photos and past-event gallery photos/videos.
- Supabase Auth (`/auth/v1/token`, `/auth/v1/signup`, `/auth/v1/user`, `/auth/v1/authorize?provider=google`) backs both regular user accounts and admin/staff login — **it's the same account system**, not a separate admin login (see Roles below).

Tables (defined in `sql/01-tablas.sql`, policies in `sql/02-rls.sql`):
- `eventos` — events. Flags: `activo`, `pasado`, `agotado`, `ubicacion_secreta`. `color_acento` is the event's accent-color key (see "Per-event accent color"). **No price columns** — pricing lives entirely in `tipos_ticket`.
- `tipos_ticket` — the ticket types of an event, all on sale simultaneously: `evento_id`, `nombre`, `descripcion`, `precio`, `cantidad` (cupo, null = sin límite), `orden`, `categoria` (`ticket`|`combo`), `accesos`, `activo`, `oculto`, `codigo_acceso`, `valido_desde`, `valido_hasta`.
- `compras` — purchases/tickets, one row per QR. `grupo` (order number, groups the rows of one checkout), `evento`/`evento_id`, `tipo`/`tipo_ticket_id`, `accesos`, `nombre`, `apellido`, `documento` (the attendee's DNI), `email`, `total` (what that one ticket cost, service fee included), `codigo` (QR code), `estado` (`pendiente`/`aprobado`/`rechazado`), `usada`/`usada_en` (check-in), `creado_en`. Buyer data repeats on every row of the order (`comprador_nombre`, `comprador_apellido`, `comprador_tipo_doc`, `comprador_documento`, `comprador_telefono`), and `user_id` is the buyer's `auth.users` id — **null when someone bought as a guest**. Names *and* ids are stored so a ticket stays readable after its event or type is deleted.
- `cupones` — discount codes. **Deliberately empty**: there's no discount system yet, but the checkout's "¿Tenés un código de descuento?" input already queries this table (and therefore always answers "código inválido"). Filling rows in is all it takes to turn it on; the front end doesn't change.
- `galeria` — photos/videos attached to a past event (`evento_id`, `tipo`: `foto`|`video`, `url`, `orden`). The table and its RLS policies stay; nothing in the app reads or writes it right now — see "Current status".
- `perfiles` — user profile mirror (name/surname/phone), filled by an `auth.users` trigger, read by the admin panel's "Usuarios registrados" table.
- `staff` — emails with scanner/admin-panel access (see Roles).
- `patrocinadores` — sponsors shown as a grayscale logo marquee on the homepage, below the events grid (defined in `sql/patrocinadores.sql`, not `01-tablas.sql`): `nombre`, `logo_url` (bucket `fotos`), `link` (optional), `orden`, `activo`. Managed from the Studio's "Patrocinadores" tab, admin-only.
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

`aplicarRol()` hides admin-only DOM sections (`sec-eventos`, `sec-usuarios`, `sec-equipo`, the "borrar pendientes" button) for staff. (`sec-pasados` used to be in this list — it's commented out along with the rest of the past-events UI, see "Current status".) **This is UI-only gating** — real enforcement of what staff can/can't write must live in Supabase RLS policies, since a staff member has a valid bearer token and could otherwise call the REST API directly. Admins manage the `staff` table from "Equipo" in the admin panel (`agregarStaff`/`quitarStaff`/`toggleStaff`).

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
- `unidadesSeleccionadas()` → one entry per QR to emit, in the same order the checkout renders attendee blocks and `ckPagar()` reads them back. **These two orders must stay in sync** — both derive from `tiposALaVenta(cur)`, so don't sort one of them independently.
- `totalesSeleccion()` → `{entradas, subtotal, servicio, total}`.

A service fee (`SERVICIO_PCT`, **10%**) is added per ticket via `servicioDe(precio)`; the buyer pays it on top of the subtotal. That constant is the single source of truth — the percentages shown in the UI are rendered from it, so never hardcode "10%" in the HTML or in a template string.

### Checkout de 4 pasos

`index.html` only holds the modal's shell (`#modal-buy` → title, `#ck-stepper`, `#ck-cuerpo`); every step is drawn by `renderCheckout()` in `js/app.js`. The steps are **1 Revisá tu orden · 2 Comprador · 3 Tickets · 4 Confirmación**, and the whole thing is one column — mobile is the reference layout, since that's where nearly all the buying happens.

- **State lives in `CK`** (`ckNuevo()` builds it; `null` means the modal is closed): current step, which path was chosen when there's no session, the buyer's fields, one entry per attendee, and the coupon box. `abrirCheckout(id)` replaced the old `openBuy()`.
- **`ckSincronizarAsistentes()`** keeps `CK.asistentes` aligned with `unidadesSeleccionadas()` by position, so changing quantities in step 1 doesn't wipe data already typed in step 3.
- **Inputs write to `CK` via `oninput` and never re-render** — same rule as the admin's ticket-type editor: redrawing on every keystroke drops focus mid-word. Only structural changes re-render (changing step, +/− on an item, ticking "Usar mis datos"). What *does* update live is the inline error and the disabled state of "Siguiente", both patched by id in `ckRefrescarValidacion()`.
- **Validation** is `ckCompradorValido()` / `ckTicketsValido()`, which return `""` when valid or the message to show. The error only appears once the user has typed something — a form that turns red the instant you open it is worse than silence.
- **No session required to buy.** Step 2 offers "Continuar como invitado" or "Iniciar sesión"; a guest's purchase is stored with `compras.user_id = null` and **no account is created for them**. Logged in, the form comes prefilled and the path chooser is skipped.
- **Guests can't see their tickets in a list** (there's no session to scope them to), so "Mis Entradas" has a "¿Compraste sin cuenta?" box that asks the backend to re-send them to that address. It deliberately answers the *same* thing whether or not the email exists — otherwise the form doubles as a way to find out who bought.

**RLS note.** `sql/checkout.sql` lets `anon` INSERT into `compras`, but the `with check` pins it to `estado = 'pendiente' and usada = false`, so nobody can self-issue a ticket the scanner would accept. There's still no SELECT policy for `anon` — a guest can buy but cannot read a single row, theirs included. That's why an anon insert must be sent with `Prefer: return=minimal` (asking for the row back would need SELECT).

**Admin editor.** `TIPOS_FORM` is an editable copy of the event's types; `TIPOS_BORRADOS` holds ids to delete. Nothing touches the database until "Guardar evento": `saveEvento()` writes the event first (a new one needs its id), then `sincronizarTipos(eventoId)` deletes, updates and inserts. The inputs write straight into `TIPOS_FORM` via `setTipoCampo()` and only add/move/delete re-render — re-rendering on every keystroke would drop focus mid-word.

### Required SQL: the `ventas_por_tipo` view

Public visitors must never be able to read `compras` — it holds `codigo`, the exact value the door scanner accepts, plus every buyer's name and email. Counting tickets therefore goes through an aggregate-only view (`sql/03-vistas.sql`) that returns nothing but `tipo_ticket_id` and a count, and runs with its owner's permissions so it can read `compras` while the caller can't.

Never widen this to expose per-row purchase data to `anon`.

## Working rules for Claude Code

- **SQL against Supabase gets applied, not just written.** When you generate or edit SQL meant for this project's Supabase database, run it against the live database yourself through the connected Supabase MCP (`apply_migration` for DDL, `execute_sql` for one-off queries/data) as part of the same task. Don't leave a new or edited `.sql` file in `sql/` unapplied on the assumption someone will run it by hand later.
- Still keep `sql/` as the source of truth: write the file first, then apply it, so the repo and the live database never drift apart.
- Report back at the end of the task exactly what got applied (which statements/migrations) and flag anything that failed to apply, instead of just saying the SQL was written.
- **Deploy when you're done.** After finishing any change and confirming it didn't break anything, run `wrangler deploy` yourself to publish the site — don't leave that step pending for the user, unless something about the change is worth having them review before it goes live.

## Conventions

- **Spanish throughout**: variable/function names, DOM ids, table/column names, user-facing text. Match this when adding code — don't introduce English identifiers into `app.js`.
- No modules/bundler: everything is a global function/variable in `app.js`, called via inline `onclick="..."` attributes in the HTML. New features follow the same pattern (a function in `app.js`, wired up with `onclick`/`onchange` in the HTML).
- `esc()` (js/app.js) escapes `<`, `>` and both quote characters before interpolating any user-supplied string into `innerHTML`. Every place that builds HTML from `eventos`/`tipos_ticket`/`compras`/user input uses it — always use it for new interpolated HTML too, including inside `value="..."` attributes.
- `fmt()` formats prices as `$` + `es-AR` locale thousands separators; use it for any new price display instead of raw numbers.
- Forms follow a repeated pattern: a hidden `*-id` input distinguishes create vs. edit, `reset*Form()`/`edit*()` pairs manage that, and `*-err`/`*-ok` `<p>` elements show inline validation/success messages (see the `ev-*` event form and `pe-*` past-event form for the template to copy).
- `admin.html` is a dashboard: a fixed 240px sidebar plus a content column with a breadcrumb header. Each `.admin-section` is one tab, shown one at a time by `mostrarSeccionAdmin(clave)` toggling `.activa`; the list of tabs is `SECCIONES_ADMIN` in `app.js`. To add a section you need three things: the `<div class="admin-section" id="sec-<clave>">`, a `<button class="dash-nav-item" id="nav-<clave>">` in the sidebar, and an entry in `SECCIONES_ADMIN`. If it's admin-only, add **both** ids to the list in `aplicarRol()` — hiding the section without hiding its sidebar button leaves staff a tab that opens an empty panel. (The old `initColapsables()` collapsible sections are gone; sections are tabs now.)
