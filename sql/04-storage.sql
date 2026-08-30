-- ============================================================
-- BRONX SOCIAL CLUB — 04: storage (bucket "fotos")
-- Correr después de 03-vistas.sql
-- ============================================================
-- Guarda las portadas de los eventos y las fotos/videos de la galería.
-- Es público para leer: las portadas se muestran en la página sin sesión.

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists fotos_lectura_publica on storage.objects;
create policy fotos_lectura_publica on storage.objects
  for select using (bucket_id = 'fotos');

drop policy if exists fotos_escritura_admin on storage.objects;
create policy fotos_escritura_admin on storage.objects
  for all using (bucket_id = 'fotos' and public.es_admin())
  with check (bucket_id = 'fotos' and public.es_admin());
</content>
