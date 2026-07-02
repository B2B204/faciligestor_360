import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus } from 'lucide-react';
import { lookupCnpj } from '@/functions/lookupCnpj';

export default function NewPayableDialog({ open, onOpenChange, banks = [], costCenters = [], onCreate }) {
  const [form, setForm] = useState({
    supplier_cnpj: '',
    supplier_name: '',
    document_number: '',
    due_date: '',
    face_value: '',
    bank_account_id: '',
    category: 'fornecedor',
    cost_center_id: '',
    observations: ''
  });
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLookup = async () => {
    const cnpj = (form.supplier_cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) return alert('Informe um CNPJ válido (14 dígitos).');
    setLoadingLookup(true);
    try {
      const res = await lookupCnpj({ cnpj });
      const data = res.data || res; // compat
      setForm((s) => ({ ...s, supplier_name: data.razao_social || data.nome_fantasia || s.supplier_name }));
    } catch (e) {
      alert('CNPJ não encontrado na Receita.');
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleSave = async () => {
    if (!form.supplier_name || !form.due_date || !form.face_value) {
      return alert('Preencha Fornecedor, Vencimento e Valor.');
    }
    setSaving(true);
    try {
      await onCreate?.({ ...form });
      setForm({ supplier_cnpj: '', supplier_name: '', document_number: '', due_date: '', face_value: '', bank_account_id: '', category: 'fornecedor', cost_center_id: '', observations: '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova conta a pagar</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
              <label className="text-sm font-medium">CNPJ do Fornecedor</label>
              <Input placeholder="00.000.000/0000-00" value={form.supplier_cnpj} onChange={(e)=>setForm(s=>({...s, supplier_cnpj:e.target.value}))}/>
            </div>
            <Button onClick={handleLookup} disabled={loadingLookup} className="mt-6 gap-2">
              <Search className="w-4 h-4" /> {loadingLookup ? 'Buscando...' : 'Buscar CNPJ'}
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium">Fornecedor</label>
            <Input value={form.supplier_name} onChange={(e)=>setForm(s=>({...s, supplier_name:e.target.value}))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Documento</label>
              <Input value={form.document_number} onChange={(e)=>setForm(s=>({...s, document_number:e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium">Vencimento</label>
              <Input type="date" value={form.due_date} onChange={(e)=>setForm(s=>({...s, due_date:e.target.value}))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input type="number" step="0.01" value={form.face_value} onChange={(e)=>setForm(s=>({...s, face_value:e.target.value}))} />
            </div>
            <div>
              <label className="text-sm font-medium">Conta Bancária</label>
              <Select value={form.bank_account_id} onValueChange={(v)=>setForm(s=>({...s, bank_account_id:v}))}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {banks.map(b=> (
                    <SelectItem key={b.id} value={b.id}>{b.bank_name} • {b.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Categoria</label>
              <Select value={form.category} onValueChange={(v)=>setForm(s=>({...s, category:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="impostos">Impostos</SelectItem>
                  <SelectItem value="salarios">Salários</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Centro de Custo</label>
              <Select value={form.cost_center_id} onValueChange={(v)=>setForm(s=>({...s, cost_center_id:v}))}>
                <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                <SelectContent>
                  {costCenters.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Observações</label>
            <Textarea rows={3} value={form.observations} onChange={(e)=>setForm(s=>({...s, observations:e.target.value}))} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2"><Plus className="w-4 h-4"/>{saving? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}