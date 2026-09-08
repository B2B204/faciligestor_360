-- ============================================================
-- DIAGNÓSTICO: administradores sem CNPJ vinculado ao perfil
--
-- Se profiles.cnpj estiver NULL ou vazio para um admin, TODAS as
-- políticas RLS de dados de negócio (contracts, financial_entries,
-- employees, etc.) usam:
--   cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid())
-- Com p.cnpj NULL, a subquery não casa com nenhuma linha e o
-- administrador não vê absolutamente nada — mesmo tendo criado os
-- dados originalmente.
--
-- Este script é SOMENTE LEITURA. Rode no SQL Editor do Supabase
-- e me envie o resultado antes de aplicarmos qualquer correção.
-- ============================================================

-- 1) Perfis de admin com cnpj ausente/vazio
SELECT id, email, full_name, department, cnpj, created_at
FROM profiles
WHERE department = 'admin'
  AND (cnpj IS NULL OR btrim(cnpj) = '')
ORDER BY created_at;

-- 2) Para cada admin sem cnpj, candidatos prováveis via team_members
--    (linhas onde o e-mail do admin aparece como membro de uma equipe)
SELECT p.id AS profile_id, p.email, tm.cnpj AS candidato_via_team_members, tm.full_name
FROM profiles p
JOIN team_members tm ON tm.email = p.email
WHERE p.department = 'admin'
  AND (p.cnpj IS NULL OR btrim(p.cnpj) = '');

-- 3) Para cada admin sem cnpj, candidatos prováveis via user_cnpj_access
SELECT p.id AS profile_id, p.email, uca.cnpj AS candidato_via_user_cnpj_access
FROM profiles p
JOIN user_cnpj_access uca ON uca.user_email = p.email
WHERE p.department = 'admin'
  AND (p.cnpj IS NULL OR btrim(p.cnpj) = '');

-- 4) Confirma se há dados "órfãos" (contratos, funcionários etc.) associados
--    a um cnpj que nenhum profile com department='admin' possui hoje —
--    sinal de que o admin certo perdeu o vínculo
SELECT DISTINCT c.cnpj
FROM contracts c
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.cnpj = c.cnpj AND p.department = 'admin'
);
