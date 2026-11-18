-- Configuração completa do banco do cardápio digital.
-- Execute UMA VEZ no Supabase: Dashboard -> SQL Editor -> New query -> Cole -> Run.
-- O script é seguro para executar novamente (não duplica dados nem quebra nada).

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'order_status' and n.nspname = 'public'
  ) then
    execute 'create type public.order_status as enum ('
      || '''pending'', ''preparing'', ''ready'', ''out_for_delivery'', ''delivered'', ''cancelled''
      || ')';
  end if;
end $$;

create table if not exists public.menu_catalog (
  id bigint primary key,
  name text not null,
  price_cents integer not null check (price_cents > 0),
  available boolean not null default true,
  description text not null default '',
  category text not null default 'Burgers',
  image text not null default '',
  old_price_cents integer,
  badge text
);

insert into public.menu_catalog (id, name, price_cents) values
  (1, 'Clássico da Casa', 3290),
  (2, 'Duplo Cheddar', 3690),
  (3, 'Batata rústica', 1890),
  (4, 'Limonada da casa', 1290),
  (5, 'Hot Dog Especial', 2490),
  (6, 'Combo Brasa', 4990),
  (7, 'Bacon na Brasa', 3890),
  (8, 'BBQ Crocante', 3990),
  (9, 'Frango Crocante', 3490),
  (10, 'Veggie da Horta', 3390),
  (11, 'Hot Dog Cheddar', 2790),
  (12, 'Combo Duplo', 7990),
  (13, 'Anéis de Cebola', 1790),
  (14, 'Frango em Pedaços', 2290),
  (15, 'Milk-shake de Chocolate', 1690),
  (16, 'Soda de Frutas Vermelhas', 1490)
on conflict (id) do nothing;

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_name text,
  customer_email text not null,
  customer_phone text,
  customer_address text not null,
  items jsonb not null,
  subtotal_cents integer not null check (subtotal_cents > 0),
  delivery_fee_cents integer not null check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents = subtotal_cents + delivery_fee_cents),
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.menu_catalog enable row level security;
alter table public.orders enable row level security;

grant select on public.menu_catalog to anon, authenticated;
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

drop policy if exists "Anyone can read the menu catalog" on public.menu_catalog;
create policy "Anyone can read the menu catalog"
  on public.menu_catalog
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Customers and admins can read orders" on public.orders;
create policy "Customers and admins can read orders"
  on public.orders
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can update order status" on public.orders;
create policy "Admins can update order status"
  on public.orders
  for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Pedidos: valida produto, quantidade, molho especial (R$ 3,00) e observação.
create or replace function public.place_order(p_items jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order public.orders;
  validated_items jsonb;
  subtotal integer;
  delivery_fee integer := 500;
  delivery_address text;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to place an order.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be a JSON array.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'An order must contain at least one item.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(id bigint, quantity integer, special_sauce boolean, note text)
    left join public.menu_catalog as product on product.id = requested.id
    where product.id is null
      or product.available is not true
      or requested.quantity not between 1 and 20
  ) then
    raise exception 'An order contains an unavailable product or invalid quantity.';
  end if;

  if exists (
    select requested.id
    from jsonb_to_recordset(p_items) as requested(id bigint, quantity integer, special_sauce boolean, note text)
    group by requested.id, coalesce(requested.special_sauce, false), nullif(trim(coalesce(requested.note, '')), '')
    having count(*) > 1
  ) then
    raise exception 'The same product with the same options can only appear once.';
  end if;

  select user_record.raw_user_meta_data ->> 'address'
  into delivery_address
  from auth.users as user_record
  where user_record.id = auth.uid();

  if nullif(trim(delivery_address), '') is null then
    raise exception 'A delivery address is required to place an order.';
  end if;

  select
    sum(
      (product.price_cents + case when coalesce(requested.special_sauce, false) then 300 else 0 end)
      * requested.quantity
    )::integer,
    jsonb_agg(jsonb_build_object(
      'id', product.id,
      'name', product.name,
      'quantity', requested.quantity,
      'unit_price_cents',
        product.price_cents + case when coalesce(requested.special_sauce, false) then 300 else 0 end,
      'special_sauce', coalesce(requested.special_sauce, false),
      'note', nullif(trim(coalesce(requested.note, '')), '')
    ))
  into subtotal, validated_items
  from jsonb_to_recordset(p_items) as requested(id bigint, quantity integer, special_sauce boolean, note text)
  join public.menu_catalog as product on product.id = requested.id;

  insert into public.orders (
    user_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    items,
    subtotal_cents,
    delivery_fee_cents,
    total_cents
  )
  select
    auth.uid(),
    user_record.raw_user_meta_data ->> 'full_name',
    user_record.email,
    user_record.raw_user_meta_data ->> 'phone',
    delivery_address,
    validated_items,
    subtotal,
    delivery_fee,
    subtotal + delivery_fee
  from auth.users as user_record
  where user_record.id = auth.uid()
  returning * into new_order;

  if new_order.id is null then
    raise exception 'Could not create the order for the current account.';
  end if;

  return new_order;
end;
$$;

revoke all on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;

-- Descrição, categoria, imagem, promoção e selo dos produtos do cardápio.
alter table public.menu_catalog
  add column if not exists description text not null default '',
  add column if not exists category text not null default 'Burgers',
  add column if not exists image text not null default '',
  add column if not exists old_price_cents integer,
  add column if not exists badge text;

update public.menu_catalog set
  description = 'Smash 160g, queijo prato, cebola caramelizada e molho da casa.',
  category = 'Burgers',
  image = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=85',
  badge = 'Mais pedido'
where id = 1;

update public.menu_catalog set
  description = 'Dois smash burgers, cheddar cremoso e picles artesanal.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/1633527/pexels-photo-1633527.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = 4290,
  badge = 'Oferta'
where id = 2;

update public.menu_catalog set
  description = 'Crocante por fora, macia por dentro. Acompanha aioli.',
  category = 'Acompanhamentos',
  image = 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=85'
where id = 3;

update public.menu_catalog set
  description = 'Limão-taiti, toque de siciliano e hortelã fresca.',
  category = 'Bebidas',
  image = 'https://images.pexels.com/photos/410648/pexels-photo-410648.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 4;

update public.menu_catalog set
  description = 'Salsicha artesanal, molho da casa, queijo e batata palha.',
  category = 'Hot Dog',
  image = 'https://images.unsplash.com/photo-1612392062631-94dd858cba88?auto=format&fit=crop&w=800&q=85',
  badge = 'Da casa'
where id = 5;

update public.menu_catalog set
  description = 'Clássico da Casa, batata rústica e bebida gelada.',
  category = 'Combos',
  image = 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=85',
  badge = 'Completo'
where id = 6;

update public.menu_catalog set
  description = 'Smash 160g, queijo, bacon crocante e maionese defumada.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 7;

update public.menu_catalog set
  description = 'Burger artesanal, cheddar, cebola crispy e molho barbecue.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 8;

update public.menu_catalog set
  description = 'Frango empanado, queijo, alface e molho especial.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 9;

update public.menu_catalog set
  description = 'Burger vegetal, queijo, rúcula e molho de ervas.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/1547637/pexels-photo-1547637.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 10;

update public.menu_catalog set
  description = 'Salsicha artesanal, cheddar cremoso e cebola crispy.',
  category = 'Hot Dog',
  image = 'https://images.pexels.com/photos/4676409/pexels-photo-4676409.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 11;

update public.menu_catalog set
  description = 'Dois burgers clássicos, batata rústica e duas bebidas.',
  category = 'Combos',
  image = 'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 12;

update public.menu_catalog set
  description = 'Cebola empanada e crocante, acompanhada de molho da casa.',
  category = 'Acompanhamentos',
  image = 'https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 13;

update public.menu_catalog set
  description = 'Tiras de frango empanadas com molho barbecue.',
  category = 'Acompanhamentos',
  image = 'https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 14;

update public.menu_catalog set
  description = 'Milk-shake cremoso de chocolate com cobertura.',
  category = 'Bebidas',
  image = 'https://images.pexels.com/photos/103566/pexels-photo-103566.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 15;

update public.menu_catalog set
  description = 'Soda italiana refrescante com frutas vermelhas.',
  category = 'Bebidas',
  image = 'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=800'
where id = 16;

-- Armazenamento público para as imagens enviadas pelo painel Admin.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Product images are public" on storage.objects;
create policy "Product images are public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

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
