-- ============================================================
-- CORREÇÃO CRÍTICA: "profiles_update" tinha USING (auth.uid() = id)
-- mas NENHUM WITH CHECK. Isso restringe qual LINHA pode ser
-- alterada (a própria), mas não quais VALORES podem ser gravados
-- nela — e "cnpj"/"department" dessa mesma linha são exatamente
-- as colunas que todas as outras políticas RLS do sistema usam
-- para decidir isolamento entre empresas e privilégio de admin.
--
-- Na prática, qualquer usuário autenticado conseguia, com um PATCH
-- direto em /rest/v1/profiles (sem passar pela UI), setar
-- cnpj = "<empresa de outra pessoa>" e department = "admin" na
-- própria linha e, com isso, ganhar leitura/escrita total sobre
-- contratos, funcionários (CPF, salário), financeiro e LGPD de
-- qualquer empresa do sistema — anulando todo o isolamento
-- multi-tenant corrigido em migration-fix-rls-isolamento-entre-
-- empresas.sql e migration-fix-rls-cnpj-access-*.sql.
--
-- RLS não compara facilmente contra a linha antiga dentro de um
-- WITH CHECK, então a correção usa um trigger BEFORE UPDATE que
-- só libera a troca de cnpj/department nos dois fluxos legítimos
-- hoje existentes no app:
--
--   1) CnpjSwitcher (troca de CNPJ ativo): permitido só se já
--      existe uma linha aprovada em user_cnpj_access para este
--      usuário + o novo cnpj (inserida só por admin, ver
--      migration-fix-rls-cnpj-access-requests.sql). department
--      não muda nesse fluxo.
--
--   2) AcceptInvite.jsx (aceitar convite / vincular a uma nova
--      empresa): permitido só se existe um convite "pendente" em
--      user_invites batendo exatamente com o novo cnpj E o novo
--      department para o e-mail deste usuário.
--
-- Qualquer outra tentativa de mudar cnpj ou department é
-- bloqueada. (Uma promoção manual de admin via SQL direto, se
-- necessária no futuro, precisa desabilitar o trigger antes:
-- ALTER TABLE profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;)
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cnpj IS DISTINCT FROM OLD.cnpj OR NEW.department IS DISTINCT FROM OLD.department THEN

    -- Fluxo 2: convite pendente batendo exatamente com os novos valores
    IF EXISTS (
      SELECT 1 FROM user_invites
      WHERE email = OLD.email
        AND cnpj = NEW.cnpj
        AND department IS NOT DISTINCT FROM NEW.department
        AND status = 'pendente'
    ) THEN
      RETURN NEW;
    END IF;

    -- department só pode mudar pelo fluxo de convite acima
    IF NEW.department IS DISTINCT FROM OLD.department THEN
      RAISE EXCEPTION 'Alteração de department não permitida fora do fluxo de convite';
    END IF;

    -- Fluxo 1: troca de cnpj exige acesso já aprovado por um admin
    IF NOT EXISTS (
      SELECT 1 FROM user_cnpj_access
      WHERE user_email = OLD.email AND cnpj = NEW.cnpj
    ) THEN
      RAISE EXCEPTION 'Troca de CNPJ não permitida: acesso não aprovado para %', NEW.cnpj;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_privilege_escalation();

-- Conferir depois de rodar (deve existir e estar ENABLED):
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'profiles'::regclass AND tgname = 'profiles_prevent_privilege_escalation';
