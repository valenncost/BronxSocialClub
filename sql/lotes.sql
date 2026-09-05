-- ============================================================
-- BRONX SOCIAL CLUB — LOTES (modelo de precios por etapa)
-- Correr DESPUÉS de 03-vistas.sql y de roles-equipo.sql
-- (usa es_escaner() / es_encargado(), que roles-equipo.sql redefine).
-- ============================================================
--
-- QUÉ CAMBIA
-- Hasta acá cada tipo_ticket tenía su propio precio y su propio cupo, y todos
-- se vendían al mismo tiempo. Ahora el precio y el cupo salen de LOTES:
--
--   * Un evento tiene UNA secuencia de lotes ordenados (Early Bird, Lote 1,
--     Lote 2, ...), cada uno con su NOMBRE, su PRECIO y su CUPO.
--   * Se vende UNO A LA VEZ: el vigente es el PRIMERO por orden que todavía
--     tenga cupo. No hay ningún flag "activo" que alguien tenga que tocar:
--     cuando se llena el cupo, la vista pasa sola al siguiente.
--   * Si no queda ningún lote con cupo, el evento se queda sin entradas
--     (mismo efecto que el flag "agotado").
--
-- LA ESCALERA ES PÚBLICA
-- La página del evento muestra TODOS los lotes con su precio: el vigente
-- marcado "en venta" y los que vienen "próximamente", en gris. Por eso
-- lotes_publicos deja leer la secuencia entera y no sólo el vigente.
--
-- LOS COMBOS QUEDAN AFUERA
-- tipos_ticket.usa_lotes = false ⇒ ese tipo conserva su precio y su cupo
-- propios (tipos_ticket.precio / tipos_ticket.cantidad). Es el caso de los
-- combos con botella. Sus ventas NO descuentan del cupo del lote: llevan
-- compras.lote_id = null.
-- ============================================================


-- ============================================================
-- LOTES
-- ============================================================
create table if not exists public.lotes (
  id         bigserial primary key,
  evento_id  bigint not null references public.eventos(id) on delete cascade,
  nombre     text not null,                       -- "Early Bird", "Lote 1", ...
  orden      integer not null default 0,          -- la secuencia; 0 primero
  precio     integer not null default 0 check (precio >= 0),
  -- Cupo del lote: entradas (de los tipos que van por lote) que se venden a
  -- ese precio. null = sin límite: ese lote nunca se agota y los que vengan
  -- después quedan inalcanzables. Sirve para el último de la fila.
  cupo       integer check (cupo is null or cupo >= 0),
  -- "Quedan las últimas N!" en la página del evento. null = no mostrar nunca
  -- ese aviso; un número = mostrarlo cuando resten esa cantidad o menos. Lo
  -- decide el organizador lote por lote, no es automático.
  aviso_ultimas integer check (aviso_ultimas is null or aviso_ultimas >= 0),
  creado_en  timestamptz not null default now()
);

create index if not exists lotes_evento_idx on public.lotes (evento_id, orden);


-- ============================================================
-- COLUMNAS NUEVAS
-- ============================================================
-- Quién toma el precio del lote y quién conserva el suyo (los combos).
alter table public.tipos_ticket
  add column if not exists usa_lotes boolean not null default true;

-- En qué lote se vendió cada entrada. Se guarda el id Y el nombre, igual que
-- evento/evento_id y tipo/tipo_ticket_id: la entrada tiene que seguir siendo
-- legible aunque después se borre el lote.
alter table public.compras
  add column if not exists lote_id bigint references public.lotes(id) on delete set null;
alter table public.compras
  add column if not exists lote text;

create index if not exists compras_lote_idx on public.compras (lote_id);


