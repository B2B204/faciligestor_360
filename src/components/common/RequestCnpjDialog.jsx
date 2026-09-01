import React, { useState } from "react";
import { CnpjAccessRequest } from "@/entities/CnpjAccessRequest";
import { UserCnpjAccess } from "@/entities/UserCnpjAccess";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import CnpjLookupInput from "@/components/common/CnpjLookupInput";

export default function RequestCnpjDialog({ user, onSubmitted }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [rfInfo, setRfInfo] = useState(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCnpj("");
    setRfInfo(null);
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
      const alreadyRequested = await CnpjAccessRequest.filter({ requester_email: user.email, cnpj: digits });
      const pending = (alreadyRequested || []).find((r) => !r.status || r.status === 'pendente');
      if (pending) {
        toast({ title: 'Você já solicitou este CNPJ', description: 'Aguarde a aprovação de um administrador — não é preciso enviar de novo.' });
        setOpen(false);
        resetForm();
        return;
      }

      // Admin já tem autoridade para aprovar qualquer solicitação em
      // Configurações da Empresa — pedir para si mesmo e depois ter que ir
      // aprovar manualmente é só fricção, então o acesso já sai liberado.
      const isAdmin = user.department === 'admin';
      const now = new Date().toISOString();
      await CnpjAccessRequest.create({
        requester_email: user.email,
        cnpj: digits,
        reason,
        status: isAdmin ? 'aprovado' : 'pendente',
        ...(isAdmin ? { decided_by: user.email, decided_at: now } : {}),
      });
      if (isAdmin) {
        const existingAccess = await UserCnpjAccess.filter({ user_email: user.email, cnpj: digits });
        if (!existingAccess || existingAccess.length === 0) {
          await UserCnpjAccess.create({ user_email: user.email, cnpj: digits });
        }
      }
      setOpen(false);
      resetForm();
      onSubmitted?.();
      toast(isAdmin ? {
        title: 'Acesso liberado',
        description: 'Você é administrador, então o CNPJ já está disponível no seletor.',
      } : {
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
            onChange={(e) => { setCnpj(e.target.value); setRfInfo(null); }}
            onFound={(data) => setRfInfo(data)}
          />
          {rfInfo && (
            <div className="p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-400 space-y-0.5">
              <p className="font-medium">{rfInfo.razaoSocial || rfInfo.nome}</p>
              {rfInfo.endereco && <p>{rfInfo.endereco}</p>}
              {rfInfo.situacao && <p>Situação: {rfInfo.situacao}{rfInfo.abertura ? ` · Desde ${rfInfo.abertura}` : ''}</p>}
            </div>
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