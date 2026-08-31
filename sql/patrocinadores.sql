-- ============================================================
-- BRONX SOCIAL CLUB — patrocinadores (sponsors)
-- ============================================================
-- Fila de logos en la portada, debajo de los eventos. Cada fila es un
-- sponsor con su logo (subido al bucket "fotos", el mismo que usan las
-- portadas de evento — ver 04-storage.sql, ya es público para leer y
-- admin para escribir, así que no hace falta tocar el storage).
--
-- Correr después de 02-rls.sql (usa la función public.es_admin()).
-- Se puede correr de nuevo sin romper nada.
-- ============================================================

create table if not exists public.patrocinadores (
  id        bigserial primary key,
  nombre    text not null,
  logo_url  text not null,          -- sale del bucket "fotos"
  link      text,                   -- opcional: adónde lleva el logo al hacer click
  orden     integer not null default 0,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create index if not exists patrocinadores_orden_idx on public.patrocinadores (activo, orden);

alter table public.patrocinadores enable row level security;

-- Público: solo los activos, en su orden
drop policy if exists patrocinadores_lectura_publica on public.patrocinadores;
create policy patrocinadores_lectura_publica on public.patrocinadores
  for select using (activo);

-- Admin: los ve todos (incluidos los pausados) y es el único que escribe
drop policy if exists patrocinadores_lectura_admin on public.patrocinadores;
create policy patrocinadores_lectura_admin on public.patrocinadores
  for select using (public.es_admin());

drop policy if exists patrocinadores_escritura_admin on public.patrocinadores;
create policy patrocinadores_escritura_admin on public.patrocinadores
  for all using (public.es_admin()) with check (public.es_admin());
