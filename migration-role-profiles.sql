-- ============================================================
-- MIGRAÇÃO: role_profiles — perfis de permissão customizados
-- (página "Perfis de Usuário" / UserProfiles.jsx chama RoleProfile.*
-- mas a tabela nunca existia no banco, fazendo create/update/delete
-- falharem silenciosamente em produção).
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro.)
-- ============================================================

CREATE TABLE IF NOT EXISTS role_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj          TEXT NOT NULL,
  role_key      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  description   TEXT,
  color         TEXT DEFAULT 'gray',
  pages         JSONB DEFAULT '[]'::jsonb,
  actions       JSONB DEFAULT '[]'::jsonb,
  is_builtin    BOOLEAN DEFAULT false,
  created_date  TIMESTAMPTZ DEFAULT now(),
  updated_date  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_profiles_cnpj ON role_profiles(cnpj);

-- ============================================================
-- RLS — isolamento por CNPJ (multi-tenant)
-- ============================================================
ALTER TABLE role_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_profiles_select" ON role_profiles;
DROP POLICY IF EXISTS "role_profiles_insert" ON role_profiles;
DROP POLICY IF EXISTS "role_profiles_update" ON role_profiles;
DROP POLICY IF EXISTS "role_profiles_delete" ON role_profiles;
DROP POLICY IF EXISTS "role_profiles_all" ON role_profiles;

CREATE POLICY "role_profiles_select" ON role_profiles FOR SELECT TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "role_profiles_insert" ON role_profiles FOR INSERT TO authenticated WITH CHECK (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "role_profiles_update" ON role_profiles FOR UPDATE TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
) WITH CHECK (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);
CREATE POLICY "role_profiles_delete" ON role_profiles FOR DELETE TO authenticated USING (
  cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
