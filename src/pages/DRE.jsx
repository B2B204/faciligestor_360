import React, { useEffect, useMemo, useState } from 'react';
import { AccountsReceivable } from '@/entities/AccountsReceivable';
import { AccountsPayable } from '@/entities/AccountsPayable';
import { Contract } from '@/entities/Contract';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, BarChart3, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

function monthStr(d) {
  if (!d) return '';
  return String(d).slice(0, 7);
}

export default function DRE() {
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [expanded, setExpanded] = useState({}); // centro -> bool

  const load = async () => {
    setLoading(true);
    try {
      const [ar, ap, cons] = await Promise.all([
        AccountsReceivable.list('-updated_at', 5000),
        AccountsPayable.list('-updated_at', 5000),
        Contract.list('-updated_at', 1000)
      ]);
      setReceivables(ar || []);
      setPayables(ap || []);
      setContracts(cons || []);
    } catch (error) {
      console.error('Erro ao carregar dados do DRE:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const contractName = useMemo(() => {
    const map = { sem_centro: 'Geral' };
    contracts.forEach(c => { map[c.id] = c.name || c.client_name || c.contract_number || 'Contrato'; });
    return map;
  }, [contracts]);

  const data = useMemo(() => {
    const centers = {}; // key -> { receita, despesa, categorias: {cat: {receita, despesa}} }

    const add = (center, cat, r = 0, d = 0) => {
      if (!centers[center]) centers[center] = { receita: 0, despesa: 0, categorias: {} };
      centers[center].receita += r;
      centers[center].despesa += d;
      if (!centers[center].categorias[cat]) centers[center].categorias[cat] = { receita: 0, despesa: 0 };
      centers[center].categorias[cat].receita += r;
      centers[center].categorias[cat].despesa += d;
    };

    // Receitas (AR)
    const arMonth = receivables.filter(r => (r.competence_month || monthStr(r.due_date) || monthStr(r.issue_date)) === month);
    arMonth.forEach(r => {
      const center = r.contract_id || 'sem_centro';
      const val = Number(r.face_value || 0);
      add(center, 'receitas', val, 0);
    });

    // Despesas (AP)
    const apMonth = payables.filter(p => (p.competence_month || monthStr(p.due_date) || monthStr(p.issue_date)) === month);
    apMonth.forEach(p => {
      const center = p.contract_id || 'sem_centro'; // pode não existir no schema; cai em Geral
      const cat = p.category || 'outros';
      const val = Number(p.face_value || 0);
      add(center, cat, 0, val);
    });

    const rows = Object.entries(centers).map(([center, v]) => ({
      center,
      receita: v.receita,
      despesa: v.despesa,
      resultado: v.receita - v.despesa,
      categorias: v.categorias
    }));

    const totals = rows.reduce((acc, r) => {
      acc.receita += r.receita; acc.despesa += r.despesa; return acc;
    }, { receita: 0, despesa: 0 });

    // Consolidado por categoria (todas os centros)
    const catAll = {};
    rows.forEach(r => {
      Object.entries(r.categorias).forEach(([k, v]) => {
        if (!catAll[k]) catAll[k] = { receita: 0, despesa: 0 };
        catAll[k].receita += v.receita;
        catAll[k].despesa += v.despesa;
      });
    });

    return { rows, totals, catAll };
  }, [receivables, payables, month, contracts]);

  const receitaTotal = data.totals?.receita || 0;
  const despesaTotal = data.totals?.despesa || 0;
  const resultado = receitaTotal - despesaTotal;

  const fmt = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> DRE — Demonstrativo de Resultados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Análise financeira por competência e centro de custo</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40 bg-background border-border"
          />
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Receita Total</p>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">R$ {fmt(receitaTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Competência {month}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Despesa Total</p>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">R$ {fmt(despesaTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Competência {month}</p>
          </CardContent>
        </Card>
        <Card className={`bg-card border-border border-l-4 shadow-sm ${resultado >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resultado</p>
              <BarChart3 className={`w-4 h-4 ${resultado >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
            </div>
            <p className={`text-2xl font-bold ${resultado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              R$ {fmt(resultado)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{resultado >= 0 ? 'Superávit' : 'Déficit'} no período</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost center table */}
      {loading ? (
        <div className="animate-pulse space-y-3 p-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted rounded-lg" />)}
        </div>
      ) : (
        <>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-foreground text-base">Por Centro de Custo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Centro de Custo</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Receita</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Despesa</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                              <BarChart3 className="w-6 h-6 text-muted-foreground opacity-60" />
                            </div>
                            <p className="text-muted-foreground text-sm">Nenhum lançamento encontrado para este período</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {data.rows.map((r) => {
                          const isOpen = !!expanded[r.center];
                          return (
                            <React.Fragment key={r.center}>
                              <TableRow className="border-border hover:bg-muted/30 transition-colors">
                                <TableCell className="py-3">
                                  <button
                                    className="p-1 rounded hover:bg-muted transition-colors"
                                    onClick={() => setExpanded(s => ({...s, [r.center]: !isOpen}))}
                                  >
                                    {isOpen
                                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    }
                                  </button>
                                </TableCell>
                                <TableCell className="font-medium text-foreground">{contractName[r.center] || 'Geral'}</TableCell>
                                <TableCell className="text-right text-green-600 dark:text-green-400 font-semibold">R$ {fmt(r.receita)}</TableCell>
                                <TableCell className="text-right text-red-600 dark:text-red-400 font-semibold">R$ {fmt(r.despesa)}</TableCell>
                                <TableCell className={`text-right font-bold ${r.resultado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  R$ {fmt(r.resultado)}
                                </TableCell>
                              </TableRow>
                              {isOpen && (
                                <TableRow className="bg-muted/20 border-border">
                                  <TableCell></TableCell>
                                  <TableCell colSpan={4} className="py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {Object.entries(r.categorias).map(([k, v]) => (
                                        <div key={k} className="p-3 rounded-lg border border-border bg-card shadow-sm">
                                          <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider mb-2">{k}</div>
                                          <div className="flex justify-between text-sm mt-1">
                                            <span className="text-muted-foreground">Receita</span>
                                            <span className="font-semibold text-green-600 dark:text-green-400">R$ {fmt(v.receita)}</span>
                                          </div>
                                          <div className="flex justify-between text-sm mt-0.5">
                                            <span className="text-muted-foreground">Despesa</span>
                                            <span className="font-semibold text-red-600 dark:text-red-400">R$ {fmt(v.despesa)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {/* Totals row */}
                        <TableRow className="bg-muted/50 border-border font-semibold">
                          <TableCell></TableCell>
                          <TableCell className="font-bold text-foreground">Total Geral</TableCell>
                          <TableCell className="text-right font-bold text-green-600 dark:text-green-400">R$ {fmt(receitaTotal)}</TableCell>
                          <TableCell className="text-right font-bold text-red-600 dark:text-red-400">R$ {fmt(despesaTotal)}</TableCell>
                          <TableCell className={`text-right font-bold ${resultado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            R$ {fmt(resultado)}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Category breakdown */}
          {Object.keys(data.catAll || {}).length > 0 && (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-foreground text-base">Consolidado por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.entries(data.catAll || {}).map(([k, v]) => (
                    <div key={k} className="p-4 rounded-lg border border-border bg-muted/30">
                      <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider mb-2">{k}</div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Receita</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">R$ {fmt(v.receita)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-0.5">
                        <span className="text-muted-foreground">Despesa</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">R$ {fmt(v.despesa)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
