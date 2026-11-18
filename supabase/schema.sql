create type public.order_status as enum (
  'pending',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

create table public.menu_catalog (
  id bigint primary key,
  name text not null,
  price_cents integer not null check (price_cents > 0),
  available boolean not null default true
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
  (16, 'Soda de Frutas Vermelhas', 1490);

create table public.orders (
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

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);

alter table public.menu_catalog enable row level security;
alter table public.orders enable row level security;

grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

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
