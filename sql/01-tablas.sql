-- ============================================================
-- BRONX SOCIAL CLUB — 01: tablas
-- Correr primero. Después: 02-rls.sql, 03-vistas.sql, 04-storage.sql
-- ============================================================


-- ============================================================
-- EVENTOS
-- ============================================================
-- Sin precio_general, lotes ni lote_activo: el precio vive en tipos_ticket.
create table if not exists public.eventos (
  id                bigserial primary key,
  nombre            text not null,
  fecha_texto       text,                      -- "Sáb 18 Jul 2026" (texto libre, no fecha real)
  puertas           text,                      -- "Cena 22hs · Cachengue 01:30"
  lugar             text,                      -- nombre corto, ej "Bronx Social Club"
  direccion         text,                      -- para el mapa; null si la ubicación es secreta
  descripcion       text,
  foto_url          text,                      -- portada, sale del bucket "fotos"
  arte              text default 'red',        -- color de respaldo cuando no hay foto
  -- Color de acento del evento: pinta su página de detalle y el glow de su
  -- tarjeta en la portada. Los hex de cada clave están en css/estilos.css.
  color_acento      text not null default 'naranja'
                    check (color_acento in ('naranja','rojo','blanco','violeta','verde')),
  activo            boolean not null default true,
  pasado            boolean not null default false,   -- true = va a la galería de eventos pasados
  agotado           boolean not null default false,   -- agotado a mano desde el panel
  ubicacion_secreta boolean not null default false,
  creado_en         timestamptz not null default now()
);

create index if not exists eventos_activo_idx on public.eventos (activo, pasado);


-- ============================================================
-- TIPOS DE TICKET
-- ============================================================
-- Las CATEGORÍAS del evento, todas a la venta al mismo tiempo: LA TERRAZA,
-- GENERAL, ACCESO LIBERADO, y aparte los combos con botella.
--
-- ⚠️ El precio y el cupo de acá abajo valen SÓLO para los tipos que no van por
-- lote (los combos). Desde `lotes.sql` los demás toman el precio y el cupo del
-- LOTE vigente, y `usa_lotes` dice cuál es cuál. Ver "Cómo quedan los precios"
-- en sql/README.md.
create table if not exists public.tipos_ticket (
  id            bigserial primary key,
  evento_id     bigint not null references public.eventos(id) on delete cascade,
  nombre        text not null,                 -- "GENERAL + CONSUMICIÓN H/02AM"
  descripcion   text,                          -- el texto explicativo bajo el nombre
  precio        integer not null default 0,    -- 0 = entrada gratis (todavía no implementado en el front)
  cantidad      integer,                       -- cupo; null = sin límite
  orden         integer not null default 0,    -- para ordenarlos en la página
  categoria     text not null default 'ticket' check (categoria in ('ticket','combo')),
  accesos       integer not null default 1,    -- cuánta gente entra con ese ticket (5 en los combos)
  activo        boolean not null default true,
  oculto        boolean not null default false,-- solo visible con codigo_acceso (pendiente)
  codigo_acceso text,                          -- código que desbloquea un tipo oculto (pendiente)
  valido_desde  text,                          -- texto libre: "23:30"
  valido_hasta  text,                          -- texto libre: "02:00"
  creado_en     timestamptz not null default now()
);

create index if not exists tipos_ticket_evento_idx on public.tipos_ticket (evento_id, orden);


-- ============================================================
-- COMPRAS (una fila = una entrada = un QR)
-- ============================================================
-- Una compra del carrito genera varias filas, todas con el mismo "grupo".
-- evento y tipo guardan el NOMBRE (texto) para que la entrada siga siendo
-- legible aunque después se borre el evento o el tipo de ticket.
create table if not exists public.compras (
  id              bigserial primary key,
  grupo           text,                        -- nº de orden: agrupa las entradas de una misma compra
  evento          text,                        -- nombre del evento
  evento_id       bigint references public.eventos(id) on delete set null,
  tipo            text,                        -- nombre del tipo de ticket
  tipo_ticket_id  bigint references public.tipos_ticket(id) on delete set null,
  accesos         integer not null default 1,  -- copiado del tipo al comprar
  fecha_texto     text,
  lugar           text,
  nombre          text,
  apellido        text,
  email           text,
  total           integer not null default 0,  -- lo que se pagó por ESTA entrada (incluye el costo de servicio)
  codigo          text unique,                 -- el que lee el escáner
  estado          text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  usada           boolean not null default false,
  usada_en        timestamptz,
  creado_en       timestamptz not null default now()
);

create index if not exists compras_email_idx    on public.compras (lower(email));
create index if not exists compras_evento_idx   on public.compras (evento);
create index if not exists compras_tipo_idx     on public.compras (tipo_ticket_id);
create index if not exists compras_grupo_idx    on public.compras (grupo);


-- ============================================================
-- PERFILES (espejo de auth.users para verlos en el panel)
-- ============================================================
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  email     text,
  nombre    text,
  apellido  text,
  telefono  text,
  creado_en timestamptz not null default now()
);

-- Al registrarse (email o Google) se crea el perfil solo.
-- Google no manda nombre/apellido separados, manda full_name: lo partimos.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  completo text := coalesce(meta ->> 'full_name', meta ->> 'name', '');
begin
  insert into public.perfiles (id, email, nombre, apellido, telefono)
  values (
    new.id,
    new.email,
    coalesce(nullif(meta ->> 'nombre',''),   nullif(split_part(completo, ' ', 1), '')),
    coalesce(nullif(meta ->> 'apellido',''), nullif(substr(completo, strpos(completo, ' ') + 1), completo)),
    meta ->> 'telefono'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();


-- ============================================================
-- STAFF (equipo con acceso al escáner)
-- ============================================================
create table if not exists public.staff (
  id        bigserial primary key,
  email     text not null,
  creado_en timestamptz not null default now()
);

create unique index if not exists staff_email_idx on public.staff (lower(email));


-- ============================================================
-- GALERÍA (fotos y videos de un evento pasado)
-- ============================================================
create table if not exists public.galeria (
  id        bigserial primary key,
  evento_id bigint not null references public.eventos(id) on delete cascade,
  tipo      text not null default 'foto' check (tipo in ('foto','video')),
  url       text not null,
  orden     integer not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists galeria_evento_idx on public.galeria (evento_id, orden);
</content>
