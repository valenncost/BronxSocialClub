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
- `sql/` — every SQL statement the Supabase project needs, numbered in run order (`01-tablas` → `02-rls` → `03-vistas` → `04-storage` → `roles-equipo`, which must run after `02-rls` since it redefines `es_admin()`/`es_staff()` → `evento-vistas`, which depends on `es_encargado()`). `sql/README.md` explains the order and what still needs SQL that isn't written yet. **This is the schema's source of truth** — when you change what the app reads or writes, change these files too.
- `BRONX-SPEC.md` — the client brief: business context, target pricing model, feature gaps vs. FlashPass (the incumbent), and the phased work plan. Read this first for *why*; this file is for *how the code works*.

Every HTML page loads the same `js/app.js` and `css/estilos.css`, and declares which page it is via `<body data-page="...">`. `initPage()` at the bottom of `app.js` (run on `DOMContentLoaded`) branches on that attribute to decide what to load/render.

## Design system

`css/estilos.css` was rewritten as a single flat design system — the old file had an "IDENTIDAD BRONX" block at the bottom overriding the base rules with `!important`; that pattern is gone, don't reintroduce it. Reference points for the look: FlashPass, Dice, Resident Advisor.

The palette is **black + white + glow**: a black base with translucent veils on top, neutral white/gray type and controls, and glow instead of flat color. **The only color in the whole site comes from the per-event accent** (see "Per-event accent color") — nothing paints brand orange by default any more.

**Tokens** (`:root`) — these names are also used inline from `js/app.js`, so renaming one means updating both:
- `--bg:#0D0D0D` page background. Surfaces are **translucent veils, not solid blocks**: `--surface:rgba(255,255,255,.035)` cards, `--surface-2:rgba(255,255,255,.07)` elevated/hover, `--border:rgba(255,255,255,.10)` all 1px borders. They're white-alpha, not black-alpha, on purpose — black over black is invisible; black-alpha is reserved for the scrims that sit **over a photo** (hero, `.detail-bg::after`, the modal overlay), where there's something to darken.
- `--text:#FAFAFA`, `--text-dim:#8B8B93`, `--text-faint:#6E6E76` (raised from `#55555C`, which fell under 3:1 on the veils).
- `--accent:#FFFFFF` / `--acento-rgb:255,255,255` — the **default** accent: solid borders, icons, focus rings, and the primary button's fill. Any container with `data-color-evento` redefines these with that event's color and everything inside re-tints itself; that mechanism is unchanged.
- `--glow-suave` / `--glow-fuerte` — the glow that replaced colored borders and flat fills. Both read `--acento-rgb`, so **they re-tint per event for free**.
- `--accent-gradient` — now used in exactly one place, the hero's highlighted `<em>` words (the hero keeps its own `[data-tinte]` per-slide system). `--accent-2` and `--gradient` belong to the logo and currently paint nothing.
- `--ok`/`--warn`/`--bad` for semantic states (scanner, purchase status) — these stay colored, they're status, not brand.

