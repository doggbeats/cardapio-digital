-- Promover a conta paulo.analise90@gmail.com a administradora.
-- Execute no SQL Editor do Supabase (Dashboard > SQL Editor > New query > Run).
-- Isso é necessário porque o painel só libera contas cujo app_metadata
-- contém role = "admin", e esse campo não pode ser alterado pelo navegador.

-- A conta precisa existir. Se ainda não cadastrou, faça o cadastro no app primeiro.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where lower(email) = lower('paulo.analise90@gmail.com');

-- Confira: a coluna raw_app_meta_data deve mostrar "role": "admin".
select id, email, raw_app_meta_data
from auth.users
where lower(email) = lower('paulo.analise90@gmail.com');
