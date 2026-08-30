-- ============================================================
-- BRONX SOCIAL CLUB — 03: vista de ventas
-- Correr después de 02-rls.sql
-- ============================================================

-- La página del evento necesita saber cuántas entradas se vendieron de cada
-- tipo para tachar los que se agotaron. Pero la tabla compras no la puede leer
-- un visitante sin cuenta: ahí está el "codigo" que abre la puerta.
--
-- Esta vista devuelve SOLO totales. La vista corre con los permisos de su
-- dueño (security_invoker off, que es el default) y por eso puede contar
-- filas de compras sin que quien la consulta pueda verlas.
--
-- NUNCA agregarle columnas con datos por comprador (codigo, email, nombre).
create or replace view public.ventas_por_tipo as
  select
    tipo_ticket_id,
    count(*)::int as vendidas
  from public.compras
  where lower(estado) = 'aprobado'
    and tipo_ticket_id is not null
  group by tipo_ticket_id;

alter view public.ventas_por_tipo set (security_invoker = off);

grant select on public.ventas_por_tipo to anon, authenticated;
</content>
