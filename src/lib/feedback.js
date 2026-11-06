import { toast } from "@/components/ui/use-toast";
import { reportError } from "@/lib/errorReporter";

export function notifySuccess(title, description) {
  return toast({ title, description });
}

export function notifyWarning(title, description) {
  return toast({ title, description, variant: "warning" });
}

export function notifyError(error, options = {}) {
  const errorId = reportError(error, options.context);
  const description = options.description || "Tente novamente. Se o problema continuar, informe o código ao suporte.";

  toast({
    title: options.title || "Não foi possível concluir",
    description: `${description} Código: ${errorId}`,
    variant: "destructive",
  });

  return errorId;
}
