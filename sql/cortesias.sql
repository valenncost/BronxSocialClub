-- ============================================================
-- BRONX SOCIAL CLUB — Cortesías (entradas de invitación)
-- Correr después de roles-equipo.sql.
--
-- Una cortesía es una entrada válida que el organizador o un encargado
-- emiten a mano desde el Studio y se mandan por mail, sin pasar por Mercado
-- Pago. Va en la misma tabla `compras` que una venta (para que el escáner
-- de la puerta la acepte sin saber nada nuevo), pero marcada con
-- origen = 'cortesia' para poder dejarla afuera de la facturación.
--
-- Nota sobre el ROL "admin": en la interfaz ahora se llama "Organizador".
-- El valor guardado sigue siendo 'admin' — renombrarlo obligaría a migrar
-- colaborador_rol, el check constraint y es_admin() sin ganar nada.
-- ============================================================


-- ============================================================
-- 1. DE DÓNDE VIENE CADA FILA DE compras
-- ============================================================
-- Las filas que ya existían son ventas: el default las cubre a todas.
alter table public.compras
  add column if not exists origen text not null default 'venta';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'compras_origen_valido'
  ) then
    alter table public.compras
      add constraint compras_origen_valido check (origen in ('venta','cortesia'));
  end if;
end $$;

create index if not exists compras_origen_idx on public.compras (origen);


-- ============================================================
-- 2. QUIÉN PUEDE EMITIR UNA CORTESÍA
-- ============================================================
-- El equipo del Studio inserta esta fila desde el navegador (una venta real,
-- en cambio, la inserta la Edge Function crear-pago con service_role).
-- Por eso la policy es estricta en las cuatro cosas que importan:
--
--   origen = 'cortesia'   no sirve para colarse a crear "ventas" a mano
--   estado = 'aprobado'   es lo que hace que el escáner la acepte
--   usada  = false        nace sin usar
--   es_encargado(evento_id)
--                         organizador (admin) sobre cualquier evento;
--                         encargado sólo sobre los eventos que tenga
--                         asignados (evento_id null = todos). El rol
--                         escaner da false, así que no puede emitir nada.
--
-- Ojo: es_encargado(evento_id) contra el evento_id de LA FILA que se
-- inserta, no un parámetro suelto — un encargado de un solo evento no
-- puede emitir cortesías de otro.
drop policy if exists compras_cortesia_equipo on public.compras;
create policy compras_cortesia_equipo on public.compras
  for insert to authenticated
  with check (
    origen = 'cortesia'
    and estado = 'aprobado'
    and usada = false
    and evento_id is not null
    and public.es_encargado(evento_id)
  );

-- La policy de alta pública (checkout de invitados) sigue como estaba, pero
-- se rehace acá para dejar explícito que sólo admite ventas pendientes: sin
-- este `origen = 'venta'`, un visitante anónimo podría insertar una fila
-- pendiente marcada como cortesía y ensuciar los números de analytics.
drop policy if exists compras_alta_publica on public.compras;
create policy compras_alta_publica on public.compras
  for insert
  with check (estado = 'pendiente' and usada = false and origen = 'venta');
