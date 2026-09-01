-- ============================================================
-- BRONX SOCIAL CLUB — Roles y permisos del equipo (Studio)
-- Correr después de 02-rls.sql.
--
-- Reemplaza a la tabla `staff` (un solo permiso: escanear) por un sistema
-- de roles con alcance por evento:
--
--   colaboradores    quién es cada persona del equipo (por email)
--   colaborador_rol  qué rol tiene y sobre qué evento
--
-- colaborador_rol.evento_id en NULL significa "ese rol aplica a TODOS los
-- eventos"; con un id, el rol vale sólo para ese evento.
--
-- Los 3 roles:
--   admin      todo el Studio, incluida la pantalla de Equipo.
--   encargado  ver y editar eventos + ver compradores y analytics.
--              NO gestiona roles ni ve configuración sensible.
--   escaner    sólo la pantalla de escaneo de QR (y las compras que
--              necesita para validar en la puerta).
--
-- El mail de ADMIN_EMAIL sigue siendo admin aunque no esté en la tabla:
-- es el bootstrap para que el dueño nunca se quede afuera de su propio
-- panel por un borrado accidental en colaboradores.
-- ============================================================


-- ============================================================
-- 1. TABLAS
-- ============================================================
create table if not exists public.colaboradores (
  id        bigserial primary key,
  nombre    text not null,
  email     text not null,
  telefono  text,
  foto_url  text,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);
-- Un mail = una persona. En minúsculas, porque todo el matcheo de permisos
-- compara con lower(auth.jwt() ->> 'email').
create unique index if not exists colaboradores_email_unico
  on public.colaboradores (lower(email));

create table if not exists public.colaborador_rol (
  id             bigserial primary key,
  colaborador_id bigint not null references public.colaboradores(id) on delete cascade,
  rol            text not null check (rol in ('admin','encargado','escaner')),
  evento_id      bigint references public.eventos(id) on delete cascade,  -- null = todos los eventos
  creado_en      timestamptz not null default now()
);
-- El mismo rol no se repite para el mismo alcance. coalesce porque en un
-- índice único dos NULL no chocan entre sí, y "todos los eventos" tiene que
-- poder cargarse una sola vez.
create unique index if not exists colaborador_rol_unico
  on public.colaborador_rol (colaborador_id, rol, coalesce(evento_id, -1));
create index if not exists colaborador_rol_por_colaborador
  on public.colaborador_rol (colaborador_id);


-- ============================================================
-- 2. FUNCIONES DE PERMISO
-- ============================================================
-- Todas security definer: las policies de colaboradores/colaborador_rol
-- las llaman, así que si leyeran con los permisos del que pregunta se
-- llamarían a sí mismas (recursión infinita en la RLS).

-- ¿El que pregunta tiene este rol? p_evento null = alcanza con tenerlo en
-- cualquier alcance. Con un evento, vale si el rol es global (evento_id
-- null) o si es justo el de ese evento.
create or replace function public.tiene_rol(p_rol text, p_evento bigint default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.colaborador_rol r
    join public.colaboradores c on c.id = r.colaborador_id
    where c.activo
      and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(coalesce(auth.jwt() ->> 'email', '')) <> ''
      and r.rol = p_rol
      and (
        r.evento_id is null
        or p_evento is null
        or r.evento_id = p_evento
      )
  );
$$;

-- ⚠️ CAMBIAR ESTE MAIL por el del dueño de Bronx (Nano Rabbione) antes de
-- entregar, y poner el mismo en ADMIN_EMAIL de js/app.js.
create or replace function public.es_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = lower('costanzovalentino09@gmail.com')
      or public.tiene_rol('admin');
$$;

-- Encargado de ese evento (o de todos). El admin cuenta como encargado.
create or replace function public.es_encargado(p_evento bigint default null)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.es_admin() or public.tiene_rol('encargado', p_evento);
$$;

-- Quien puede escanear en la puerta: escáner, encargado o admin.
create or replace function public.es_escaner(p_evento bigint default null)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.es_encargado(p_evento) or public.tiene_rol('escaner', p_evento);
$$;

-- es_staff() ya existía y la usan las policies de compras: ahora significa
-- "tiene algún rol en el Studio" y sale de colaboradores, no de la tabla
-- staff vieja.
create or replace function public.es_staff()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.es_escaner();
$$;

-- Id del colaborador que pregunta (null si no es del equipo). Lo usa la
-- policy de colaborador_rol para dejarle ver sus propios roles.
create or replace function public.mi_colaborador()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.colaboradores c
  where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and lower(coalesce(auth.jwt() ->> 'email', '')) <> ''
  limit 1;
$$;


-- ============================================================
-- 3. MIGRACIÓN DE LA TABLA staff
-- ============================================================
-- Los que hoy pueden escanear pasan a ser colaboradores con rol escaner
-- sobre todos los eventos. La tabla staff queda en la base (no se borra
-- nada), pero ya no la lee nadie: es_staff() ahora mira colaboradores.
insert into public.colaboradores (nombre, email)
select split_part(s.email, '@', 1), lower(s.email)
from public.staff s
where not exists (
  select 1 from public.colaboradores c where lower(c.email) = lower(s.email)
);

