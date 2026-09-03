// Proxy server-side para a API da Groq. Antes, InvokeLLM (src/integrations/Core.js)
// chamava api.groq.com direto do browser usando VITE_GROQ_API_KEY — como toda env
// var VITE_* é embutida no bundle JS de produção, a chave ficava visível a
// qualquer visitante do site (bastava abrir o dev tools), permitindo abuso de
// cota/custo da conta Groq do proprietário do sistema.
//
// A chave passa a viver só aqui, como secret do Supabase Edge Functions
// (configurar com: supabase secrets set GROQ_API_KEY=...), nunca enviada ao
// cliente. Por padrão o Supabase exige um JWT de sessão válido para invocar a
// function, então só usuários autenticados do app conseguem chamar isto.

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!GROQ_API_KEY) {
    return json({ error: 'GROQ_API_KEY não configurada nas secrets da function.' }, 500);
  }

  try {
    const { prompt, response_json_schema, system_prompt } = await req.json();
    if (!prompt) return json({ error: 'prompt é obrigatório' }, 400);

    const messages: { role: string; content: string }[] = [];
    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt });
    } else if (response_json_schema) {
      messages.push({
        role: 'system',
        content: 'Você é um assistente especializado. Responda APENAS com JSON válido, sem texto adicional, seguindo exatamente o schema fornecido.',
      });
    }

    const userContent = response_json_schema
      ? `${prompt}\n\nSchema JSON esperado: ${JSON.stringify(response_json_schema, null, 2)}`
      : prompt;
    messages.push({ role: 'user', content: userContent });

    const body = {
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      ...(response_json_schema ? { response_format: { type: 'json_object' } } : {}),
    };

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      return json({ error: data.error?.message || `Erro Groq API: ${res.status}` }, res.status);
    }

    return json(data);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 400);
  }
});
