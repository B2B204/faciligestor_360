import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceivablePayment } from "@/entities/ReceivablePayment";
import { AccountsReceivable } from "@/entities/AccountsReceivable";
import { AccountsReceivableHistory } from "@/entities/AccountsReceivableHistory";

export default function PaymentModal({ open, onOpenChange, account, user, onSaved }) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [method, setMethod] = useState("pix");
  const [proofUrl, setProofUrl] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

  const handleSave = async () => {
    const numAmount = parseFloat(amount || "0");
    if (!numAmount || numAmount <= 0 || !paymentDate) {
      alert("Informe o valor e a data do recebimento.");
      return;
    }
    setSaving(true);
    try {
      const paymentNotes = [observation, proofUrl ? `Comprovante: ${proofUrl}` : ""].filter(Boolean).join(" | ");
      await ReceivablePayment.create({
        receivable_id: account.id,
        amount: numAmount,
        payment_date: paymentDate,
        method,
        notes: paymentNotes,
        cnpj: user.cnpj
      });

      const currentOpen = account.open_amount != null ? account.open_amount : ((account.face_value || 0) - (account.paid_amount || 0));
      const newPaid = (account.paid_amount || 0) + numAmount;
      const newOpen = Math.max(0, (currentOpen || 0) - numAmount);
      const fullyPaid = newOpen <= 0.000001;
      const newStatus = fullyPaid ? "liquidado" : "parcial";

      await AccountsReceivable.update(account.id, {
        paid_amount: newPaid,
        open_amount: newOpen,
        status: newStatus,
        payment_date: fullyPaid ? paymentDate : account.payment_date || null,
        settlement_date: fullyPaid ? paymentDate : account.settlement_date || null,
        updated_by: user.email
      });

      await AccountsReceivableHistory.create({
        receivable_id: account.id,
        action: "payment",
        notes: `Recebimento registrado: ${formatCurrency(numAmount)} via ${method}${proofUrl ? " (comprovante anexado)" : ""}.`,
        cnpj: user.cnpj
      });

      onSaved && onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Registrar Recebimento - {account.document_number}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Data do Recebimento</Label>
            <Input type="date" value={paymentDate} onChange={(e)=>setPaymentDate(e.target.value)} />
          </div>
          <div>
            <Label>Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="empenho">Nota/Empenho</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comprovante (URL)</Label>
            <Input value={proofUrl} onChange={(e)=>setProofUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <Label>Observação</Label>
            <Input value={observation} onChange={(e)=>setObservation(e.target.value)} placeholder="Detalhes do recebimento" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}