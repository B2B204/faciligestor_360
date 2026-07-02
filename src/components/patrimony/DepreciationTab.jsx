import React, { useState, useMemo } from 'react';
import { PatrimonyDepreciationEntry } from '@/entities/PatrimonyDepreciationEntry';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { TrendingDown, RefreshCw, History } from 'lucide-react';

const METHOD_LABELS = {
  linear: 'Linear',
  degressiva: 'Degressiva',
};

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function DepreciationTab({ patrimonies, onGenerate, generating }) {
  const [ledgerAsset, setLedgerAsset] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const depreciableAssets = useMemo(
    () => patrimonies.filter((p) => p.depreciation_method && p.depreciation_method !== 'none'),
    [patrimonies]
  );

  const totals = useMemo(() => ({
    acquisition: depreciableAssets.reduce((s, a) => s + Number(a.equipment_value || 0), 0),
    accumulated: depreciableAssets.reduce((s, a) => s + Number(a.accumulated_depreciation || 0), 0),
    bookValue: depreciableAssets.reduce((s, a) => s + Number(a.current_book_value ?? a.equipment_value ?? 0), 0),
  }), [depreciableAssets]);

  const openLedger = async (asset) => {
    setLedgerAsset(asset);
    setLoadingLedger(true);
    try {
      const entries = await PatrimonyDepreciationEntry.filter({ patrimony_id: asset.id }, '-competence_month');
      setLedgerEntries(entries);
    } finally {
      setLoadingLedger(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor de Aquisição</p>
              <p className="text-lg font-bold text-foreground mt-1">{fmt(totals.acquisition)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Depreciação Acumulada</p>
              <p className="text-lg font-bold text-amber-600 mt-1">{fmt(totals.accumulated)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor Contábil Atual</p>
              <p className="text-lg font-bold text-green-600 mt-1">{fmt(totals.bookValue)}</p>
            </CardContent>
          </Card>
        </div>
        <Button variant="outline" onClick={onGenerate} disabled={generating} className="gap-2 shrink-0">
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} /> {generating ? 'Gerando…' : 'Gerar Lançamentos Pendentes'}
        </Button>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center text-base font-semibold text-foreground">
            <TrendingDown className="w-4 h-4 mr-2 text-primary" /> Ativos com Depreciação Configurada ({depreciableAssets.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Equipamento</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Método</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Vida Útil</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Acumulada</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Valor Contábil</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Último Lançamento</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depreciableAssets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                    Nenhum ativo com depreciação configurada. Edite um equipamento e defina o método na seção "Depreciação".
                  </TableCell>
                </TableRow>
              ) : (
                depreciableAssets.map((a) => {
                  const bookValue = a.current_book_value ?? a.equipment_value ?? 0;
                  const fullyDepreciated = bookValue <= Number(a.residual_value || 0);
                  return (
                    <TableRow key={a.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{a.equipment_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border text-xs">
                          {METHOD_LABELS[a.depreciation_method] || a.depreciation_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.useful_life_months} meses</TableCell>
                      <TableCell className="text-right text-amber-600 font-medium">{fmt(a.accumulated_depreciation)}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={fullyDepreciated ? 'text-muted-foreground' : 'text-green-600'}>{fmt(bookValue)}</span>
                        {fullyDepreciated && <span className="ml-1 text-xs text-muted-foreground">(quitado)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.last_depreciation_month || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openLedger(a)} className="gap-1.5">
                          <History className="w-3.5 h-3.5" /> Lançamentos
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!ledgerAsset} onOpenChange={(v) => !v && setLedgerAsset(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançamentos de Depreciação — {ledgerAsset?.equipment_name}</DialogTitle>
          </DialogHeader>
          {loadingLedger ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
          ) : ledgerEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento gerado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Valor Contábil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.competence_month}</TableCell>
                    <TableCell className="text-right">{fmt(e.amount)}</TableCell>
                    <TableCell className="text-right">{fmt(e.book_value_after)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
