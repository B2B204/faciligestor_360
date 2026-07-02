const PLUGGY_CLIENT_ID = '2ec0e93e-15e0-4637-a770-b559c4dc8442';
const PLUGGY_CLIENT_SECRET = 'sf-MA8NqiUmeCvUbsW-_iMWiX36LmMb3le5-SxN4q2U';
const PLUGGY_API = 'https://api.pluggy.ai';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    const apiKey = await getApiKey();
    const headers: Record<string, string> = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' };

    // Generate a connect token for the Pluggy Widget
    if (action === 'connect_token') {
      const itemId = url.searchParams.get('itemId');
      const body: Record<string, string> = {};
      if (itemId) body.itemId = itemId;
      const res = await fetch(`${PLUGGY_API}/connect_token`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return json(data);
    }

    // Get all accounts for a connected item
    if (action === 'accounts') {
      const itemId = url.searchParams.get('itemId');
      if (!itemId) return json({ error: 'itemId required' }, 400);
      const res = await fetch(`${PLUGGY_API}/accounts?itemId=${itemId}`, { headers });
      const data = await res.json();
      return json(data);
    }

    // Get transactions for an account (with optional date range)
    if (action === 'transactions') {
      const accountId = url.searchParams.get('accountId');
      if (!accountId) return json({ error: 'accountId required' }, 400);
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      const pageSize = url.searchParams.get('pageSize') || '500';
      const params = new URLSearchParams({ accountId, pageSize });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`${PLUGGY_API}/transactions?${params}`, { headers });
      const data = await res.json();
      return json(data);
    }

    // Get item status/details
    if (action === 'item') {
      const itemId = url.searchParams.get('itemId');
      if (!itemId) return json({ error: 'itemId required' }, 400);
      const res = await fetch(`${PLUGGY_API}/items/${itemId}`, { headers });
      const data = await res.json();
      return json(data);
    }

    // Delete/disconnect an item
    if (action === 'delete_item') {
      const itemId = url.searchParams.get('itemId');
      if (!itemId) return json({ error: 'itemId required' }, 400);
      const res = await fetch(`${PLUGGY_API}/items/${itemId}`, { method: 'DELETE', headers });
      return json({ deleted: res.ok });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
