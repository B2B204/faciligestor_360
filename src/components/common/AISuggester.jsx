import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Copy, Check, AlertCircle, Zap } from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";
import { AISuggestion } from "@/entities/AISuggestion";
import { User } from "@/entities/User";

export default function AISuggester({ label = "Sugerir texto (IA)", contextType, contextId, defaultPrompt, onUseText }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt || "");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const buildSystemPrompt = () => {
    if (contextType === "oficio") {
      return [
        "Você é um redator jurídico especializado em contratações públicas.",
        "Base normativa obrigatória: Lei 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos).",
        "Instruções:",
        "- Redija o texto em linguagem formal e objetiva;",
        "- Inclua fundamentação legal (Lei 14.133/21) com artigos pertinentes quando aplicável;",
        "- Use estrutura típica: identificação, objeto, contexto, fundamentação, providências/prazos, assinatura;",
        "- Não invente dados de contrato; use apenas informações fornecidas no contexto.",
      ].join("\n");
    }
    if (contextType === "repactuacao") {
      return [
        "Você é um redator jurídico especializado em repactuação/reequilíbrio em contratos administrativos.",
        "Base normativa: Lei 14.133/2021 e normativos correlatos.",
        "Instruções:",
        "- Redija um pedido claro de repactuação com motivação, índices, datas, impactos e prazos;",
        "- Inclua fundamentação legal pertinente à Lei 14.133/21;",
        "- Não invente valores ou datas não fornecidas; destaque campos que precisam de conferência.",
      ].join("\n");
    }
    return "Você é um assistente especializado em gestão de facilities e contratos. Forneça respostas claras, objetivas e profissionais em português do Brasil.";
  };

  const run = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const user = await User.me();
      const text = await InvokeLLM({
        prompt,
        system_prompt: buildSystemPrompt(),
      });

      setResult(typeof text === "string" ? text : JSON.stringify(text, null, 2));

      await AISuggestion.create({
        context_type: contextType,
        context_id: contextId || "",
        prompt,
        suggestion: text,
        generated_by: user.email,
        cnpj: user.cnpj,
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message || "Erro ao gerar sugestão. Verifique a chave da API Groq.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const useText = () => {
    if (onUseText) {
      onUseText(result);
    } else {
      navigator.clipboard.writeText(result);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            Assistente de Texto com IA
            <Badge variant="secondary" className="ml-1 text-xs gap-1">
              <Zap className="w-3 h-3" /> Groq · Llama 3.3 70B
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Descreva o que você precisa</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Ex: Redija um ofício solicitando prorrogação do contrato nº 001/2024 por mais 12 meses, fundamentado na Lei 14.133/2021..."
              className="bg-background border-border text-foreground resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
              }}
            />
            <p className="text-xs text-muted-foreground">Pressione Ctrl+Enter para gerar</p>
          </div>

          <Button
            onClick={run}
            disabled={loading || !prompt.trim()}
            className="gap-2 w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando com IA...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Gerar Sugestão</>
            )}
          </Button>

          {error && (
            <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" /> Resultado gerado
                </label>
                <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5 h-7 text-xs">
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </Button>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-4 overflow-y-auto max-h-64">
                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{result}</pre>
              </div>
              <Button onClick={useText} className="gap-2">
                <Check className="w-4 h-4" /> Usar este texto
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
