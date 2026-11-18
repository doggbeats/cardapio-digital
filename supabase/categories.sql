-- Categorias gerenciadas pelo painel administrativo.
-- Se aparecer "Could not find the table ... in the schema cache", rode:
-- notify pgrst, 'reload schema';
create table if not exists public.product_categories (
  id bigint generated always as identity primary key,
  name text not null unique check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

insert into public.product_categories (name)
select category
from (
  values ('Burgers'), ('Hot Dog'), ('Combos'), ('Acompanhamentos'), ('Bebidas')
) as defaults(category)
where not exists (
  select 1 from public.product_categories where name = defaults.category
);

alter table public.product_categories enable row level security;

grant select on public.product_categories to anon, authenticated;

drop policy if exists "Categories are public" on public.product_categories;
create policy "Categories are public"
  on public.product_categories
  for select
  to anon, authenticated
  using (true);

-- Inserções e exclusões passam apenas pelas rotas administrativas do servidor.
