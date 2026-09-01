-- ============================================================
-- BRONX SOCIAL CLUB — Vistas de la página de cada evento
-- Correr después de roles-equipo.sql.
--
-- Alimenta el KPI "Vistas" y la línea de visitas del gráfico de Analytics
-- en el Studio. Una fila = una visita contada.
--
-- Deduplicación en dos capas, porque la sola del navegador no alcanza (el
-- que quiera puede llamar a la API a mano):
--   1. El front no vuelve a insertar si ya contó ese evento en esta sesión
--      (sessionStorage, ver registrarVistaEvento en js/app.js).
--   2. Acá abajo, un índice único por (evento, sesión, día): aunque llegue
--      el mismo insert diez veces, queda una sola visita por sesión y día.
--      El insert repetido devuelve 409 y el front lo ignora en silencio.
-- ============================================================

create table if not exists public.evento_vistas (
  id         bigserial primary key,
  evento_id  bigint not null references public.eventos(id) on delete cascade,
  session_id text not null,
  fecha      timestamptz not null default now(),
  -- Columna generada (no una expresión en el índice): el cast de timestamptz
  -- a date depende del TimeZone de la sesión y por eso no es inmutable, que
  -- es lo que un índice necesita. Fijando UTC sí lo es.
  dia        date generated always as (((fecha at time zone 'UTC')::date)) stored
);

create unique index if not exists evento_vistas_unica
  on public.evento_vistas (evento_id, session_id, dia);
create index if not exists evento_vistas_por_evento
  on public.evento_vistas (evento_id, fecha);


-- ============================================================
-- POLICIES
-- ============================================================
alter table public.evento_vistas enable row level security;

-- Cualquiera que abra la página de un evento suma su visita. Es lo único
-- que puede hacer: no puede leer nada de esta tabla.
drop policy if exists evento_vistas_alta_publica on public.evento_vistas;
create policy evento_vistas_alta_publica on public.evento_vistas
  for insert with check (true);

-- Los números los ve el equipo que ya ve los eventos en el Studio
-- (admin y encargado). El escáner no tiene nada que hacer acá.
drop policy if exists evento_vistas_lectura_equipo on public.evento_vistas;
create policy evento_vistas_lectura_equipo on public.evento_vistas
  for select using (public.es_encargado());

-- Limpieza (por si hay que borrar ruido de pruebas): sólo admin.
drop policy if exists evento_vistas_borrado_admin on public.evento_vistas;
create policy evento_vistas_borrado_admin on public.evento_vistas
  for delete using (public.es_admin());
