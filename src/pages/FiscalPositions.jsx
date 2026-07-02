import React, { useEffect, useState, useCallback } from 'react';
import { FiscalPosition } from '@/entities/FiscalPosition';
import { User } from '@/entities/User';
import { TAX_LABELS } from '@/lib/fiscalEngine';
import {
  Landmark, Plus, Edit2, Trash2, Star, Info
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const SERVICE_TYPE_OPTIONS = {
  todos: 'Todos os tipos',
  limpeza: 'Limpeza',
  portaria: 'Portaria',
  manutencao: 'Manutenção',
  seguranca: 'Segurança',
  jardinagem: 'Jardinagem',
  ar_condicionado: 'Ar-condicionado',
  obras: 'Obras',
  copeiragem: 'Copeiragem',
  garcom: 'Garçom',
  administrativo: 'Administrativo',
  outros: 'Outros',
};

const CLIENT_TYPE_OPTIONS = {
  todos: 'Todos os clientes',
  pj: 'Pessoa Jurídica (Privada)',
  pf: 'Pessoa Física',
  orgao_publico: 'Órgão Público',
};

const EMPTY_FORM = {
  name: '', service_type: 'todos', client_type: 'todos', priority: 100, is_default: false,
  retain_at_source: false, rate_iss: '', rate_pis: '', rate_cofins: '', rate_csll: '', rate_inss: '', rate_irrf: '', notes: '',
};

function PositionDialog({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM); }, [initial, open]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.name.trim()) { alert('Informe o nome da regra.'); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        priority: Number(form.priority) || 100,
        ...Object.fromEntries(Object.keys(TAX_LABELS).map((k) => [`rate_${k}`, Number(form[`rate_${k}`]) || 0])),
      });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Landmark className="w-5 h-5 text-primary" /> {initial ? 'Editar Regra Fiscal' : 'Nova Regra Fiscal'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome da Regra *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Órgão Público - Retenções na Fonte" className="bg-background border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de Serviço</Label>
              <Select value={form.service_type} onValueChange={(v) => set('service_type', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_TYPE_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de Cliente</Label>
              <Select value={form.client_type} onValueChange={(v) => set('client_type', v)}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_TYPE_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {Object.entries(TAX_LABELS).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label} (%)</Label>
                <Input type="number" step="0.001" min="0" value={form[`rate_${k}`]} onChange={(e) => set(`rate_${k}`, e.target.value)} placeholder="0,000" className="bg-background border-border" />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={form.retain_at_source} onCheckedChange={(v) => set('retain_at_source', !!v)} />
            <Label className="text-sm text-foreground">Reter impostos na fonte (reduz o valor líquido a receber)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={form.is_default} onCheckedChange={(v) => set('is_default', !!v)} />
            <Label className="text-sm text-foreground">Usar como regra padrão (quando nenhuma outra casar)</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Prioridade (menor = avaliada primeiro em empates)</Label>
            <Input type="number" value={form.priority} onChange={(e) => set('priority', e.target.value)} className="bg-background border-border w-32" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="bg-background border-border resize-none" />
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

export default function FiscalPositions() {
  const [user, setUser] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const me = await User.me();
    setUser(me);
    const data = await FiscalPosition.filter({ cnpj: me.cnpj }, '-created_at');
    setPositions(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    await FiscalPosition.create({ ...data, cnpj: user.cnpj, is_active: true, created_by: user.email });
    setShowForm(false);
    await load();
  };

  const handleUpdate = async (data) => {
    await FiscalPosition.update(editing.id, { ...data, updated_by: user.email });
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const toggleActive = async (pos) => {
    await FiscalPosition.update(pos.id, { is_active: !pos.is_active });
    await load();
  };

  const remove = async (pos) => {
    if (!window.confirm(`Excluir a regra "${pos.name}"?`)) return;
    await FiscalPosition.delete(pos.id);
    await load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" /> Regras Fiscais
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mapeamento automático de impostos por tipo de operação/cliente (posições fiscais)
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Nova Regra
        </Button>
      </div>

      <div className="flex gap-2 items-start rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Ao lançar uma Conta a Receber vinculada a um contrato, o sistema busca a regra mais específica que combine
          com o tipo de serviço e o tipo de cliente do contrato e calcula os impostos automaticamente. Se nada casar,
          usa a regra marcada como padrão.
        </p>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Landmark className="w-10 h-10 text-muted-foreground opacity-50 mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma regra fiscal cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Crie regras para calcular ISS, PIS, COFINS, CSLL, INSS e IRRF automaticamente por tipo de serviço e cliente.
              </p>
              <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Nova Regra
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Regra</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Serviço</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Alíquotas</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Retém?</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => {
                    const rates = Object.keys(TAX_LABELS)
                      .map((k) => ({ label: TAX_LABELS[k], rate: Number(pos[`rate_${k}`]) || 0 }))
                      .filter((r) => r.rate > 0);
                    return (
                      <TableRow key={pos.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground text-sm">
                          <div className="flex items-center gap-1.5">
                            {pos.is_default && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                            {pos.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{SERVICE_TYPE_OPTIONS[pos.service_type] || pos.service_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{CLIENT_TYPE_OPTIONS[pos.client_type] || pos.client_type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rates.length === 0 ? '—' : rates.map((r) => `${r.label} ${r.rate}%`).join(' · ')}
                        </TableCell>
                        <TableCell>
                          {pos.retain_at_source
                            ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Sim</Badge>
                            : <Badge variant="outline" className="border-border text-muted-foreground">Não</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={pos.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}>
                            {pos.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => toggleActive(pos)} title={pos.is_active ? 'Desativar' : 'Ativar'}>
                              {pos.is_active ? '⏸' : '▶'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(pos); setShowForm(true); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 dark:text-red-400" onClick={() => remove(pos)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PositionDialog
        open={showForm}
        onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null); }}
        initial={editing}
        onSave={editing ? handleUpdate : handleCreate}
      />
    </div>
  );
}
