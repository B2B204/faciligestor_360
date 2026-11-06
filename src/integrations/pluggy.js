import { supabase } from '@/api/supabaseClient';

// A Edge Function exige a sessão do usuário logado (não só a anon key):
// supabase.functions.invoke envia o access_token da sessão atual.
async function call(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const { data, error } = await supabase.functions.invoke(`pluggy-proxy?${qs}`, { method: 'GET' });
  if (error) throw new Error(`Pluggy proxy error: ${error.message}`);
  return data;
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
