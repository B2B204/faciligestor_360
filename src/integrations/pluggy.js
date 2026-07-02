const SUPABASE_EDGE_URL = 'https://ihmwofghodonuvzzirmj.supabase.co/functions/v1/pluggy-proxy';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobXdvZmdob2RvbnV2enppam1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODc3MDIsImV4cCI6MjA1NTk2MzcwMn0.p_5YSGBMQ-MQ96Nd3LLBUVRFRaVFidtUmPXuaaBq6NM';

async function call(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${SUPABASE_EDGE_URL}?${qs}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Pluggy proxy error ${res.status}`);
  return res.json();
}

export async function getConnectToken(itemId = null) {
  const params = {};
  if (itemId) params.itemId = itemId;
  const data = await call('connect_token', params);
  return data.accessToken;
}

export async function getAccounts(itemId) {
  const data = await call('accounts', { itemId });
  return data.results || [];
}

export async function getTransactions(accountId, from = '', to = '') {
  const params = { accountId };
  if (from) params.from = from;
  if (to) params.to = to;
  const data = await call('transactions', params);
  return data.results || [];
}

export async function getItem(itemId) {
  return call('item', { itemId });
}

export async function deleteItem(itemId) {
  return call('delete_item', { itemId });
}

// Load Pluggy Connect Widget script dynamically (CDN)
let widgetScriptLoaded = false;
export function loadPluggyWidget() {
  return new Promise((resolve, reject) => {
    if (widgetScriptLoaded || window.PluggyConnect) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.pluggy.ai/pluggy-connect/v2.1/pluggy-connect.js';
    script.onload = () => { widgetScriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Pluggy widget'));
    document.head.appendChild(script);
  });
}

export function openPluggyWidget({ connectToken, onSuccess, onError, onClose }) {
  if (!window.PluggyConnect) throw new Error('Pluggy widget not loaded');
  const widget = new window.PluggyConnect({
    connectToken,
    onSuccess: ({ item }) => onSuccess?.(item),
    onError: (error) => onError?.(error),
    onClose: () => onClose?.(),
  });
  widget.init();
  return widget;
}
