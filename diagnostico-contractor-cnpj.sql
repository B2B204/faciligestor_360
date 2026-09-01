-- ============================================================
-- DIAGNÓSTICO: contractor_cnpj não persiste após salvar contrato
-- Execute cada bloco no SQL Editor do Supabase e me envie o resultado
-- de cada um (pode rodar tudo de uma vez, os resultados aparecem
-- em abas/seções separadas).
-- ============================================================

-- 1) A coluna existe, qual o tipo, tem valor default ou é gerada?
SELECT column_name, data_type, column_default, is_generated, generation_expression
FROM information_schema.columns
WHERE table_name = 'contracts' AND column_name = 'contractor_cnpj';

-- 2) Existe algum CHECK constraint na tabela envolvendo contractor_cnpj?
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'contracts'::regclass;

-- 3) Quais triggers existem em contracts (BEFORE/AFTER UPDATE)?
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'contracts'::regclass AND NOT tgisinternal;

-- 4) Existe mais de uma linha em "contracts" com o mesmo número de
--    contrato / cliente (o app poderia estar editando uma linha,
--    mas a lista exibindo outra linha duplicada)?
--    Troque '03/2026' pelo contract_number do contrato que você testou.
SELECT id, contract_number, name, contractor_cnpj, cnpj, updated_date
FROM contracts
WHERE contract_number = '03/2026';

-- 5) TESTE DIRETO: pegue o "id" de uma das linhas retornadas acima e
--    troque abaixo, depois rode este UPDATE isolado (fora do app) e
--    confira se o valor realmente muda ao rodar o SELECT logo depois.
--    Isso prova se o bloqueio é no banco (RLS/trigger) ou só no app.
-- UPDATE contracts SET contractor_cnpj = 'TESTE123456789' WHERE id = 'COLE_O_ID_AQUI';
-- SELECT id, contractor_cnpj FROM contracts WHERE id = 'COLE_O_ID_AQUI';

-- 6) Permissões de coluna (privilégio a nível de coluna pode bloquear
--    updates de colunas específicas silenciosamente em certos casos)
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_name = 'contracts' AND column_name = 'contractor_cnpj';
