-- Cadastro de produtos no painel administrativo.
-- Execute este arquivo no SQL Editor do Supabase (uma vez).
-- Ele adiciona as colunas de descrição, categoria, imagem e promoção ao catálogo,
-- libera a leitura pública e migra os 16 produtos atuais. A função place_order
-- continua usando apenas id, price_cents e available.

alter table public.menu_catalog
  add column if not exists description text not null default '',
  add column if not exists category text not null default 'Burgers',
  add column if not exists image text not null default '',
  add column if not exists old_price_cents integer,
  add column if not exists badge text;

-- O catálogo é público para leitura; escrita é feita apenas pelo servidor
-- (Route Handlers) com a chave de serviço, que não passa pelo RLS.
grant select on public.menu_catalog to anon, authenticated;

drop policy if exists "Anyone can read the menu catalog" on public.menu_catalog;
create policy "Anyone can read the menu catalog"
  on public.menu_catalog
  for select
  to anon, authenticated
  using (true);

-- Migração dos dados atuais do cardápio.
update public.menu_catalog set
  description = 'Smash 160g, queijo prato, cebola caramelizada e molho da casa.',
  category = 'Burgers',
  image = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=85',
  old_price_cents = null,
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
  image = 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=85',
  old_price_cents = null,
  badge = null
where id = 3;

update public.menu_catalog set
  description = 'Limão-taiti, toque de siciliano e hortelã fresca.',
  category = 'Bebidas',
  image = 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=85',
  old_price_cents = null,
  badge = null
where id = 4;

update public.menu_catalog set
  description = 'Salsicha artesanal, molho da casa, queijo e batata palha.',
  category = 'Hot Dog',
  image = 'https://images.unsplash.com/photo-1612392062631-94dd858cba88?auto=format&fit=crop&w=800&q=85',
  old_price_cents = null,
  badge = 'Da casa'
where id = 5;

update public.menu_catalog set
  description = 'Clássico da Casa, batata rústica e bebida gelada.',
  category = 'Combos',
  image = 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=85',
  old_price_cents = null,
  badge = 'Completo'
where id = 6;

update public.menu_catalog set
  description = 'Smash 160g, queijo, bacon crocante e maionese defumada.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 7;

update public.menu_catalog set
  description = 'Burger artesanal, cheddar, cebola crispy e molho barbecue.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 8;

update public.menu_catalog set
  description = 'Frango empanado, queijo, alface e molho especial.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 9;

update public.menu_catalog set
  description = 'Burger vegetal, queijo, rúcula e molho de ervas.',
  category = 'Burgers',
  image = 'https://images.pexels.com/photos/1547637/pexels-photo-1547637.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 10;

update public.menu_catalog set
  description = 'Salsicha artesanal, cheddar cremoso e cebola crispy.',
  category = 'Hot Dog',
  image = 'https://images.pexels.com/photos/4676409/pexels-photo-4676409.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 11;

update public.menu_catalog set
  description = 'Dois burgers clássicos, batata rústica e duas bebidas.',
  category = 'Combos',
  image = 'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 12;

update public.menu_catalog set
  description = 'Cebola empanada e crocante, acompanhada de molho da casa.',
  category = 'Acompanhamentos',
  image = 'https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 13;

update public.menu_catalog set
  description = 'Tiras de frango empanadas com molho barbecue.',
  category = 'Acompanhamentos',
  image = 'https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 14;

update public.menu_catalog set
  description = 'Milk-shake cremoso de chocolate com cobertura.',
  category = 'Bebidas',
  image = 'https://images.pexels.com/photos/103566/pexels-photo-103566.jpeg?auto=compress&cs=tinysrgb&w=800',
  old_price_cents = null,
  badge = null
where id = 15;

update public.menu_catalog set
  description = 'Soda italiana refrescante com frutas vermelhas.',
  category = 'Bebidas',
  image = 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=800&q=85',
  old_price_cents = null,
  badge = null
where id = 16;
