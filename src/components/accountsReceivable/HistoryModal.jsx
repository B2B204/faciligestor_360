import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountsReceivableHistory } from "@/entities/AccountsReceivableHistory";
import { ReceivablePayment } from "@/entities/ReceivablePayment";
import { Badge } from "@/components/ui/badge";

export default function HistoryModal({ open, onOpenChange, account, user }) {
  const [history, setHistory] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!open || !account || !user) return;
      const [h, p] = await Promise.all([
        AccountsReceivableHistory.filter({ cnpj: user.cnpj, receivable_id: account.id }),
        ReceivablePayment.filter({ cnpj: user.cnpj, receivable_id: account.id })
      ]);
      setHistory((h||[]).sort((a,b)=> new Date(b.created_at)-new Date(a.created_at)));
      setPayments((p||[]).sort((a,b)=> new Date(b.payment_date)-new Date(a.payment_date)));
    };
    load();
  }, [open, account, user]);

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Histórico - {account.document_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">Pagamentos</h4>
            <div className="space-y-2">
              {(payments||[]).length ? payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border rounded p-2">
                  <span>{new Date(p.payment_date).toLocaleDateString('pt-BR')}</span>
                  <span className="font-medium">R$ {Number(p.amount||0).toFixed(2)}</span>
                  <Badge variant="secondary" className="capitalize">{p.method}</Badge>
                  {p.notes && <span className="text-gray-500 text-xs">{p.notes}</span>}
                </div>
              )) : <p className="text-sm text-gray-500">Sem pagamentos registrados.</p>}
            </div>
          </div>
          <div>
            <h4 className="font-semibold">Eventos</h4>
            <div className="space-y-2">
              {(history||[]).length ? history.map(h => (
                <div key={h.id} className="text-sm border rounded p-2">
                  <div className="flex items-center justify-between">
                    <Badge className="capitalize">{h.action}</Badge>
                    <span>{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="mt-1">{h.notes}</p>
                </div>
              )) : <p className="text-sm text-gray-500">Sem eventos registrados.</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}