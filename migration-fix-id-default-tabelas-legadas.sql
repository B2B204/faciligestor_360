-- ============================================================
-- Corrige: a coluna "id" (TEXT) de todas essas tabelas nao tem
-- valor padrao (foram pensadas para guardar os ids antigos do
-- Mongo/base44, nunca ganharam um DEFAULT para gerar ids novos).
-- Isso faz qualquer criacao de registro novo pelo sistema falhar
-- com "null value in column id violates not-null constraint"
-- (ex: convidar membro da equipe em user_invites).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'accounts_receivable', 'alerts', 'allowance_receipts', 'contracts',
    'dashboard_preferences', 'deals', 'laudos', 'ligacoes', 'measurements',
    'oficio_templates', 'oficios', 'patrimonies', 'posts', 'repactuacoes',
    'seguros', 'team_members', 'user_invites'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()::text', t);
  END LOOP;
END $$;

-- Conferir depois de rodar:
-- SELECT table_name, column_default FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name = 'id'
--   AND table_name IN (
--     'accounts_receivable','alerts','allowance_receipts','contracts',
--     'dashboard_preferences','deals','laudos','ligacoes','measurements',
--     'oficio_templates','oficios','patrimonies','posts','repactuacoes',
--     'seguros','team_members','user_invites'
--   )
-- ORDER BY table_name;
