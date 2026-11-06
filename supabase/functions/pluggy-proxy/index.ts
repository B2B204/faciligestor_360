// Credenciais lidas dos secrets da função (supabase secrets set PLUGGY_CLIENT_ID=... PLUGGY_CLIENT_SECRET=...).
// Nunca escreva estes valores no código.
import { requireUser } from '../_shared/auth.ts';

const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? '';
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? '';
const PLUGGY_API = 'https://api.pluggy.ai';

// IDs do Pluggy são UUIDs. Validar impede path traversal em /items/{id}
// (ex.: itemId="../connectors") e injeção de parâmetros extras na query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGE_SIZE = 500;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

function uuidParam(url: URL, name: string): string | null {
  const value = url.searchParams.get(name);
  return value && UUID_RE.test(value) ? value : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Dados bancários: exige sessão de usuário real, não só a anon key pública.
  const user = await requireUser(req);
  if (!user) return json({ error: 'Não autenticado' }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    const apiKey = await getApiKey();
    const headers: Record<string, string> = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' };

    // Gera um connect token para o widget do Pluggy
    if (action === 'connect_token') {
      const body: { itemId?: string; options: { clientUserId: string } } = {
        options: { clientUserId: user.id },
      };
      if (url.searchParams.has('itemId')) {
        const itemId = uuidParam(url, 'itemId');
        if (!itemId) return json({ error: 'itemId inválido' }, 400);
        body.itemId = itemId;
      }
      const res = await fetch(`${PLUGGY_API}/connect_token`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return json(await res.json(), res.status);
    }

    if (action === 'accounts') {
      const itemId = uuidParam(url, 'itemId');
      if (!itemId) return json({ error: 'itemId inválido' }, 400);
      const params = new URLSearchParams({ itemId });
      const res = await fetch(`${PLUGGY_API}/accounts?${params}`, { headers });
      return json(await res.json(), res.status);
    }

    if (action === 'transactions') {
      const accountId = uuidParam(url, 'accountId');
      if (!accountId) return json({ error: 'accountId inválido' }, 400);
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
        return json({ error: 'Datas devem estar no formato AAAA-MM-DD' }, 400);
      }
      const requested = Number(url.searchParams.get('pageSize') || MAX_PAGE_SIZE);
      const pageSize = Number.isFinite(requested)
        ? Math.min(Math.max(1, Math.trunc(requested)), MAX_PAGE_SIZE)
        : MAX_PAGE_SIZE;
      const params = new URLSearchParams({ accountId, pageSize: String(pageSize) });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`${PLUGGY_API}/transactions?${params}`, { headers });
      return json(await res.json(), res.status);
    }

    if (action === 'item') {
      const itemId = uuidParam(url, 'itemId');
      if (!itemId) return json({ error: 'itemId inválido' }, 400);
      const res = await fetch(`${PLUGGY_API}/items/${itemId}`, { headers });
      return json(await res.json(), res.status);
    }

    if (action === 'delete_item') {
      const itemId = uuidParam(url, 'itemId');
      if (!itemId) return json({ error: 'itemId inválido' }, 400);
      const res = await fetch(`${PLUGGY_API}/items/${itemId}`, { method: 'DELETE', headers });
      return json({ deleted: res.ok }, res.ok ? 200 : res.status);
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[pluggy-proxy]', err);
    return json({ error: 'Falha ao comunicar com o Pluggy' }, 502);
  }
});
