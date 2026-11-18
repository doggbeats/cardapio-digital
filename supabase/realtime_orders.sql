-- Alertas em tempo real: novo pedido no painel administrativo e mudanças de
-- status no acompanhamento do cliente. RLS continua limitando cada usuário
-- aos próprios pedidos (admins podem ver todos).
alter table public.orders replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;
