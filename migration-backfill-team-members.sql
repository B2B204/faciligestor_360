-- ============================================================
-- BACKFILL: team_members ausentes para usuários reais existentes
--
-- Causa raiz: a tela "Perfis de Usuário" (UserProfiles.jsx) só lista a
-- tabela team_members. Essa tabela só era populada por quem aceitava um
-- convite (AcceptInvite.jsx). Quem ganhou acesso a um CNPJ pelo fluxo de
-- "Solicitar CNPJ" + aprovação do admin (Profile.jsx / CompanySettings.jsx),
-- ou quem é o admin fundador de uma empresa (onboarding inicial), nunca
-- tinha uma linha em team_members criada — ficando invisível para sempre
-- nessa tela, mesmo tendo acesso real aos dados da empresa via profiles.cnpj.
--
-- O código-fonte já foi corrigido para criar essa linha nas aprovações
-- futuras. Este script repara quem já ficou "invisível" no passado
-- (inclui o caso relatado de maria.flaviana@gpsfacility.com, e qualquer
-- outro usuário na mesma situação).
--
-- Execute este script no SQL Editor do Supabase.
-- (Idempotente: pode ser executado novamente sem erro/duplicar linhas.)
-- ============================================================

INSERT INTO team_members (cnpj, full_name, email, department, status, created_by)
SELECT
  p.cnpj,
  COALESCE(p.full_name, p.email),
  p.email,
  COALESCE(NULLIF(p.department, ''), 'operador'),
  'ativo',
  'backfill-migration'
FROM profiles p
WHERE p.cnpj IS NOT NULL
  AND p.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.cnpj = p.cnpj AND tm.email = p.email
  );

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