-- ============================================================
-- VISTA: LA ESCALERA DE LOTES, CON LO VENDIDO DE CADA UNO
-- ============================================================
-- Devuelve todos los lotes de los eventos publicados, con cuántas se
-- vendieron y si es el vigente. El público la usa para pintar la escalera
-- entera (el que está en venta y los que vienen).
--
-- Corre con los permisos de su dueño (security_invoker = off), así puede
-- contar filas de compras sin que quien la consulta pueda verlas: compras
-- tiene el código que abre la puerta. Mismo criterio que ventas_por_tipo
-- (03-vistas.sql). NUNCA agregarle columnas por comprador.
create or replace view public.lotes_publicos as
select
  l.id, l.evento_id, l.nombre, l.orden, l.precio, l.cupo, l.aviso_ultimas,
  coalesce(v.vendidas, 0) as vendidas,
  -- El vigente: el primero de la fila al que todavía le quede lugar
  (l.id = (
    select l2.id from public.lotes l2
    left join (
      select lote_id, count(*)::int as n
      from public.compras
      where lower(estado) = 'aprobado' and lote_id is not null
      group by lote_id
    ) v2 on v2.lote_id = l2.id
    where l2.evento_id = l.evento_id
      and (l2.cupo is null or coalesce(v2.n, 0) < l2.cupo)
    order by l2.orden asc, l2.id asc
    limit 1
  )) as vigente
from public.lotes l
left join (
  select lote_id, count(*)::int as vendidas
  from public.compras
  where lower(estado) = 'aprobado' and lote_id is not null
  group by lote_id
) v on v.lote_id = l.id
where exists (select 1 from public.eventos e where e.id = l.evento_id and e.activo);

alter view public.lotes_publicos set (security_invoker = off);
grant select on public.lotes_publicos to anon, authenticated;


-- ============================================================
-- RLS
-- ============================================================
alter table public.lotes enable row level security;

-- La lectura pública va por la vista de arriba (que además trae las vendidas);
-- la tabla en crudo la lee el equipo, que es el que la edita.
drop policy if exists lotes_lectura_equipo on public.lotes;
create policy lotes_lectura_equipo on public.lotes
  for select using (public.es_escaner());

drop policy if exists lotes_escritura_encargado on public.lotes;
create policy lotes_escritura_encargado on public.lotes
  for all using (public.es_encargado(evento_id)) with check (public.es_encargado(evento_id));


-- ============================================================
-- MIGRACIÓN DE LO QUE YA ESTABA CARGADO
-- ============================================================
-- Los eventos que ya existen pasan a tener un único "Lote 1" SIN CUPO: no se
-- agota solo, así que el sitio se sigue comportando como antes hasta que el
-- organizador arme la escalera real desde el Studio.
--
-- ⚠️ El precio del lote sale del ticket MÁS CARO que tuviera el evento, no del
-- más barato. Antes cada tipo tenía su precio; ahora hay UNO SOLO por lote, y
-- no existe una traducción correcta para un evento con cinco precios
-- distintos. Se toma el más caro porque el error barato es el que no se puede
-- deshacer: si queda bajo, se vende a menos de lo que vale y esas ventas ya
-- están hechas. HAY QUE REVISARLO EVENTO POR EVENTO después de migrar.
--
-- Ojo también: GENERAL 1 ($8.000) y GENERAL 2 ($10.000) del "Cachengue" son de
-- hecho dos lotes escritos como dos tipos distintos. La migración NO los une
-- (no hay forma de adivinar el cupo del primero): hay que rearmarlos a mano
-- como un tipo GENERAL con su Lote 1 y su Lote 2.

-- Los combos conservan precio y cupo propios; el resto va por lote.
update public.tipos_ticket
   set usa_lotes = (categoria <> 'combo');

insert into public.lotes (evento_id, nombre, orden, precio, cupo, aviso_ultimas)
select t.evento_id, 'Lote 1', 0, max(t.precio), null, null
from public.tipos_ticket t
where t.usa_lotes
  and not exists (select 1 from public.lotes l where l.evento_id = t.evento_id)
group by t.evento_id;
