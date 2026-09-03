-- ============================================================
-- CAUSA RAIZ (relatado pelo usuário): um novo usuário conseguiu
-- ficar vinculado a um CNPJ já existente sem NUNCA aparecer para o
-- administrador aprovar.
--
-- Achado: Profile.jsx tem um formulário de "completar perfil"
-- (full_name, phone, cnpj, company_name, ...) mostrado no primeiro
-- acesso, que chamava "User.update(user.id, {...formData, cnpj})"
-- direto — sem checar se aquele CNPJ já pertencia a outra empresa
-- com admin. Como todo signup novo (Login.jsx) nasce com
-- department='admin' por padrão (handle_new_user), qualquer pessoa
-- que digitasse o CNPJ de uma empresa já cadastrada virava
-- instantaneamente um segundo "admin" dela — o fluxo de aprovação
-- (cnpj_access_requests) só existia no botão "Solicitar CNPJ"
-- (RequestCnpjDialog), que essa tela de onboarding não usava.
--
-- Corrigido em dois lugares:
--   1) Frontend (Profile.jsx handleSubmit): agora, ao definir o
--      CNPJ pela primeira vez, verifica se ele já existe em
--      company_cnpjs. Se já existe, cria uma CnpjAccessRequest
--      pendente em vez de setar o cnpj do perfil — o admin real
--      passa a ver a solicitação em Configurações da Empresa. Só
--      quando o CNPJ é inédito o próprio usuário vira o admin
--      fundador (mesmo efeito de registrar em Configurações da
--      Empresa).
--   2) Banco (este arquivo): o trigger
--      prevent_profile_privilege_escalation, criado em
--      migration-fix-profiles-privilege-escalation.sql, só
--      liberava troca de cnpj/department via CnpjSwitcher (acesso
--      já aprovado) ou aceite de convite — faltava o terceiro
--      caso legítimo (fundar uma empresa nova), e sem essa exceção
--      o próprio trigger bloquearia até o fluxo corrigido do
--      Profile.jsx. Esta migration adiciona essa exceção,
--      reforçando no banco a mesma regra que o frontend agora
--      aplica: só passa direto quando o usuário ainda não tinha
--      cnpj E o cnpj novo não pertence a ninguém (nem em profiles,
--      nem em company_cnpjs).
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

    -- Fluxo 3: fundar uma empresa nova — só quando o usuário ainda não
    -- tinha cnpj, department não muda, e o cnpj novo não pertence a
    -- ninguém (nem a outro profile, nem já registrado em company_cnpjs).
    IF OLD.cnpj IS NULL
       AND NEW.department IS NOT DISTINCT FROM OLD.department
       AND NOT EXISTS (SELECT 1 FROM profiles WHERE cnpj = NEW.cnpj)
       AND NOT EXISTS (SELECT 1 FROM company_cnpjs WHERE cnpj = NEW.cnpj)
    THEN
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

-- (o trigger em si, "profiles_prevent_privilege_escalation", já existe —
-- CREATE OR REPLACE FUNCTION acima já é suficiente para atualizar seu
-- comportamento, não precisa recriar o trigger)

-- Conferir depois de rodar:
-- SELECT prosrc FROM pg_proc WHERE proname = 'prevent_profile_privilege_escalation';
-- (deve conter "Fluxo 3: fundar uma empresa nova")
