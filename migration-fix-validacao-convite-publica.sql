-- ============================================================
-- Corrige: a pagina de aceitar convite (AcceptInvite.jsx) precisa
-- consultar "user_invites" ANTES do visitante ter uma sessao
-- logada (ele ainda nao tem conta). A policy de RLS de
-- user_invites exige estar autenticado com o cnpj correspondente,
-- entao para um visitante anonimo a busca sempre retornava vazio
-- ("Convite invalido ou ja utilizado", mesmo com o convite certo).
--
-- Em vez de abrir a tabela inteira para leitura anonima (o que
-- exporia nome/e-mail/codigo de convite de todo mundo), criamos
-- uma funcao SECURITY DEFINER que so devolve o convite que bate
-- com o codigo informado, ja tratando expiracao.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_invite(p_code TEXT)
RETURNS SETOF user_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite user_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM user_invites
  WHERE invite_code = p_code AND status = 'pendente'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND now() > v_invite.expires_at THEN
    UPDATE user_invites SET status = 'expirado' WHERE id = v_invite.id;
    v_invite.status := 'expirado';
    RETURN NEXT v_invite;
    RETURN;
  END IF;

  RETURN NEXT v_invite;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite(TEXT) TO anon, authenticated;
