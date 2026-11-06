// Credenciais lidas dos secrets da função (supabase secrets set PLUGGY_CLIENT_ID=... PLUGGY_CLIENT_SECRET=...).
// Nunca escreva estes valores no código.
//
// Isolamento por empresa: todas as empresas usam a mesma conta Pluggy, então
// cada item só é atendido se estiver em public.pluggy_items com um CNPJ que o
// usuário logado enxerga por RLS (ver supabase/migration-pluggy-items.sql).
import { requireUser } from '../_shared/auth.ts';

const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? '';
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? '';
const PLUGGY_API = 'https://api.pluggy.ai';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// IDs do Pluggy são UUIDs. Validar impede path traversal em /items/{id}
// (ex.: itemId="../connectors") e injeção de parâmetros extras na query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CNPJ_RE = /^\d{14}$/;
const MAX_PAGE_SIZE = 500;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function getApiKey(): Promise<string> {
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Pluggy auth failed: ${res.status}`);
  const data = await res.json();
  return data.apiKey;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function uuidParam(url: URL, name: string): string {
  const value = url.searchParams.get(name);
  if (!value || !UUID_RE.test(value)) throw new HttpError(400, `${name} inválido`);
  return value;
}

// PostgREST com o JWT do usuário: o RLS decide o que ele enxerga.
function asUser(authHeader: string) {
  return { Authorization: authHeader, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
}

// PostgREST com service role: usado só para gravar, depois das checagens.
function asService() {
  return {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  };
}

async function findItemRow(itemId: string, headers: Record<string, string>) {
  const params = new URLSearchParams({ item_id: `eq.${itemId}`, select: 'item_id,cnpj,label' });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pluggy_items?${params}`, { headers });
  if (!res.ok) throw new Error(`pluggy_items lookup failed: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

// O item pertence a uma empresa da qual o usuário faz parte?
async function assertItemAccess(itemId: string, authHeader: string) {
  const row = await findItemRow(itemId, asUser(authHeader));
  // 404 em vez de 403 para não revelar que o item existe em outra empresa.
  if (!row) throw new HttpError(404, 'Conexão bancária não encontrada');
  return row;
}

async function assertTenantMember(cnpj: string, authHeader: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_tenant_member`, {
    method: 'POST',
    headers: asUser(authHeader),
    body: JSON.stringify({ p_cnpj: cnpj }),
  });
  if (!res.ok || (await res.json()) !== true) throw new HttpError(403, 'Sem acesso a esta empresa');
}

async function pluggyJson(path: string, headers: Record<string, string>) {
  const res = await fetch(`${PLUGGY_API}${path}`, { headers });
  if (res.status === 404) throw new HttpError(404, 'Não encontrado no Pluggy');
  if (!res.ok) throw new HttpError(502, `Erro Pluggy: ${res.status}`);
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Dados bancários: exige sessão de usuário real, não só a anon key pública.
  const user = await requireUser(req);
  if (!user) return json({ error: 'Não autenticado' }, 401);
  const authHeader = req.headers.get('Authorization') ?? '';

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    const apiKey = await getApiKey();
    const headers: Record<string, string> = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' };

    // Connect token para o widget. Sem itemId = nova conexão; com itemId =
    // reconectar um item existente (precisa ser da empresa do usuário).
    // O clientUserId fica gravado no item e é conferido em register_item.
    if (action === 'connect_token') {
      const body: { itemId?: string; options: { clientUserId: string } } = {
        options: { clientUserId: user.id },
      };
      if (url.searchParams.has('itemId')) {
        body.itemId = uuidParam(url, 'itemId');
        await assertItemAccess(body.itemId, authHeader);
      }
      const res = await fetch(`${PLUGGY_API}/connect_token`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return json(await res.json(), res.status);
    }

    // Vincula um item recém-conectado ao CNPJ do usuário.
    if (action === 'register_item') {
      const itemId = uuidParam(url, 'itemId');
      const cnpj = (url.searchParams.get('cnpj') ?? '').replace(/\D/g, '');
      if (!CNPJ_RE.test(cnpj)) throw new HttpError(400, 'cnpj inválido');
      await assertTenantMember(cnpj, authHeader);

      const item = await pluggyJson(`/items/${itemId}`, headers);
      // Só quem criou a conexão pode registrá-la: impede que alguém que
      // descobriu o itemId de outra empresa o vincule à própria.
      if (item?.clientUserId !== user.id) throw new HttpError(403, 'Conexão criada por outro usuário');

      const existing = await findItemRow(itemId, asService());
      if (existing) {
        if (existing.cnpj !== cnpj) throw new HttpError(409, 'Conexão já vinculada a outra empresa');
        return json(existing);
      }

      const label = item?.connector?.name ?? null;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pluggy_items`, {
        method: 'POST',
        headers: { ...asService(), Prefer: 'return=representation' },
        body: JSON.stringify({ item_id: itemId, cnpj, label, connected_by: user.id }),
      });
      if (!res.ok) throw new Error(`pluggy_items insert failed: ${res.status}`);
      const [row] = await res.json();
      return json(row, 201);
    }

    if (action === 'accounts') {
      const itemId = uuidParam(url, 'itemId');
      await assertItemAccess(itemId, authHeader);
      const params = new URLSearchParams({ itemId });
      return json(await pluggyJson(`/accounts?${params}`, headers));
    }

    if (action === 'transactions') {
      const accountId = uuidParam(url, 'accountId');
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
        throw new HttpError(400, 'Datas devem estar no formato AAAA-MM-DD');
      }
      // A conta só é acessível se o item dono dela for da empresa do usuário.
      const account = await pluggyJson(`/accounts/${accountId}`, headers);
      if (!account?.itemId || !UUID_RE.test(account.itemId)) throw new HttpError(404, 'Conta não encontrada');
      await assertItemAccess(account.itemId, authHeader);

      const requested = Number(url.searchParams.get('pageSize') || MAX_PAGE_SIZE);
      const pageSize = Number.isFinite(requested)
        ? Math.min(Math.max(1, Math.trunc(requested)), MAX_PAGE_SIZE)
        : MAX_PAGE_SIZE;
      const params = new URLSearchParams({ accountId, pageSize: String(pageSize) });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return json(await pluggyJson(`/transactions?${params}`, headers));
    }

    if (action === 'item') {
      const itemId = uuidParam(url, 'itemId');
      await assertItemAccess(itemId, authHeader);
      return json(await pluggyJson(`/items/${itemId}`, headers));
    }

    if (action === 'delete_item') {
      const itemId = uuidParam(url, 'itemId');
      await assertItemAccess(itemId, authHeader);
      const res = await fetch(`${PLUGGY_API}/items/${itemId}`, { method: 'DELETE', headers });
      // 404 no Pluggy = já não existe lá; ainda assim remove o vínculo local.
      if (!res.ok && res.status !== 404) throw new HttpError(502, `Erro Pluggy: ${res.status}`);
      const params = new URLSearchParams({ item_id: `eq.${itemId}` });
      const del = await fetch(`${SUPABASE_URL}/rest/v1/pluggy_items?${params}`, {
        method: 'DELETE',
        headers: asService(),
      });
      if (!del.ok) throw new Error(`pluggy_items delete failed: ${del.status}`);
      return json({ deleted: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error('[pluggy-proxy]', err);
    return json({ error: 'Falha ao comunicar com o Pluggy' }, 502);
  }
});
