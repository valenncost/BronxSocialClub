-- ============================================================
-- BRONX SOCIAL CLUB — 02: Row Level Security
-- Correr después de 01-tablas.sql
--
-- El front manda el token que tenga (la clave anon si no hay sesión, o el
-- token del usuario si la hay) y nada más. TODO el control de quién puede
-- leer y escribir qué está acá abajo: si una policy está mal, el panel de
-- admin se puede saltear llamando a la API REST a mano.
-- ============================================================


-- ============================================================
-- QUIÉN ES ADMIN Y QUIÉN ES STAFF
-- ============================================================
-- ⚠️ OJO AL ORDEN: `roles-equipo.sql` (que va después de este archivo)
-- REDEFINE es_admin() y es_staff() para que salgan de las tablas
-- colaboradores/colaborador_rol en vez de la tabla staff. Estas dos de acá
-- abajo son la versión vieja: quedan para que una base nueva funcione entre
-- el paso 2 y el paso 5, pero la definición que manda es la de
-- roles-equipo.sql. Si volvés a correr este archivo sobre una base ya
-- migrada, corré roles-equipo.sql de nuevo después.
--
-- ⚠️ CAMBIAR ESTE MAIL por el del dueño de Bronx (Nano Rabbione) antes de
-- entregar, y poner el mismo en ADMIN_EMAIL de js/app.js (y en el es_admin()
-- de roles-equipo.sql).
create or replace function public.es_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('costanzovalentino09@gmail.com');
$$;

-- security definer para que pueda leer staff sin chocar con la RLS de staff
-- (si no, la policy de staff se llamaría a sí misma).
create or replace function public.es_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Mail del que está pidiendo. Vacío si es la clave anon (visitante sin cuenta).
create or replace function public.mi_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;


alter table public.eventos      enable row level security;
alter table public.tipos_ticket enable row level security;
alter table public.compras      enable row level security;
alter table public.perfiles     enable row level security;
alter table public.staff        enable row level security;
alter table public.galeria      enable row level security;


-- ============================================================
-- EVENTOS — los publicados los ve cualquiera; los toca solo el admin
-- ============================================================
drop policy if exists eventos_lectura_publica on public.eventos;
create policy eventos_lectura_publica on public.eventos
  for select using (activo);

drop policy if exists eventos_lectura_admin on public.eventos;
create policy eventos_lectura_admin on public.eventos
  for select using (public.es_admin());

drop policy if exists eventos_escritura_admin on public.eventos;
create policy eventos_escritura_admin on public.eventos
  for all using (public.es_admin()) with check (public.es_admin());


-- ============================================================
-- TIPOS DE TICKET — se ven los activos y no ocultos
-- ============================================================
-- Los ocultos (los que se desbloquean con código) quedan fuera a propósito:
-- si el público pudiera leerlos, leería también codigo_acceso. Cuando se
-- implemente esa función va a hacer falta una RPC que reciba el código y
-- devuelva los tipos que coinciden.
drop policy if exists tipos_lectura_publica on public.tipos_ticket;
create policy tipos_lectura_publica on public.tipos_ticket
  for select using (
    activo and not oculto
    and exists (select 1 from public.eventos e where e.id = evento_id and e.activo)
  );

drop policy if exists tipos_lectura_admin on public.tipos_ticket;
create policy tipos_lectura_admin on public.tipos_ticket
  for select using (public.es_admin());

drop policy if exists tipos_escritura_admin on public.tipos_ticket;
create policy tipos_escritura_admin on public.tipos_ticket
  for all using (public.es_admin()) with check (public.es_admin());


-- ============================================================
-- COMPRAS — lo más sensible de la base
-- ============================================================
-- Cada fila tiene "codigo", que es exactamente lo que el escáner acepta en la
-- puerta, más el nombre y el mail del comprador. Un visitante sin sesión NO
-- puede leer nada de acá: para contar entradas vendidas está la vista
-- ventas_por_tipo (03-vistas.sql), que solo devuelve totales.
--
-- Nadie inserta compras desde el navegador: las crea la Edge Function
-- crear-pago con la service_role key, que se saltea la RLS.

drop policy if exists compras_lectura_propia on public.compras;
create policy compras_lectura_propia on public.compras
  for select to authenticated
  using (lower(email) = public.mi_email());

drop policy if exists compras_lectura_equipo on public.compras;
create policy compras_lectura_equipo on public.compras
  for select using (public.es_admin() or public.es_staff());

-- El escáner marca la entrada como usada. Se le deja el UPDATE completo
-- porque PostgREST no limita columnas; el riesgo real (que un escáner cambie
-- un precio) no existe: el total ya se cobró.
drop policy if exists compras_marcar_usada on public.compras;
create policy compras_marcar_usada on public.compras
  for update using (public.es_admin() or public.es_staff())
  with check (public.es_admin() or public.es_staff());

drop policy if exists compras_borrado_admin on public.compras;
create policy compras_borrado_admin on public.compras
  for delete using (public.es_admin());


-- ============================================================
-- PERFILES — cada uno el suyo; el admin los ve todos
-- ============================================================
drop policy if exists perfiles_lectura_propia on public.perfiles;
create policy perfiles_lectura_propia on public.perfiles
  for select to authenticated using (id = auth.uid());

drop policy if exists perfiles_lectura_admin on public.perfiles;
create policy perfiles_lectura_admin on public.perfiles
  for select using (public.es_admin());

drop policy if exists perfiles_alta_propia on public.perfiles;
create policy perfiles_alta_propia on public.perfiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists perfiles_edicion_propia on public.perfiles;
create policy perfiles_edicion_propia on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());


-- ============================================================
-- STAFF — cada uno puede preguntar si él está; la lista la ve el admin
-- ============================================================
-- Al iniciar sesión, determinarRol() consulta staff?email=eq.<su mail> para
-- saber si puede escanear. Por eso alcanza con dejar leer la propia fila.
drop policy if exists staff_lectura_propia on public.staff;
create policy staff_lectura_propia on public.staff
  for select to authenticated using (lower(email) = public.mi_email());

drop policy if exists staff_lectura_admin on public.staff;
create policy staff_lectura_admin on public.staff
  for select using (public.es_admin());

drop policy if exists staff_escritura_admin on public.staff;
create policy staff_escritura_admin on public.staff
  for all using (public.es_admin()) with check (public.es_admin());


-- ============================================================
-- GALERÍA — pública para ver, admin para cargar
-- ============================================================
drop policy if exists galeria_lectura_publica on public.galeria;
create policy galeria_lectura_publica on public.galeria
  for select using (true);

drop policy if exists galeria_escritura_admin on public.galeria;
create policy galeria_escritura_admin on public.galeria
  for all using (public.es_admin()) with check (public.es_admin());
</content>
