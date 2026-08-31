-- ============================================================
-- BRONX SOCIAL CLUB — color de acento por evento
-- ============================================================
-- Cada evento puede tener su propio color, que reemplaza al naranja de la
-- marca en TODA su página de detalle (botones, tarjeta de ticket elegida,
-- selector de cantidad, glows) y en el glow de su tarjeta en la portada.
-- El header, el footer y el resto del sitio siguen en naranja.
--
-- Se guarda la CLAVE del color, no el hex: los valores exactos de cada uno
-- (son pares para degradado) viven en css/estilos.css, en el bloque
-- "COLOR DE ACENTO POR EVENTO". Así se retoca la paleta sin migrar datos.
--
-- Correr después de 01-tablas.sql. Se puede correr de nuevo sin romper nada.
-- ============================================================

alter table public.eventos
  add column if not exists color_acento text not null default 'naranja';

-- El check va aparte de la columna porque "add column if not exists" no
-- vuelve a aplicarlo si la columna ya existía.
alter table public.eventos
  drop constraint if exists eventos_color_acento_check;

alter table public.eventos
  add constraint eventos_color_acento_check
  check (color_acento in ('naranja','rojo','blanco','violeta','verde'));
