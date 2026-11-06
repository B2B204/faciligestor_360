-- =====================================================================
-- Conexões Open Finance (Pluggy) vinculadas à empresa (CNPJ)
--
-- Antes, os itemIds do Pluggy ficavam só no localStorage do navegador e a
-- Edge Function pluggy-proxy atendia qualquer itemId/accountId recebido.
-- Como todas as empresas compartilham a mesma conta Pluggy, um usuário de
-- uma empresa que soubesse o ID de outra conseguia ler saldos e extratos
-- dela ou desconectá-la.
--
-- Agora cada item pertence a um CNPJ. A function só repassa chamadas de
-- itens que o usuário logado enxerga por RLS (is_tenant_member).
--
-- Escrita: somente a Edge Function (service role) insere/remove linhas,
-- depois de confirmar no Pluggy que o item foi criado pelo próprio usuário
-- (clientUserId). Não há policy de INSERT/UPDATE/DELETE para o cliente, o
-- que impede "reivindicar" o item de outra empresa gravando direto na tabela.
--
-- Depende de public.is_tenant_member (migration-zz-security-hardening.sql).
-- Idempotente: pode ser executada mais de uma vez.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.pluggy_items (
  item_id      uuid PRIMARY KEY,
  cnpj         text NOT NULL,
  label        text,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pluggy_items_cnpj_idx ON public.pluggy_items (cnpj);

ALTER TABLE public.pluggy_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pluggy_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pluggy_items FROM authenticated;
GRANT SELECT ON public.pluggy_items TO authenticated;

DROP POLICY IF EXISTS pluggy_items_select_tenant ON public.pluggy_items;
CREATE POLICY pluggy_items_select_tenant
  ON public.pluggy_items
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(cnpj));
