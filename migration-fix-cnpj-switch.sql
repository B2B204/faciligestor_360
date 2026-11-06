-- Troca segura e atômica do CNPJ ativo.
-- Execute no SQL Editor do Supabase antes de publicar esta versão.

-- Corrige a função legada usada após aprovação. Aprovar um acesso não deve
-- trocar silenciosamente o CNPJ ativo de quem já possui uma empresa ativa.
CREATE OR REPLACE FUNCTION public.sync_profile_cnpj_on_approval(p_email text, p_cnpj text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_cnpj text := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND department = 'admin'
  ) THEN
    RAISE EXCEPTION 'Somente administradores podem sincronizar acesso a CNPJ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_cnpj_access
    WHERE lower(user_email) = lower(p_email) AND cnpj = v_target_cnpj
  ) THEN
    RAISE EXCEPTION 'Acesso ao CNPJ ainda não foi concedido';
  END IF;

  UPDATE profiles
     SET cnpj = v_target_cnpj, updated_at = now()
   WHERE lower(email) = lower(p_email)
     AND (cnpj IS NULL OR btrim(cnpj) = '');
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_cnpj_on_approval(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_cnpj_on_approval(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.switch_active_cnpj(p_cnpj text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_current_cnpj text;
  v_target_cnpj text := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF length(v_target_cnpj) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido';
  END IF;

  SELECT email, cnpj
    INTO v_email, v_current_cnpj
    FROM profiles
   WHERE id = v_user_id
   FOR UPDATE;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado';
  END IF;

  IF v_target_cnpj = v_current_cnpj THEN
    RETURN v_target_cnpj;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM user_cnpj_access
     WHERE lower(user_email) = lower(v_email)
       AND cnpj = v_target_cnpj
  ) THEN
    RAISE EXCEPTION 'Troca de CNPJ não permitida: acesso não aprovado para %', v_target_cnpj;
  END IF;

  -- Preserva a empresa atual para que o usuário consiga voltar depois.
  IF COALESCE(v_current_cnpj, '') <> '' AND NOT EXISTS (
    SELECT 1
      FROM user_cnpj_access
     WHERE lower(user_email) = lower(v_email)
       AND cnpj = v_current_cnpj
  ) THEN
    INSERT INTO user_cnpj_access (user_email, cnpj)
    VALUES (v_email, v_current_cnpj);
  END IF;

  UPDATE profiles
     SET cnpj = v_target_cnpj,
         updated_at = now()
   WHERE id = v_user_id;

  RETURN v_target_cnpj;
END;
$$;

REVOKE ALL ON FUNCTION public.switch_active_cnpj(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.switch_active_cnpj(text) TO authenticated;

COMMENT ON FUNCTION public.switch_active_cnpj(text) IS
  'Troca o CNPJ ativo somente para acessos previamente aprovados e preserva o CNPJ anterior.';
