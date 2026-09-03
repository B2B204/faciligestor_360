-- ============================================================
-- MÉDIO: "data_access_logs" (log de auditoria LGPD de acesso a
-- dados pessoais) tinha uma policy "_all" cnpj-scoped que também
-- cobre UPDATE/DELETE — qualquer usuário autenticado da empresa
-- podia alterar ou apagar o próprio rastro de auditoria,
-- comprometendo o valor probatório do log para fins de LGPD.
--
-- Log de auditoria deve ser append-only: qualquer usuário do cnpj
-- continua podendo inserir (é assim que lgpdAudit.js registra
-- cada acesso) e ler os logs da própria empresa, mas ninguém
-- pode mais alterar ou apagar uma entrada já gravada.
-- ============================================================

DROP POLICY IF EXISTS data_access_logs_all ON data_access_logs;
DROP POLICY IF EXISTS data_access_logs_insert ON data_access_logs;

CREATE POLICY data_access_logs_insert ON data_access_logs FOR INSERT TO authenticated
  WITH CHECK (cnpj IN (SELECT p.cnpj FROM profiles p WHERE p.id = auth.uid()));

-- Sem policy de UPDATE/DELETE: por padrão, RLS nega esses comandos
-- (nenhuma policy permissiva os cobre), tornando a tabela append-only.

-- Conferir depois de rodar (deve retornar só a policy de select e a de insert):
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'data_access_logs';
