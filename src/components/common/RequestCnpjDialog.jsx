import React, { useState } from "react";
import { CnpjAccessRequest } from "@/entities/CnpjAccessRequest";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import CnpjLookupInput from "@/components/common/CnpjLookupInput";

export default function RequestCnpjDialog({ user, onSubmitted }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCnpj("");
    setCompanyName("");
    setReason("");
  };

  const handleSubmit = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast({ variant: 'destructive', title: 'CNPJ inválido', description: 'Informe os 14 dígitos do CNPJ.' });
      return;
    }
    setLoading(true);
    try {
      await CnpjAccessRequest.create({ requester_email: user.email, cnpj: digits, reason, status: "pendente" });
      setOpen(false);
      resetForm();
      onSubmitted?.();
      toast({
        title: 'Solicitação enviada',
        description: 'Um administrador precisa aprovar em Configurações da Empresa antes que o CNPJ apareça no seletor.',
      });
    } catch (error) {
      console.error('Erro ao solicitar acesso a CNPJ:', error);
      toast({ variant: 'destructive', title: 'Erro ao enviar solicitação', description: error.message || 'Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Solicitar CNPJ</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar acesso a CNPJ</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <CnpjLookupInput
            placeholder="00.000.000/0001-00"
            name="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            onFound={(data) => setCompanyName(data.nome || "")}
          />
          {companyName && (
            <p className="text-xs text-green-700 dark:text-green-400">Empresa encontrada: {companyName}</p>
          )}
          <Textarea placeholder="Justificativa (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!cnpj || loading}>{loading ? "Enviando..." : "Enviar pedido"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}