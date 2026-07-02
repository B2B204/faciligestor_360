import { supabase } from '@/api/supabaseClient';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export async function InvokeLLM({ prompt, response_json_schema, system_prompt }) {
  if (!GROQ_API_KEY) throw new Error('Chave da API Groq não configurada (VITE_GROQ_API_KEY).');

  const messages = [];

  if (system_prompt) {
    messages.push({ role: 'system', content: system_prompt });
  } else if (response_json_schema) {
    messages.push({
      role: 'system',
      content: `Você é um assistente especializado. Responda APENAS com JSON válido, sem texto adicional, seguindo exatamente o schema fornecido.`,
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
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro Groq API: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  if (response_json_schema) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  return content;
}

export async function ExtractDataFromUploadedFile({ file_url, json_schema }) {
  return InvokeLLM({
    prompt: `Analise o arquivo disponível em: ${file_url}\nExtraia os dados e retorne conforme o schema JSON fornecido.`,
    response_json_schema: json_schema,
  });
}

export async function UploadFile({ file }) {
  const fileName = `uploads/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('uploads').upload(fileName, file);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return { file_url: publicUrl };
}

export async function UploadPrivateFile({ file }) {
  const fileName = `private/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('uploads').upload(fileName, file);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return { file_uri: publicUrl };
}

export async function SendEmail({ to, subject, body, html }) {
  console.warn('SendEmail: configure um serviço externo (Resend, SendGrid)');
  return { success: false };
}

export async function GenerateImage({ prompt }) {
  console.warn('GenerateImage: Groq não suporta geração de imagens.');
  return { url: '' };
}