**Rules the stylesheet enforces — keep to them when adding UI:**
- New surfaces use the translucent tokens, never a new solid hex. A panel that floats over scrolling content (`.dash-side`, `.modal`, `.d-floatbar`, `.dash-header`) pairs its veil with `backdrop-filter: blur(...)`, or the translucency reads as bleed-through instead of glass. `option` carries its own solid background — the native `<select>` popup inherits the element's background and a veil there is unreadable.
- The background is flat black plus a **luz de ambiente**: two static radial halos on `body::before` (fixed, `z-index:-1`, `pointer-events:none`) at alpha `0.022` and `0.014`, now both neutral white (they used to be orange/pink). The intent is club lighting, not a glow. If a halo reads as a visible smudge it's too strong. **No blur and no animation on that layer**, and the old full-strength glows and the grain texture stay gone. The hero used to run a hotter version of this same halo mechanism over a blurred logo; it's been replaced by real per-slide photos (see the hero bullet below), so that exception no longer applies there — `body::before` itself was never touched either way.
- **The index.html hero background is a 3-slide photo carousel**, not the blurred-logo treatment used elsewhere (see the detail-page bullet below for that one). `.hero-bg` holds three absolutely-positioned `.hero-bg-slide` divs, each a real photo set inline (`style="background-image:..."`) in index.html — `cachengue.jpg`, `jueves-picante.jpg`, `bronx-general.jpg`, all in `/iconos/` alongside the site's other static images (not a Supabase bucket, despite the similar name) — full-bleed `cover`, no blur, crossfading via `opacity`/`.activa` the same way `.hero-slide` text does. `.hero-bg::after` sits on top of all three: a bottom-to-top dark gradient (`rgba(13,13,13,.95)→transparent`, taller/stronger under the `640px` mobile breakpoint for contrast on short screens) plus a flat `rgba(0,0,0,.25)` wash — both constant across slides, only the photo underneath changes. **Don't wire this to per-event data** — it briefly became a photo pulled from the first upcoming event with a picture; that was a misreading of a request that only meant the detail page, and got reverted once already.
- **The hero title is a 3-slide carousel** (`#hero-slides` in index.html, driven by `iniciarHeroCarrusel()`/`activarHeroSlide()` in `js/app.js`, called from `initPage()`'s `"eventos"` branch). Every 4s (`setInterval`, 4000ms) it advances through `HERO_SLIDES = ["naranja","rojo","neutro"]` and loops; each slide cross-fades in via CSS (`.hero-slide.activa`, `transition:opacity 600ms`, all three stacked in the same CSS Grid cell so the container's height is the tallest slide's — no layout jump on rotation). **`prefers-reduced-motion: reduce` stops the interval entirely and leaves slide 0 showing** — that's not just `transition:none`, the JS itself checks `matchMedia` before calling `setInterval` and returns early. `activarHeroSlide()` toggles four parallel sets of elements off the same `HERO_SLIDES[i]` key, all sharing a `data-tinte` attribute and all crossfading at the same 600ms: the `.hero-slide` text, the `.hero-bg-slide` photo, a `.hero-glow` blur blob behind the title (see next bullet), and — via plain CSS attribute selectors on `hero.dataset.tinte`, no JS involved — the "Ver próximos eventos" button's color. The "rojo" slide (Jueves Picante) replaces its `<h1>`/`<p>` with a plain white headline line plus `jueves-picante-logo.png` as an `<img>` (the pre-made lockup, script-red "Picante" wordmark) — don't recreate that logo in CSS or text, it's a supplied asset. The color rotation is scoped to selectors under `.hero`/`#hero-slides` only — it never touches the header logo, footer, or any page outside the hero.
- **`.hero-glow`**: a blurred (`filter:blur(70px)`), centered blob behind the slide's title, one per color, cross-fading via `opacity`/`.activo` in sync with everything else — final opacity `.35` (a request for "30-40%, subtle"), background is that color's own gradient (`naranja`/`rojo` reuse the same hex pairs as `--accent-gradient`/the button's red) or plain white for "neutro". It lives inside `#hero-slides` (not the whole `.hero`) so it centers on the text column instead of the full-width photo, and needs `position:relative;z-index` on both `.hero-glow` (`0`) and `.hero-slide` (`1`) — two positioned siblings in the same container don't stack by DOM order alone, so without explicit z-index the glow could paint over the text instead of behind it.
- **The primary button is a solid fill plus glow.** `.btn` paints `background:var(--accent)` with `--glow-suave` (`--glow-fuerte` on hover) and black text — white by default, the event's color inside a `data-color-evento` container, with the glow following along because it reads `--acento-rgb`. It used to paint `--accent-gradient`; that gradient now survives only on the hero's `<em>` words (via `background-clip:text`). Filled toggle states (`.auth-tab.active`) follow the same solid+glow treatment. The per-event override below is the one place a button still paints a gradient — **inside a per-event colored container** (`[data-color-evento] .btn:not(.ghost):not(:disabled)`, the event detail page and the buy modal): there the primary button paints `linear-gradient(135deg,var(--accent),var(--acento-par))` instead, per `sql/color-evento.sql`'s original spec for this feature ("reemplaza al naranja de la marca... en botones, tarjeta de ticket elegida, selector de cantidad, glows"). That override was missing for a while — the button stayed brand-orange on every event regardless of `color_acento` while `.tipo-card.elegida` and `.tipo-qty .mas` (which read plain `--accent`) already re-tinted correctly — until it was fixed. Everywhere else (hero, auth tabs, escáner tabs, header) isn't nested in a `[data-color-evento]` container, so the identity gradient there is untouched.
- **The hero's "Ver próximos eventos" button re-tints per slide too**, not just the title — `.hero .btn` follows the same `[data-tinte="…"]` attribute the carousel already writes on `#hero`: naranja slide gets `--accent-gradient` (default) with a warm glow, rojo gets its own red gradient (`#FF3B30→#C1121F`) with a red glow, and neutro (the "Bronx, el mejor boliche" slide) gets solid white with a cool white glow and black text. Background/box-shadow transition at `600ms ease` to stay in sync with the slide cross-fade.
- Both the **event detail page** background and (previously) the hero used the same blur treatment; only the detail page still does. `.detail-bg`/`.detail-bg::after` — that specific event's own photo, set inline via `style="background-image:..."` from `js/app.js`, at `blur(72px)` (spec range 60–80px) with a flat `rgba(8,8,10,.75)` layer on top, **no `brightness()` filter and no gradient** — either would flatten the tint the image is there to give (a sunset's orange, a map's gold). `inset:-80px` is overscan so the blur doesn't show a falloff edge at the container's bound — keep it ≥ the blur radius if you change it. No photo on that event → `.detail-bg:not([style*="background-image"])` falls back to the logo at `opacity:.05`, no blur/overlay (a plain watermark, not the blur treatment).
  - `.detail-bg`/`.detail-bg::after` (the event detail page) — that specific event's own photo, set inline via `style="background-image:..."` from `js/app.js`. No photo on that event → `.detail-bg:not([style*="background-image"])` falls back to the logo at `opacity:.05`, no blur/overlay (a plain watermark, not the blur treatment — kept different from the hero on purpose, since the hero's blurred logo already reads as the site's default mood and doesn't need repeating almost-identically one page down).
- `.map-wrap iframe` (the Google Maps embed on the event detail page) is reskinned dark with a CSS filter (`invert(90%) hue-rotate(180deg) …`) — the free `output=embed` URL takes no style parameters, that needs the paid Maps JavaScript API, which this project doesn't have. The filter applies to everything the iframe paints, zoom controls and the Google wordmark included; that's the method's ceiling, not a bug to chase.
- Accent light is allowed only in these places, at these strengths: card hover border `0.25` (`.tipo-card`, `.evento-card`, `.ev-admin-item` — the Studio/detail surfaces that still have a background and a border); input focus ring `0 0 0 3px … 0.12`; primary-button hover `0 4px 16px … 0.20`; selected item (`.tipo-card.elegida`, `.dash-nav-item.activo`) accent border over `0.04`; and the per-event glow on the public grid's `.ticket[data-color-evento] .art` (`0 8px 40px … 0.18` at rest, `0.30` on hover with a `translateY(-4px)` lift on the whole card, none when sold out or past) — that card has no surface/border/background of its own (see "FlashPass-style event grid" below), the glow *is* its edge. **The box-shadow is scoped to `.art` (the photo), not to `.ticket`** — `--acento-rgb` is a custom property so it still inherits down from the `data-color-evento` attribute on `.ticket`, but putting the shadow on the outer element let its 40px blur bleed color behind the title/date text below the photo, which read as a colored background there instead of the plain site background it's supposed to be. All of them are written `rgba(var(--acento-rgb), a)` — see "Per-event accent color" below — so they re-tint with the event. Secondary buttons deliberately cast no shadow: that reserve belongs to the primary.
- **Per-event accent color.** `eventos.color_acento` holds a *key* (`naranja`|`rojo`|`blanco`|`violeta`|`verde`), never a hex; the hex pairs live in the "COLOR DE ACENTO POR EVENTO" block of `css/estilos.css`, where each `[data-color-evento="…"]` rule redefines exactly three tokens: `--accent`, `--acento-rgb` (the same color as loose channels, for the alpha uses above) and `--acento-par` (the second stop of the pair, used only by the Studio's swatch circles). `js/app.js` writes that key as `data-color-evento` on `#page-detalle`, on `#overlay` (the buy modal lives outside the detail page) and on each `.ticket` in the grid — `pintarColorDetalle(ev)` and `colorEvento(ev)`, which falls back to `naranja` for a null or unknown key. **Never put the attribute on `<body>`, the header or the footer**: the site's own identity stays orange, and that separation is the whole point. Adding a color means one line in the CSS block, one entry in `COLORES_EVENTO`, one `<button class="color-swatch">` in `admin.html` and one value in the SQL check constraint. Recoloring something new means pointing its rule at `var(--accent)` / `rgba(var(--acento-rgb), a)` — not writing a rule per color.
- Otherwise `--accent` (solid) is for borders, icons, focus rings, and small details. `--accent-2` and `--gradient` belong to the logo — don't paint text or surfaces with them. `--accent-gradient` is the one decorative gradient left, and only on the hero's highlighted `<em>` words (via `background-clip:text`) and the hero's per-slide CTA (see "Hero" below) — don't spread it further without reason.
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
- `colaboradores` + `colaborador_rol` — the team and what each one can do (`admin`/`encargado`/`escaner`, optionally scoped to one event). See Roles below.
- `compras.origen` — `'venta'` (default, everything that came through checkout) or `'cortesia'` (a comp ticket issued by hand from the Studio, see below). Sales metrics filter on it; the door scanner doesn't care.
- `evento_vistas` — one row per counted visit to an event's public page (`evento_id`, `session_id`, `fecha`, plus a generated `dia` column). Feeds the "Vistas" KPI and the visits line in the Studio's per-event Analytics. Deduped twice: `sessionStorage` stops the repeat insert on refresh, and a unique index on `(evento_id, session_id, dia)` caps it at one visit per visitor per day — the resulting 409 is the expected path, swallowed by `registrarVistaEvento()`. `anon` may INSERT but **never SELECT**.
- `staff` — **dead table**, kept but unread: its emails were migrated into `colaboradores` as global `escaner` by `sql/roles-equipo.sql`.
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

### Roles: admin, encargado, escáner

There is no separate "admin login" — `cuenta.html`'s Supabase Auth *is* the Studio login too (unified session, see `restoreAdminSession()`). The source of truth is **`sql/roles-equipo.sql`**: `colaboradores` (who's on the team, matched by email) + `colaborador_rol` (`rol` + `evento_id`, where **`evento_id: null` = every event**, an id = that event only). Role is computed client-side by `determinarRol(email, token)`, which reads the caller's own `colaboradores` row with its roles embedded and returns the highest one it finds (`ROL_ORDEN = admin > encargado > escaner`); an inactive collaborator (`activo = false`) resolves to `null`, same as the SQL side.

- `admin` — **shown in the UI as "Organizador"**, but the stored value is still `admin`: renaming it would mean migrating `colaborador_rol`, its check constraint and `es_admin()` for nothing. The visible name lives in exactly one place, `ROLES[x].titulo`, read everywhere through `tituloRol()` — never hardcode a role's label. It gets the whole Studio, including the Equipo screen. The email in `ADMIN_EMAIL` (js/app.js) is always admin **even if it isn't in `colaboradores`** — the bootstrap so the owner can't lock themselves out. It must match the email hardcoded in `es_admin()` in `sql/roles-equipo.sql` (and in the legacy copy in `02-rls.sql`): `ADMIN_EMAIL` decides what the panel *shows*, `es_admin()` decides what the database *accepts*.
- `encargado` — Resumen, Eventos, Compradores. Writes are scoped: `es_encargado(evento_id)` lets a globally-scoped encargado edit and create events, while one scoped to a single event can edit only that event and **cannot create new ones** (a new row's id was never assigned to them).
- `escaner` — the door screen only. `abrirPanel()` bounces them out of `/admin` via `bloquearStudio()` with a message and a redirect to `/escaner` — hiding the sidebar link is not enough, since the section is just a client-side tab.
- Everyone else gets `null` and is denied entry.

Each entry in `SECCIONES_ADMIN` carries a `roles: [...]` list; `aplicarRol()` hides both the section and its sidebar button for roles not listed, and `mostrarSeccionAdmin()` refuses a forbidden section with `avisarSinPermiso()` instead of silently doing nothing. **This is UI-only gating** — real enforcement lives in the RLS policies (`es_admin()` / `es_encargado(evento_id)` / `es_escaner()`), since anyone on the team holds a valid bearer token and could call the REST API directly. The policy matrix was verified against the live database per role (reads, writes, and privilege-escalation attempts).

The **Equipo** screen (admin-only) is a grid of square `.colab-card`s built by `drawEquipo()`; clicking one opens `#overlay-equipo`, whose body `renderEquipoModal()` draws from the `EQ` draft object (same rule as the checkout: inputs write to `EQ` via `oninput` without re-rendering; only structural changes redraw). Saving replaces that person's `colaborador_rol` rows wholesale — one person, one role, with its scope (`eqFilasRol()`).

The old `staff` table is **dead but not dropped**: `roles-equipo.sql` migrates its emails into `colaboradores` as global `escaner`, and `es_staff()` was redefined to mean "has any Studio role". Nothing in `js/app.js` reads `staff` any more.

### Cortesías (comp tickets)

The **Cortesías** section (`roles: ["admin","encargado"]`, so the scanner never sees it) issues a valid ticket by hand and mails it, with no Mercado Pago in the middle. `enviarCortesia()` inserts one `compras` row with `origen:'cortesia'`, `estado:'aprobado'`, `total:0` and `user_id:null` — same table as a sale, so **the door scanner accepts it with no changes**.

The insert is one of the few writes the browser makes to `compras`, so the policy (`compras_cortesia_equipo`, `sql/cortesias.sql`) pins all four things that matter: `origen='cortesia'`, `estado='aprobado'`, `usada=false`, and `es_encargado(evento_id)` — checked against **the row's own `evento_id`**, so an encargado scoped to one event can't comp another one's. `compras_alta_publica` was tightened with `origen='venta'` at the same time, or an anon visitor could have inserted a row labelled as a courtesy and skewed the analytics. All of this was verified per role against the live database.

In analytics, a courtesy is **not a sale**: `ventasDeEvento()` (facturación, tickets vendidos, ticket promedio, the chart's sales area, the per-type recaudación) excludes it, while `comprasDeEvento()` still returns it. It *does* consume cupo — someone walking in on a comp occupies a real spot — so it's subtracted from "Disponibles" and counted in the "% vendido" bar, shown as a `+N cortesías` tag next to the type and a note under the KPIs. The CSV export carries an `Origen` column.

**The mail itself is not sent from this repo.** `enviarCortesia()` POSTs to a `enviar-cortesia` Edge Function that, like `crear-pago` and `reenviar-entradas`, **does not exist yet** — so today that call fails, and the UI says so and renders the QR on screen to send by hand. The ticket is already valid either way.

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
- `admin.html` is a dashboard: a fixed 240px sidebar plus a content column with a breadcrumb header. Each `.admin-section` is one tab, shown one at a time by `mostrarSeccionAdmin(clave)` toggling `.activa`; the list of tabs is `SECCIONES_ADMIN` in `app.js`. To add a section you need three things: the `<div class="admin-section" id="sec-<clave>">`, a `<button class="dash-nav-item" id="nav-<clave>">` in the sidebar, and an entry in `SECCIONES_ADMIN` (with its `roles` list). If it's admin-only, that `roles` list is the single place to say so — `aplicarRol()` hides the section *and* its sidebar button from it. (The old `initColapsables()` collapsible sections are gone; sections are tabs now.)

### Eventos (Studio): lista → detalle con Analytics

"Eventos" has two views inside its one `.admin-section`, toggled by `mostrarVistaEventos()`: `#ev-vista-lista` (simple `.ev-item` rows — name, date, status pill — where the whole row opens the event) and `#ev-vista-detalle`, which holds two tabs (`mostrarTabEvento()`): **Analytics** and **Editar evento**. The event form was not duplicated — it's the same `#ev-form` markup, now living inside `#ev-pane-editar`. `EV_DETALLE` is the open event's id; `null` means the list, a new event, or a duplicate — and in those last two the tabs are hidden, since something unsaved has no analytics. There is no "Crear evento" button in the header any more: it's `#ev-nuevo-btn` at the end of the list. Ver/Duplicar/Borrar moved from the list cards to `#ev-detalle-acciones` in the detail header.

Analytics is computed, never stored: `comprasDeEvento()` filters approved `compras` by `evento_id` (falling back to the event *name* for rows predating `evento_id`), and the visits come from `evento_vistas` loaded per event into `VISTAS_EVENTO`. With no sales the KPIs render `$0`/`0` — never `NaN`, never placeholder data. The chart (`pintarChartEvento`) is hand-built SVG like the Resumen one, but dual-axis: sales as an area scaled to its own max, visits as a line scaled to theirs (they don't share a unit), one bucket per day from `eventos.creado_en` to today capped at 90, with an invisible `.ev-chart-banda` rect per day driving the hover tooltip. `descargarVentasEvento()` exports one CSV line **per order and type** (grouped by `grupo` + type), not one per QR, so "cantidad" and "monto" read like a sale.
