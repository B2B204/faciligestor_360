import React, { useState } from "react";
import { CnpjAccessRequest } from "@/entities/CnpjAccessRequest";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function RequestCnpjDialog({ user, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    await CnpjAccessRequest.create({ requester_email: user.email, cnpj, reason });
    setLoading(false);
    setOpen(false);
    setCnpj("");
    setReason("");
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Solicitar CNPJ</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar acesso a CNPJ</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="CNPJ (somente números)" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
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