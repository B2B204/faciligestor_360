import React, { useState } from 'react';
import { Invoice } from '@/entities/Invoice';
import { AccountsPayable } from '@/entities/AccountsPayable';
import { AccountsReceivable } from '@/entities/AccountsReceivable';
import { BankTransaction } from '@/entities/BankTransaction';
import { BankAccount } from '@/entities/BankAccount';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, FileArchive, Download, Info, Calendar } from 'lucide-react';
import JSZip from 'jszip';

export default function AccountingBackup() {
  const [month, setMonth] = useState('');
  const [months, setMonths] = useState([]);
  const [working, setWorking] = useState(false);

  const addMonth = () => {
    if (month && !months.includes(month)) {
      setMonths(m => [...m, month].sort());
      setMonth('');
    }
  };

  const removeMonth = (m) => setMonths(ms => ms.filter(x => x !== m));

  const fetchMonth = async (m) => {
    const [invoices, pay, recv, bank, accounts] = await Promise.all([
      Invoice.filter({}, '-created_at', 2000),
      AccountsPayable.filter({}, '-created_at', 2000),
      AccountsReceivable.filter({}, '-created_date', 2000),
      BankTransaction.filter({}, '-created_at', 5000),
      BankAccount.list('-updated_at', 200)
    ]);
    const sel = (rows, f) => rows.filter(r => (r[f] || '').startsWith(m));
    return {
      invoices: sel(invoices, 'issue_date'),
      payables: sel(pay, 'due_date'),
      receivables: sel(recv, 'due_date'),
      bank: sel(bank, 'posted_date'),
      accounts
    };
  };

  const toCsv = (arr) =>
    arr.map(r => Object.keys(r).map(k => `"${String(r[k] ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');

  const generate = async () => {
    if (!months.length) return;
    setWorking(true);
    try {
      const zip = new JSZip();
      for (const m of months) {
        const data = await fetchMonth(m);
        const folder = zip.folder(m);
        folder.file('invoices.csv', toCsv(data.invoices));
        folder.file('payables.csv', toCsv(data.payables));
        folder.file('receivables.csv', toCsv(data.receivables));
        folder.file('bank.csv', toCsv(data.bank));
        const balances = data.accounts.map(a => ({
          bank_name: a.bank_name,
          account_name: a.account_name,
          account_number: a.account_number,
          current_balance: a.current_balance
        }));
        folder.file('balances.csv', toCsv(balances));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `backup-contabil-${months.length}m.zip`;
      a.click();
    } catch (error) {
      console.error("Erro ao gerar backup contábil:", error);
      alert("Erro ao gerar o pacote de backup. Tente novamente.");
    } finally {
      setWorking(false);
    }
  };

  const formatMonth = (m) => {
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileArchive className="w-6 h-6 text-primary" />
            Backup Contábil
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere pacotes de backup com dados financeiros por período para envio à contabilidade.
          </p>
        </div>
      </div>

      {/* Month selector */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Selecionar Períodos
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Adicione um ou mais meses para incluir no pacote de backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-sm font-medium text-foreground">Mês / Ano</Label>
              <Input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">Selecione o mês de referência para o backup.</p>
            </div>
            <Button
              onClick={addMonth}
              disabled={!month}
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Período
            </Button>
          </div>

          {months.length > 0 && (
            <>
              <Separator className="bg-border" />
              <div>
                <p className="text-sm font-medium text-foreground mb-3">
                  Períodos selecionados ({months.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {months.map(m => (
                    <div
                      key={m}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full text-sm font-medium"
                    >
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="capitalize">{formatMonth(m)}</span>
                      <button
                        onClick={() => removeMonth(m)}
                        className="ml-1 hover:text-destructive transition-colors"
                        aria-label={`Remover ${m}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Generate Package */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Gerar Pacote
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            O pacote ZIP conterá arquivos CSV com notas fiscais, contas a pagar/receber, transações bancárias e saldos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {months.length === 0 ? (
            <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Selecione pelo menos um período acima para habilitar a geração do pacote.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <FileArchive className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 dark:text-green-300">
                Pronto para gerar o backup de {months.length} {months.length === 1 ? 'período' : 'períodos'}. O download iniciará automaticamente.
              </p>
            </div>
          )}
          <Button
            onClick={generate}
            disabled={!months.length || working}
            size="lg"
            className="gap-2 w-full sm:w-auto"
          >
            <FileArchive className="w-4 h-4" />
            {working ? 'Gerando pacote...' : `Gerar Pacote ZIP`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
