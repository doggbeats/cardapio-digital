-- Armazenamento das imagens dos produtos enviadas pelo painel Admin.
-- Execute uma vez no SQL Editor do Supabase. Seguro para executar novamente.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- As imagens são públicas para que o cardápio consiga exibi-las sem autenticação.
drop policy if exists "Product images are public" on storage.objects;
create policy "Product images are public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Somente administradores podem enviar/remover imagens pelo navegador.
-- Os uploads do painel usam a chave de serviço no servidor, que ignora RLS.
drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
