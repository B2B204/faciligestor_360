import React, { useEffect, useState, useCallback } from 'react';
import { CostCenter } from '@/entities/CostCenter';
import { Contract } from '@/entities/Contract';
import { User } from '@/entities/User';
import { Tags, Plus, Edit2, Trash2, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const EMPTY_FORM = { name: '', code: '', description: '', contract_id: '' };
const NONE_VALUE = '__none__';

function contractLabel(c) {
  return [c.contract_number, c.client_name || c.name].filter(Boolean).join(' - ');
}

function CostCenterDialog({ open, onOpenChange, initial, contracts, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM); }, [initial, open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleContractChange = (v) => {
    if (v === NONE_VALUE) { set('contract_id', ''); return; }
    const contract = contracts.find((c) => c.id === v);
    setForm((f) => ({
      ...f,
      contract_id: v,
      name: f.name.trim() ? f.name : (contract ? contractLabel(contract) : f.name),
    }));
  };

  const handle = async () => {
    if (!form.name.trim()) { alert('Informe o nome do centro de custo.'); return; }
    setSaving(true);
    try { await onSave({ ...form, contract_id: form.contract_id || null }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Tags className="w-5 h-5 text-primary" /> {initial ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Contrato Vinculado</Label>
            <Select value={form.contract_id || NONE_VALUE} onValueChange={handleContractChange}>
              <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecionar contrato (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Nenhum (centro de custo avulso)</SelectItem>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{contractLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Filial Águas Claras, Obra CFMV, Administrativo..." className="bg-background border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Código (opcional)</Label>
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="Ex: CC-001" className="bg-background border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className="bg-background border-border resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
          <Button onClick={handle} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CostCenters() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const me = await User.me();
    setUser(me);
    const [data, contractData] = await Promise.all([
      CostCenter.filter({ cnpj: me.cnpj }, '-created_at'),
      Contract.filter({ cnpj: me.cnpj, deleted_at: null }, '-created_date'),
    ]);
    setItems(data);
    setContracts(contractData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    await CostCenter.create({ ...data, cnpj: user.cnpj, is_active: true, created_by: user.email });
    setShowForm(false);
    await load();
  };

  const handleUpdate = async (data) => {
    await CostCenter.update(editing.id, { ...data, updated_by: user.email });
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const toggleActive = async (item) => {
    await CostCenter.update(item.id, { is_active: !item.is_active });
    await load();
  };

  const remove = async (item) => {
    if (!window.confirm(`Excluir o centro de custo "${item.name}"?`)) return;
    await CostCenter.delete(item.id);
    await load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tags className="w-6 h-6 text-primary" /> Centros de Custo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cadastre os centros de custo para classificar despesas em Contas a Pagar
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Novo Centro de Custo
        </Button>
      </div>

      <div className="flex gap-2 items-start rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Centros de custo cadastrados aqui ficam disponíveis para seleção ao lançar uma despesa em Contas a Pagar.
        </p>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Tags className="w-10 h-10 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum centro de custo cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Crie centros de custo para saber onde cada despesa está sendo alocada (filial, obra, projeto, setor...).
              </p>
              <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Novo Centro de Custo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Nome</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Contrato Vinculado</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Código</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Descrição</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground text-sm">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.contract_id ? (contracts.find((c) => c.id === item.contract_id) ? contractLabel(contracts.find((c) => c.id === item.contract_id)) : '—') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">{item.code || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{item.description || '—'}</TableCell>
                      <TableCell>
                        <Badge className={item.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}>
                          {item.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => toggleActive(item)} title={item.is_active ? 'Desativar' : 'Ativar'}>
                            {item.is_active ? '⏸' : '▶'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(item); setShowForm(true); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 dark:text-red-400" onClick={() => remove(item)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CostCenterDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        initial={editing}
        contracts={contracts}
        onSave={editing ? handleUpdate : handleCreate}
      />
    </div>
  );
}
