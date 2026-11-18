-- Acesso ao painel administrativo
-- O painel usa o Supabase Auth e só libera contas cujo app_metadata contém role = "admin".
-- Esse campo é confiável (não pode ser alterado pelo próprio usuário) e já é usado
-- pelas policies de RLS em schema.sql.

-- 1) Cadastre a conta normalmente pelo app (ou pelo Supabase Auth) com o e-mail desejado.
-- 2) Substitua admin@exemplo.com pelo e-mail dessa conta e execute este comando
--    no SQL Editor do Supabase (uma conta com permissões de administrador do projeto):

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'admin@exemplo.com';

-- Confira o resultado:
select id, email, raw_app_meta_data
from auth.users
where email = 'admin@exemplo.com';

-- Depois de promover a conta, entre novamente no painel: o token antigo ainda não
-- contém a nova função. Para revogar o acesso, remova a chave "role":

-- update auth.users
-- set raw_app_meta_data = raw_app_meta_data - 'role'
-- where email = 'admin@exemplo.com';
