const SENSITIVE_KEYS = /password|senha|token|secret|authorization|cookie|cpf|cnpj|email/i;

function createErrorId() {
  const random = globalThis.crypto?.randomUUID?.().split("-")[0];
  return `FG-${Date.now().toString(36).toUpperCase()}-${(random || Math.random().toString(36).slice(2, 10)).toUpperCase()}`;
}

function sanitize(value, depth = 0) {
  if (depth > 3) return "[limite de profundidade]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, 500);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).slice(0, 30).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.test(key) ? "[removido]" : sanitize(item, depth + 1),
      ]),
    );
  }
  return String(value).slice(0, 500);
}

export function reportError(error, context = {}) {
  const errorId = createErrorId();
  const normalized = {
    errorId,
    message: error instanceof Error ? error.message : String(error || "Erro desconhecido"),
    stack: error instanceof Error ? error.stack : undefined,
    context: sanitize(context),
    path: globalThis.location?.pathname,
    occurredAt: new Date().toISOString(),
  };

  // Em produção, não exponha dados do usuário no console. Este ponto pode ser
  // conectado a um provedor (Sentry/OTel) sem espalhar integrações pelas telas.
  if (import.meta.env.DEV) console.error("[FaciliGestor360]", normalized);

  globalThis.dispatchEvent?.(new CustomEvent("faciligestor:error", { detail: normalized }));
  return errorId;
}

export function installGlobalErrorHandlers() {
  const onError = (event) => reportError(event.error || event.message, { source: "window.error" });
  const onUnhandledRejection = (event) => reportError(event.reason, { source: "unhandledrejection" });

  globalThis.addEventListener?.("error", onError);
  globalThis.addEventListener?.("unhandledrejection", onUnhandledRejection);

  return () => {
    globalThis.removeEventListener?.("error", onError);
    globalThis.removeEventListener?.("unhandledrejection", onUnhandledRejection);
  };
}
