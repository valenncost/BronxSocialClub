-- ============================================================
-- BRONX SOCIAL CLUB — checkout de 4 pasos + compra sin cuenta
-- ============================================================
-- Correr después de 02-rls.sql (usa public.es_admin() / public.mi_email()).
-- Se puede correr de nuevo sin romper nada.
--
-- Qué agrega:
--  1. Datos del comprador y del asistente en `compras` (el checkout nuevo
--     pide DNI por asistente y datos de facturación del comprador).
--  2. `compras.user_id`: null cuando la compra es de un invitado. NO se le
--     crea cuenta a nadie automáticamente; el QR se manda por mail igual.
--  3. Policy de INSERT para que un invitado (rol anon) pueda comprar, sin
--     que pueda leer compras ajenas ni auto-emitirse entradas aprobadas.
--  4. `cupones`: la tabla queda vacía a propósito — el input de "código de
--     descuento" del paso 1 ya consulta contra ella y hoy siempre responde
--     "código inválido". Cuando exista el sistema de cupones se cargan filas
--     acá y el front no cambia.
-- ============================================================


-- ============================================================
-- COMPRAS — datos del comprador y del asistente
-- ============================================================
-- Igual que evento/tipo, van desnormalizados (una fila por QR, todas las
-- filas de una orden comparten `grupo`): la entrada tiene que seguir siendo
-- legible aunque después se borre el evento, el tipo o la cuenta.
alter table public.compras
  -- del asistente (uno por QR)
  add column if not exists documento            text,
  -- del comprador (mismo valor en todas las filas de la orden)
  add column if not exists comprador_nombre     text,
  add column if not exists comprador_apellido   text,
  add column if not exists comprador_tipo_doc   text,
  add column if not exists comprador_documento  text,
  add column if not exists comprador_telefono   text,
  -- null = compró como invitado, sin cuenta
  add column if not exists user_id              uuid references auth.users(id) on delete set null;

create index if not exists compras_user_idx on public.compras (user_id);


-- ============================================================
-- COMPRAS — alta desde el navegador (invitado o logueado)
-- ============================================================
-- El `with check` es lo que hace que esto sea seguro: cualquiera puede
-- INSERTAR una compra, pero solo en estado 'pendiente' y sin marcar usada,
-- así nadie se auto-emite una entrada válida para la puerta. Aprobarla sigue
-- siendo cosa del webhook de Mercado Pago (service_role, se saltea la RLS).
--
-- Leer sigue prohibido para anon: no hay policy de SELECT para ese rol, así
-- que un invitado puede comprar pero no puede leer NINGUNA compra, ni la
-- suya ni la ajena. Por eso el alta se manda con Prefer: return=minimal
-- (si pidiera la fila de vuelta, PostgREST necesitaría permiso de SELECT).
drop policy if exists compras_alta_publica on public.compras;
create policy compras_alta_publica on public.compras
  for insert to anon, authenticated
  with check (estado = 'pendiente' and usada = false);


-- ============================================================
-- CUPONES (todavía sin sistema de descuentos: tabla vacía a propósito)
-- ============================================================
create table if not exists public.cupones (
  id           bigserial primary key,
  codigo       text not null,
  descripcion  text,
  -- uno de los dos, no los dos: porcentaje 0-100 o monto fijo en pesos
  porcentaje   integer check (porcentaje is null or (porcentaje between 1 and 100)),
  monto        integer check (monto is null or monto > 0),
  usos_max     integer,                      -- null = sin límite
  usos         integer not null default 0,
  vence_en     timestamptz,                  -- null = no vence
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create unique index if not exists cupones_codigo_idx on public.cupones (upper(codigo));

alter table public.cupones enable row level security;

-- Público: sólo los vigentes, y sólo para poder validar el código que tipeó.
-- No expone nada sensible: el cupón ES el código.
drop policy if exists cupones_lectura_publica on public.cupones;
create policy cupones_lectura_publica on public.cupones
  for select using (
    activo
    and (vence_en is null or vence_en > now())
    and (usos_max is null or usos < usos_max)
  );

drop policy if exists cupones_lectura_admin on public.cupones;
create policy cupones_lectura_admin on public.cupones
  for select using (public.es_admin());

drop policy if exists cupones_escritura_admin on public.cupones;
create policy cupones_escritura_admin on public.cupones
  for all using (public.es_admin()) with check (public.es_admin());
