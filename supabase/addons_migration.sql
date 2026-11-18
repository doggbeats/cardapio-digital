-- Adicionais e observação nos pedidos.
-- Execute este arquivo no SQL Editor do Supabase. Ele apenas substitui a função
-- place_order; não recria tabelas nem altera o cardápio.
-- O molho especial custa 300 centavos (R$ 3,00) por unidade do produto.

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
