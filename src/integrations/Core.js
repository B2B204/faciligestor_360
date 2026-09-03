import { supabase } from '@/api/supabaseClient';

// A chamada à API da Groq roda na Edge Function "groq-proxy" (ver
// supabase/functions/groq-proxy/index.ts), não mais direto do browser: uma
// env var VITE_* fica embutida no bundle de produção e ficava visível a
// qualquer visitante, permitindo abuso de custo da conta Groq.
export async function InvokeLLM({ prompt, response_json_schema, system_prompt }) {
  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: { prompt, response_json_schema, system_prompt },
  });

  if (error) throw new Error(error.message || 'Erro ao chamar o serviço de IA.');
  if (data?.error) throw new Error(data.error);

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

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
// Extensões que o navegador executa/renderiza como página ao abrir a URL
// pública direto (o bucket "uploads" é público) — bloqueadas para não virar
// hospedagem de HTML/SVG malicioso servido a partir do domínio do Supabase.
const BLOCKED_PUBLIC_EXTENSIONS = /\.(html?|svg|xhtml|mhtml|js|jse)$/i;

export async function UploadFile({ file }) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Arquivo excede o tamanho máximo permitido (20MB).');
  if (BLOCKED_PUBLIC_EXTENSIONS.test(file.name)) throw new Error('Tipo de arquivo não permitido.');
  const fileName = `uploads/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('uploads').upload(fileName, file);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return { file_url: publicUrl };
}

// Bucket "private-uploads" (public: false, ver migration-fix-private-
// storage-bucket.sql) — usado para documentos sensíveis como certificados
// digitais .pfx e XMLs fiscais. O caminho é prefixado pelo cnpj do usuário
// porque a RLS de storage.objects usa o primeiro segmento do path para
// isolar por empresa; sem "cnpj" não há como aplicar esse isolamento.
export async function UploadPrivateFile({ file, cnpj }) {
  if (!cnpj) throw new Error('UploadPrivateFile requer o cnpj do usuário para isolar o armazenamento por empresa.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Arquivo excede o tamanho máximo permitido (20MB).');
  const fileName = `${cnpj}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('private-uploads').upload(fileName, file);
  if (error) throw error;
  return { file_uri: fileName };
}

// Gera uma URL temporária para baixar/exibir um arquivo do bucket privado.
// A RLS de storage.objects já garante que só usuários do mesmo cnpj
// conseguem gerar uma signed URL para o path.
export async function GetPrivateFileUrl(path, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from('private-uploads').createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function SendEmail({ to, subject, body, html }) {
  console.warn('SendEmail: configure um serviço externo (Resend, SendGrid)');
  return { success: false };
}

export async function GenerateImage({ prompt }) {
  console.warn('GenerateImage: Groq não suporta geração de imagens.');
  return { url: '' };
}
