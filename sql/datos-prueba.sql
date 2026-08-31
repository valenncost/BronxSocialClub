-- ============================================================
-- BRONX SOCIAL CLUB — datos de prueba
-- Dos eventos de ejemplo con sus tipos de ticket, replicando cómo
-- vende Bronx realmente (ver BRONX-SPEC.md §3). Correr después de
-- 01-tablas.sql (y 02/03/04 si querés ver la vista de ventas y el
-- panel funcionando con datos).
--
-- Se puede correr de nuevo sin duplicar: cada evento se busca por
-- nombre antes de insertarlo, y sus tipos_ticket se borran y se
-- vuelven a crear.
-- ============================================================


-- ============================================================
-- EVENTO 1 — Cachengue es de Bronx (sábado)
-- ============================================================
insert into public.eventos (nombre, fecha_texto, puertas, lugar, direccion, descripcion, arte, color_acento, activo, pasado)
select
  'Cachengue es de Bronx',
  'Sáb 18 Jul 2026',
  'Cena 22hs · Cachengue 01:30 · Cierre 06:00',
  'Bronx Social Club',
  'Casanova 888, Bahía Blanca',
  'Edad mínima: 18 años.',
  'naranja',
  'naranja',
  true,
  false
where not exists (
  select 1 from public.eventos where nombre = 'Cachengue es de Bronx'
);

delete from public.tipos_ticket
where evento_id = (select id from public.eventos where nombre = 'Cachengue es de Bronx');

insert into public.tipos_ticket
  (evento_id, nombre, descripcion, precio, cantidad, orden, categoria, accesos, activo, valido_desde, valido_hasta)
select e.id, t.nombre, t.descripcion, t.precio, t.cantidad, t.orden, t.categoria, t.accesos, true, t.valido_desde, t.valido_hasta
from (select id from public.eventos where nombre = 'Cachengue es de Bronx') e
cross join (values
  -- TICKETS
  ('LA TERRAZA - PREVIA DE AMIGOS',        'Acceso exclusivo terrazas. Barra libre de 00:30 a 02:30',                     17000, null::integer, 1, 'ticket', 1, '00:30', '02:30'),
  ('GENERAL + CONSUMICIÓN H/02AM',         'Acceso general con consumición, válido desde 23:30 hasta 02:00',              8000, null::integer, 2, 'ticket', 1, '23:30', '02:00'),
  ('ACCESO LIBERADO H/01.30AM',            'Acceso sin cargo, válido desde 23:30 hasta 01:30',                                0, null::integer, 3, 'ticket', 1, '23:30', '01:30'),
  ('GENERAL 1',                            'Acceso general, válido desde 23:30, sin límite de horario',                   8000, null::integer, 4, 'ticket', 1, '23:30', null),
  ('GENERAL 2',                            'Acceso general, válido desde 23:30, sin límite de horario',                  10000, null::integer, 5, 'ticket', 1, '23:30', null),
  -- COMBOS
  ('5 ACCESOS + BOTELLA DE FERNET',        'Incluye 5 entradas, más botella de Fernet Branca 1L con Coca Cola',         115000, null::integer, 6, 'combo',  5, null,    null),
  ('5 ACCESOS + BOTELLA SERNOVA C/SPEED',  'Incluye 5 accesos, más una botella de Vodka Sernova con 4 latas de Speed',   95000, null::integer, 7, 'combo',  5, null,    null),
  ('5 ACCESOS + BOTELLA SPIRITO BLU',      'Incluye 5 accesos, más botella Gin Spirito Blu con botella de tónica',       95000, null::integer, 8, 'combo',  5, null,    null)
) as t(nombre, descripcion, precio, cantidad, orden, categoria, accesos, valido_desde, valido_hasta);


-- ============================================================
-- EVENTO 2 — Jueves Picante
-- ============================================================
insert into public.eventos (nombre, fecha_texto, puertas, lugar, direccion, descripcion, arte, color_acento, activo, pasado)
select
  'Jueves Picante',
  'Jue 16 Jul 2026',
  'Cena 22hs · Previa 00hs',
  'Bronx Social Club',
  'Casanova 888, Bahía Blanca',
  'Edad mínima: 18 años.',
  'rojo',
  'rojo',
  true,
  false
where not exists (
  select 1 from public.eventos where nombre = 'Jueves Picante'
);

delete from public.tipos_ticket
where evento_id = (select id from public.eventos where nombre = 'Jueves Picante');

insert into public.tipos_ticket
  (evento_id, nombre, descripcion, precio, cantidad, orden, categoria, accesos, activo, valido_desde, valido_hasta)
select e.id, t.nombre, t.descripcion, t.precio, t.cantidad, t.orden, t.categoria, t.accesos, true, t.valido_desde, t.valido_hasta
from (select id from public.eventos where nombre = 'Jueves Picante') e
cross join (values
  ('GENERAL', 'Acceso general desde las 00:00', 6000, null::integer, 1, 'ticket', 1, '00:00', null),
  ('PREVIA',  'Acceso hasta la 01:00',          4000, null::integer, 2, 'ticket', 1, null,    '01:00')
) as t(nombre, descripcion, precio, cantidad, orden, categoria, accesos, valido_desde, valido_hasta);
