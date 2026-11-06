// Validação de sessão compartilhada pelas Edge Functions.
//
// O verify_jwt padrão do Supabase aceita QUALQUER JWT assinado pelo projeto,
// inclusive a anon key, que é pública (vai no bundle do front). Ou seja,
// sozinho ele não garante que exista um usuário logado. Aqui consultamos o
// GoTrue com o token recebido: só um access_token de sessão real devolve um
// usuário.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export type AuthUser = { id: string; email?: string };

export async function requireUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ') || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;

  const user = await res.json();
  return user?.id ? { id: user.id, email: user.email } : null;
}