insert into public.colaborador_rol (colaborador_id, rol, evento_id)
select c.id, 'escaner', null
from public.colaboradores c
join public.staff s on lower(s.email) = lower(c.email)
where not exists (
  select 1 from public.colaborador_rol r
  where r.colaborador_id = c.id and r.rol = 'escaner' and r.evento_id is null
);


-- ============================================================
-- 4. POLICIES DE colaboradores / colaborador_rol
-- ============================================================
alter table public.colaboradores   enable row level security;
alter table public.colaborador_rol enable row level security;

-- Cada uno puede leer SU propia ficha: es lo que consulta determinarRol()
-- al entrar al Studio para saber qué puede ver.
drop policy if exists colaboradores_lectura_propia on public.colaboradores;
create policy colaboradores_lectura_propia on public.colaboradores
  for select to authenticated
  using (lower(email) = public.mi_email());

drop policy if exists colaboradores_lectura_admin on public.colaboradores;
create policy colaboradores_lectura_admin on public.colaboradores
  for select using (public.es_admin());

-- Gestionar el equipo es exclusivo del admin (punto 2 del pedido).
drop policy if exists colaboradores_escritura_admin on public.colaboradores;
create policy colaboradores_escritura_admin on public.colaboradores
  for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists colaborador_rol_lectura_propia on public.colaborador_rol;
create policy colaborador_rol_lectura_propia on public.colaborador_rol
  for select to authenticated
  using (colaborador_id = public.mi_colaborador());

drop policy if exists colaborador_rol_lectura_admin on public.colaborador_rol;
create policy colaborador_rol_lectura_admin on public.colaborador_rol
  for select using (public.es_admin());

drop policy if exists colaborador_rol_escritura_admin on public.colaborador_rol;
create policy colaborador_rol_escritura_admin on public.colaborador_rol
  for all using (public.es_admin()) with check (public.es_admin());


-- ============================================================
-- 5. EVENTOS Y TIPOS DE TICKET — se suma el encargado
-- ============================================================
-- El encargado ve todos los eventos (también los pausados, que es lo que
-- necesita el Studio) y edita los que tenga asignados. Un encargado con
-- alcance a un evento puntual NO puede crear eventos nuevos: tiene_rol()
-- con el id de una fila que todavía no le fue asignada da false. Para eso
-- hace falta ser encargado de todos los eventos (evento_id null).
drop policy if exists eventos_lectura_equipo on public.eventos;
create policy eventos_lectura_equipo on public.eventos
  for select using (public.es_escaner());

drop policy if exists eventos_escritura_encargado on public.eventos;
create policy eventos_escritura_encargado on public.eventos
  for all using (public.es_encargado(id)) with check (public.es_encargado(id));

drop policy if exists tipos_lectura_equipo on public.tipos_ticket;
create policy tipos_lectura_equipo on public.tipos_ticket
  for select using (public.es_escaner());

drop policy if exists tipos_escritura_encargado on public.tipos_ticket;
create policy tipos_escritura_encargado on public.tipos_ticket
  for all using (public.es_encargado(evento_id)) with check (public.es_encargado(evento_id));


-- ============================================================
-- 6. COMPRAS — lectura del equipo, borrado sólo admin
-- ============================================================
-- compras_lectura_equipo y compras_marcar_usada ya existen (02-rls.sql) y
-- siguen sirviendo tal cual: usan es_staff(), que arriba se redefinió para
-- salir de colaboradores. El escáner necesita las dos para validar y marcar
-- la entrada en la puerta.
--
-- Se rehacen igual acá para que este archivo sea autosuficiente si se corre
-- después de tocar 02-rls.sql.
drop policy if exists compras_lectura_equipo on public.compras;
create policy compras_lectura_equipo on public.compras
  for select using (public.es_admin() or public.es_staff());

drop policy if exists compras_marcar_usada on public.compras;
create policy compras_marcar_usada on public.compras
  for update using (public.es_admin() or public.es_staff())
  with check (public.es_admin() or public.es_staff());

-- Borrar compras sigue siendo sólo del admin (el botón "borrar pendientes").
drop policy if exists compras_borrado_admin on public.compras;
create policy compras_borrado_admin on public.compras
  for delete using (public.es_admin());


-- ============================================================
-- 7. LO QUE NO CAMBIA — configuración sensible y datos de usuarios
-- ============================================================
-- perfiles (usuarios registrados), patrocinadores y galeria siguen siendo
-- admin-only: el encargado no ve la base de usuarios ni toca la portada.
-- Cuando exista una pantalla de configuración (Mercado Pago, Resend), tiene
-- que quedar detrás de es_admin() igual que estas, y su sección del Studio
-- listada como admin-only en aplicarRol() de js/app.js.
