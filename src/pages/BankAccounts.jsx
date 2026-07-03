import React, { useEffect, useState } from 'react';
import { BankAccount } from '@/entities/BankAccount';
import { BankTransaction } from '@/entities/BankTransaction';
import { User } from '@/entities/User';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Plus, RefreshCw, Landmark, TrendingUp } from 'lucide-react';

export default function BankAccounts(){
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ bank_name:'', account_name:'', account_number:'', initial_balance:'' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async ()=>{
    const rows = await BankAccount.list('-updated_at', 100);
    setList(rows);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const recomputeBalance = async (acc)=>{
    const txs = await BankTransaction.filter({ bank_account_id: acc.id }, '-created_at', 5000);
    const net = txs.reduce((sum,t)=> sum + Number(t.amount||0), 0);
    const newBal = Number(acc.initial_balance||0) + net;
    if (Number((acc.current_balance??0).toFixed(2)) !== Number(newBal.toFixed(2))){
      await BankAccount.update(acc.id, { current_balance: newBal });
    }
  };

  const recomputeAll = async ()=>{
    const rows = await BankAccount.list('-updated_at', 200);
    for(const acc of rows){ await recomputeBalance(acc); }
    await load();
  };

  const handleCreate = async (e)=>{
    e.preventDefault(); setSaving(true);
    const me = await User.me();
    await BankAccount.create({ ...form, initial_balance: Number(form.initial_balance)||0, current_balance: Number(form.initial_balance)||0, cnpj: me?.cnpj });
    setForm({ bank_name:'', account_name:'', account_number:'', initial_balance:'' });
    setSaving(false); await load();
  };

  const totalBalance = list.reduce((sum, a) => sum + Number(a.current_balance||0), 0);

  if (loading) return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="animate-pulse space-y-3 p-4">
        {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded-lg" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" /> Contas Bancárias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas contas e acompanhe os saldos</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={recomputeAll}>
          <RefreshCw className="w-4 h-4" /> Recalcular saldos
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm sm:col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Saldo Total Consolidado</p>
            <p className={`text-2xl font-bold mt-1 ${totalBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{list.length} {list.length === 1 ? 'conta' : 'contas'} cadastradas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Contas Ativas</p>
            <p className="text-2xl font-bold text-foreground mt-1">{list.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total de contas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Saldo Médio</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              R$ {list.length ? (totalBalance / list.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Por conta</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts table */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="w-5 h-5 text-primary" /> Contas Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Landmark className="w-8 h-8 text-muted-foreground opacity-60" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma conta cadastrada</h3>
              <p className="text-muted-foreground text-sm mb-4">Adicione uma conta bancária usando o formulário abaixo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Banco</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Conta</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Número</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Saldo Inicial</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Saldo Atual</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(a => (
                    <TableRow key={a.id} className="border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground">{a.bank_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.account_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{a.account_number}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        R$ {Number(a.initial_balance||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${Number(a.current_balance||0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          R$ {Number(a.current_balance||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={()=>recomputeBalance(a)} className="gap-1 text-muted-foreground hover:text-foreground">
                          <RefreshCw className="w-3 h-3" /> Atualizar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New account form */}
      <Card className="bg-card border-border border-l-4 border-l-blue-500 shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Plus className="w-5 h-5 text-primary" /> Nova Conta Bancária
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Banco</Label>
              <Input
                value={form.bank_name}
                onChange={e=>setForm(s=>({...s, bank_name:e.target.value}))}
                placeholder="Ex: Bradesco"
                className="bg-background border-border"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Nome da Conta</Label>
              <Input
                value={form.account_name}
                onChange={e=>setForm(s=>({...s, account_name:e.target.value}))}
                placeholder="Ex: Conta Corrente"
                className="bg-background border-border"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Número</Label>
              <Input
                value={form.account_number}
                onChange={e=>setForm(s=>({...s, account_number:e.target.value}))}
                placeholder="Ex: 12345-6"
                className="bg-background border-border"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Saldo Inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.initial_balance}
                onChange={e=>setForm(s=>({...s, initial_balance:e.target.value}))}
                placeholder="0,00"
                className="bg-background border-border"
                required
              />
            </div>
            <div className="md:col-span-4 flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="gap-2">
                <Plus className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Adicionar Conta'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
