import React, { useState, useEffect, useCallback } from 'react';
import { BankTransaction } from '@/entities/BankTransaction';
import { BankAccount } from '@/entities/BankAccount';
import { AccountsReceivable } from '@/entities/AccountsReceivable';
import { AccountsPayable } from '@/entities/AccountsPayable';
import { User } from '@/entities/User';
import { UploadFile, ExtractDataFromUploadedFile } from '@/integrations/Core';
import {
  getConnectToken,
  getAccounts,
  getTransactions,
  getItem,
  deleteItem,
  loadPluggyWidget,
  openPluggyWidget,
} from '@/integrations/pluggy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Banknote,
  Upload,
  CheckCircle2,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Building2,
  Plus,
  Trash2,
  AlertCircle,
  Wifi,
  WifiOff,
  Link2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// OFX parser (kept exactly as original)
// ---------------------------------------------------------------------------
function parseOfx(text) {
  const blocks = [...text.matchAll(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g)].map(
    (m) => m[0]
  );
  const pick = (blk, tag) => {
    const re = new RegExp(`<${tag}>([^\r\n<]+)`, 'i');
    const m = blk.match(re);
    return m ? m[1].trim() : '';
  };
  return blocks.map((b) => {
    const trntype = pick(b, 'TRNTYPE').toUpperCase();
    const dt = pick(b, 'DTPOSTED');
    const y = dt.slice(0, 4),
      mo = dt.slice(4, 6),
      d = dt.slice(6, 8);
    const posted_date = `${y}-${mo}-${d}`;
    const amount = parseFloat(pick(b, 'TRNAMT')) || 0;
    const fitid = pick(b, 'FITID');
    const name = pick(b, 'NAME');
    const memo = pick(b, 'MEMO');
    return {
      trn_type: trntype.includes('CREDIT') ? 'CREDIT' : 'DEBIT',
      posted_date,
      amount,
      fitid,
      name,
      memo,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (val) =>
  Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const today = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const PLUGGY_ITEMS_KEY = (cnpj) => `pluggy_items_${cnpj}`;

function loadStoredItems(cnpj) {
  try {
    const raw = localStorage.getItem(PLUGGY_ITEMS_KEY(cnpj));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredItems(cnpj, items) {
  localStorage.setItem(PLUGGY_ITEMS_KEY(cnpj), JSON.stringify(items));
}

function statusColor(status) {
  if (!status) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  const s = status.toUpperCase();
  if (s === 'UPDATED') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (s === 'UPDATING') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  if (s === 'LOGIN_ERROR' || s === 'ERROR')
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (s === 'WAITING_USER_INPUT')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

// ---------------------------------------------------------------------------
// Auto-match helper (same logic as original, extracted to be reused)
// ---------------------------------------------------------------------------
async function runAutoMatch(created, bankAccountId) {
  const openReceiv = await AccountsReceivable.filter(
    { status: 'aberto' },
    '-created_date',
    500
  );
  const openPay = await AccountsPayable.filter(
    { status: 'aberto' },
    '-created_at',
    500
  );
  const updates = [];
  for (const tx of created) {
    if (tx.trn_type === 'CREDIT') {
      const match = openReceiv.find(
        (r) =>
          Math.abs((r.open_amount || r.face_value || 0) - Math.abs(tx.amount)) <
          0.01
      );
      if (match) {
        await BankTransaction.update(tx.id, {
          matched_entity: 'receivable',
          matched_id: match.id,
        });
        await AccountsReceivable.update(match.id, {
          status: 'pago',
          paid_amount: match.face_value,
          open_amount: 0,
          payment_date: tx.posted_date,
          bank_account_id: bankAccountId,
        });
        updates.push({ tx, match });
      }
    } else {
      const match = openPay.find(
        (p) =>
          Math.abs((p.open_amount || p.face_value || 0) - Math.abs(tx.amount)) <
          0.01
      );
      if (match) {
        await BankTransaction.update(tx.id, {
          matched_entity: 'payable',
          matched_id: match.id,
        });
        await AccountsPayable.update(match.id, {
          status: 'pago',
          paid_amount: match.face_value,
          open_amount: 0,
          payment_date: tx.posted_date,
          bank_account_id: bankAccountId,
        });
        updates.push({ tx, match });
      }
    }
  }
  return updates;
}

// ---------------------------------------------------------------------------
// Balance recalc helper
// ---------------------------------------------------------------------------
async function recalcBalance(bankAccountId, bankAccounts, setBankAccounts) {
  const acc = bankAccounts.find((a) => a.id === bankAccountId);
  if (!acc) return;
  const txsAcc = await BankTransaction.filter(
    { bank_account_id: bankAccountId },
    '-created_at',
    5000
  );
  const net = txsAcc.reduce((s, t) => s + Number(t.amount || 0), 0);
  const newBal = Number(acc.initial_balance || 0) + net;
  await BankAccount.update(acc.id, { current_balance: newBal });
  const refreshed = await BankAccount.list('-updated_at', 200);
  setBankAccounts(refreshed);
}

// ===========================================================================
// Main component
// ===========================================================================
export default function BankReconciliation() {
  // ── shared state ──────────────────────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState([]);
  const [me, setMe] = useState(null);

  // ── Manual tab state ──────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');

  // ── Open Finance tab state ────────────────────────────────────────────────
  const [connectedItems, setConnectedItems] = useState([]); // [{itemId, connectedAt, label, status, institution}]
  const [allPluggyAccounts, setAllPluggyAccounts] = useState([]); // [{...account, itemId}]
  const [selectedPluggyAccountId, setSelectedPluggyAccountId] = useState('');
  const [selectedLocalBankId, setSelectedLocalBankId] = useState('');
  const [ofImporting, setOfImporting] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // {imported, matched, skipped}
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [ofError, setOfError] = useState('');
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [b, user] = await Promise.all([
        BankAccount.list('-updated_at', 200),
        User.me(),
      ]);
      setBankAccounts(b);
      setMe(user);
    })();
  }, []);

  // Load persisted Pluggy items and fetch their current status
  useEffect(() => {
    if (!me?.cnpj) return;
    const stored = loadStoredItems(me.cnpj);
    setConnectedItems(stored);
    if (stored.length === 0) return;
    // Refresh statuses silently
    (async () => {
      const updated = await Promise.all(
        stored.map(async (entry) => {
          try {
            const item = await getItem(entry.itemId);
            const accounts = await getAccounts(entry.itemId);
            return {
              ...entry,
              status: item?.status,
              institution: item?.connector?.name || entry.label,
              accounts: accounts || [],
            };
          } catch {
            return { ...entry, status: 'ERROR', accounts: [] };
          }
        })
      );
      setConnectedItems(updated);
      const flat = updated.flatMap((e) =>
        (e.accounts || []).map((a) => ({ ...a, itemId: e.itemId }))
      );
      setAllPluggyAccounts(flat);
    })();
  }, [me]);

  const totalBalance = bankAccounts.reduce(
    (s, b) => s + Number(b.current_balance || 0),
    0
  );

  // ── Manual import handler (original logic, unchanged) ─────────────────────
  const handleImport = async () => {
    if (!file || !selectedAccount) return;
    setImporting(true);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let txs = [];
      if (ext === 'ofx') {
        const text = await file.text();
        txs = parseOfx(text);
      } else if (ext === 'pdf') {
        const { file_url } = await UploadFile({ file });
        const schema = {
          type: 'object',
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  description: { type: 'string' },
                  amount: { type: 'number' },
                  type: { type: 'string' },
                },
              },
            },
          },
        };
        const res = await ExtractDataFromUploadedFile({
          file_url,
          json_schema: schema,
        });
        txs = (res.output?.transactions || []).map((it) => ({
          posted_date: (it.date || '').slice(0, 10),
          name: it.description || '',
          memo: it.description || '',
          amount: Number(it.amount) || 0,
          trn_type: String(it.type || '')
            .toUpperCase()
            .includes('CRED')
            ? 'CREDIT'
            : 'DEBIT',
        }));
      } else {
        alert('Formato não suportado. Use OFX ou PDF.');
        setImporting(false);
        return;
      }

      const batchId = `${ext.toUpperCase()}-${Date.now()}`;
      const rows = txs.map((t) => ({
        ...t,
        bank_account_id: selectedAccount,
        cnpj: me?.cnpj,
        import_batch_id: batchId,
      }));
      const created = await BankTransaction.bulkCreate(rows);
      const updates = await runAutoMatch(created, selectedAccount);
      await recalcBalance(selectedAccount, bankAccounts, setBankAccounts);
      setResult(updates);
    } finally {
      setImporting(false);
    }
  };

  // ── Open Finance: connect bank ────────────────────────────────────────────
  const handleConnectBank = useCallback(async () => {
    setOfError('');
    setWidgetLoading(true);
    try {
      await loadPluggyWidget();
      const { accessToken: connectToken } = await getConnectToken();
      openPluggyWidget({
        connectToken,
        onSuccess: async (item) => {
          setWidgetLoading(false);
          const itemId = item?.id || item?.itemId;
          if (!itemId) return;
          const connectedAt = new Date().toISOString();
          // Fetch item details
          let itemDetails = {};
          let accounts = [];
          try {
            itemDetails = await getItem(itemId);
            accounts = (await getAccounts(itemId)) || [];
          } catch {
            // best effort
          }
          const entry = {
            itemId,
            connectedAt,
            label: itemDetails?.connector?.name || `Banco ${itemId.slice(0, 8)}`,
            status: itemDetails?.status,
            institution: itemDetails?.connector?.name,
            accounts,
          };
          setConnectedItems((prev) => {
            const next = [...prev.filter((e) => e.itemId !== itemId), entry];
            if (me?.cnpj) saveStoredItems(me.cnpj, next);
            return next;
          });
          setAllPluggyAccounts((prev) => {
            const withoutItem = prev.filter((a) => a.itemId !== itemId);
            return [
              ...withoutItem,
              ...accounts.map((a) => ({ ...a, itemId })),
            ];
          });
        },
        onError: (err) => {
          setWidgetLoading(false);
          setOfError(
            err?.message ||
              'Erro ao conectar com o banco. Tente novamente.'
          );
        },
        onClose: () => {
          setWidgetLoading(false);
        },
      });
    } catch (err) {
      setWidgetLoading(false);
      setOfError(
        err?.message || 'Não foi possível carregar o widget Pluggy.'
      );
    }
  }, [me]);

  // ── Open Finance: sync item ───────────────────────────────────────────────
  const handleSync = useCallback(
    async (entry) => {
      setOfError('');
      try {
        const [itemDetails, accounts] = await Promise.all([
          getItem(entry.itemId),
          getAccounts(entry.itemId),
        ]);
        const updated = {
          ...entry,
          status: itemDetails?.status,
          institution: itemDetails?.connector?.name || entry.label,
          accounts: accounts || [],
        };
        setConnectedItems((prev) => {
          const next = prev.map((e) =>
            e.itemId === entry.itemId ? updated : e
          );
          if (me?.cnpj) saveStoredItems(me.cnpj, next);
          return next;
        });
        setAllPluggyAccounts((prev) => {
          const withoutItem = prev.filter((a) => a.itemId !== entry.itemId);
          return [
            ...withoutItem,
            ...(accounts || []).map((a) => ({ ...a, itemId: entry.itemId })),
          ];
        });
      } catch (err) {
        setOfError(err?.message || 'Erro ao sincronizar conta.');
      }
    },
    [me]
  );

  // ── Open Finance: disconnect item ─────────────────────────────────────────
  const handleDisconnect = useCallback(
    async (itemId) => {
      if (!window.confirm('Desconectar este banco? Os dados já importados não serão afetados.')) return;
      setOfError('');
      try {
        await deleteItem(itemId);
      } catch {
        // ignore API errors on delete
      }
      setConnectedItems((prev) => {
        const next = prev.filter((e) => e.itemId !== itemId);
        if (me?.cnpj) saveStoredItems(me.cnpj, next);
        return next;
      });
      setAllPluggyAccounts((prev) => prev.filter((a) => a.itemId !== itemId));
    },
    [me]
  );

  // ── Open Finance: import transactions ─────────────────────────────────────
  const handleOfImport = async () => {
    if (!selectedPluggyAccountId || !selectedLocalBankId) return;
    setOfImporting(true);
    setSyncResult(null);
    setOfError('');
    try {
      const pluggyTxs = await getTransactions(
        selectedPluggyAccountId,
        dateFrom,
        dateTo
      );
      if (!pluggyTxs || pluggyTxs.length === 0) {
        setSyncResult({ imported: 0, matched: 0, skipped: 0 });
        setOfImporting(false);
        return;
      }

      // Check for already-imported fitids
      const existingTxs = await BankTransaction.filter(
        { bank_account_id: selectedLocalBankId },
        '-created_at',
        5000
      );
      const existingFitids = new Set(existingTxs.map((t) => t.fitid).filter(Boolean));

      const batchId = `OF-${Date.now()}`;
      const rows = pluggyTxs
        .filter((t) => !existingFitids.has(String(t.id)))
        .map((t) => ({
          posted_date: (t.date || '').slice(0, 10),
          amount:
            t.type === 'CREDIT'
              ? Math.abs(t.amount)
              : -Math.abs(t.amount),
          trn_type: t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
          name: t.description || '',
          memo: t.descriptionRaw || t.description || '',
          bank_account_id: selectedLocalBankId,
          fitid: String(t.id),
          cnpj: me?.cnpj,
          import_batch_id: batchId,
        }));

      const skipped = pluggyTxs.length - rows.length;
      if (rows.length === 0) {
        setSyncResult({ imported: 0, matched: 0, skipped });
        setOfImporting(false);
        return;
      }

      const created = await BankTransaction.bulkCreate(rows);
      const updates = await runAutoMatch(created, selectedLocalBankId);
      await recalcBalance(selectedLocalBankId, bankAccounts, setBankAccounts);

      setSyncResult({
        imported: created.length,
        matched: updates.length,
        skipped,
      });
    } catch (err) {
      setOfError(err?.message || 'Erro ao importar transações do Open Finance.');
    } finally {
      setOfImporting(false);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" /> Conciliação Bancária
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe extratos ou conecte via Open Finance para conciliação automática
          </p>
        </div>
      </div>

      {/* Account balance cards */}
      {bankAccounts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card border-border shadow-sm col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Saldo Total
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  totalBalance >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                R$ {fmt(totalBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {bankAccounts.length} contas
              </p>
            </CardContent>
          </Card>
          {bankAccounts.map((b) => (
            <Card
              key={b.id}
              className={`bg-card border-border shadow-sm ${
                b.id === selectedAccount ? 'ring-1 ring-primary' : ''
              }`}
            >
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  {b.bank_name}
                </p>
                <p
                  className={`text-lg font-bold mt-1 ${
                    Number(b.current_balance || 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  R$ {fmt(b.current_balance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {b.account_name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Conciliação Manual
          </TabsTrigger>
          <TabsTrigger value="openfinance" className="flex items-center gap-2">
            <Wifi className="w-4 h-4" /> Open Finance
          </TabsTrigger>
        </TabsList>

        {/* ================================================================== */}
        {/* TAB 1 — Conciliação Manual                                          */}
        {/* ================================================================== */}
        <TabsContent value="manual" className="space-y-6">
          {/* Import card */}
          <Card className="bg-card border-border border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <Upload className="w-5 h-5 text-blue-500" /> Importar Extrato
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-foreground">Conta Bancária</Label>
                  <Select
                    value={selectedAccount}
                    onValueChange={setSelectedAccount}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bank_name} • {b.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground">Extrato (OFX / PDF)</Label>
                  <Input
                    type="file"
                    accept=".ofx,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="bg-background border-border cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleImport}
                    disabled={!file || importing || !selectedAccount}
                    className="gap-2 w-full md:w-auto"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />{' '}
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> Importar e Conciliar
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {file && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Arquivo selecionado:{' '}
                  <span className="font-medium">{file.name}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Reconciliation results */}
          {result.length > 0 && (
            <Card className="bg-card border-border shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Conciliações Aplicadas
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs ml-1">
                    {result.length} {result.length === 1 ? 'match' : 'matches'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Tipo
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Data
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                          Valor
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Conciliado com
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.map((r, i) => (
                        <TableRow
                          key={i}
                          className="border-border hover:bg-muted/30 transition-colors"
                        >
                          <TableCell>
                            {r.tx.trn_type === 'CREDIT' ? (
                              <div className="flex items-center gap-1.5">
                                <ArrowUpCircle className="w-4 h-4 text-green-500" />
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
                                  Crédito
                                </Badge>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <ArrowDownCircle className="w-4 h-4 text-red-500" />
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
                                  Débito
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {r.tx.posted_date}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              r.tx.trn_type === 'CREDIT'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            R$ {fmt(Math.abs(r.tx.amount))}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm font-mono">
                            {r.match.document_number || r.match.id}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================== */}
        {/* TAB 2 — Open Finance                                                */}
        {/* ================================================================== */}
        <TabsContent value="openfinance" className="space-y-6">
          {/* Error banner */}
          {ofError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-red-700 dark:text-red-400">
                {ofError}
              </div>
              <button
                onClick={() => setOfError('')}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-lg leading-none"
              >
                ×
              </button>
            </div>
          )}

          {/* Section A: Contas Conectadas */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <Link2 className="w-5 h-5 text-primary" />
                  Contas Conectadas
                  {connectedItems.length > 0 && (
                    <Badge className="bg-primary/10 text-primary border-0 text-xs ml-1">
                      {connectedItems.length} banco
                      {connectedItems.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
                {connectedItems.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleConnectBank}
                    disabled={widgetLoading}
                    className="gap-1.5"
                  >
                    {widgetLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Conectar mais bancos
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {connectedItems.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-lg">
                      Conectar via Open Finance
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Acesse saldo e extrato diretamente do seu banco, com
                      segurança e sem compartilhar senhas.
                    </p>
                  </div>
                  <Button
                    onClick={handleConnectBank}
                    disabled={widgetLoading}
                    className="gap-2 mt-2"
                  >
                    {widgetLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />{' '}
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" /> Conectar banco
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* Connected items table */
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Banco
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Status
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Conectado em
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                          Contas
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {connectedItems.map((entry) => (
                        <TableRow
                          key={entry.itemId}
                          className="border-border hover:bg-muted/30 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-foreground text-sm">
                                {entry.institution || entry.label || entry.itemId.slice(0, 12)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`border-0 text-xs ${statusColor(entry.status)}`}>
                              {entry.status || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.connectedAt
                              ? new Date(entry.connectedAt).toLocaleDateString('pt-BR')
                              : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {(entry.accounts || []).length} conta
                            {(entry.accounts || []).length !== 1 ? 's' : ''}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSync(entry)}
                                className="gap-1.5 h-8 text-xs"
                              >
                                <RefreshCw className="w-3 h-3" /> Sincronizar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDisconnect(entry.itemId)}
                                className="gap-1.5 h-8 text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-3 h-3" /> Desconectar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pluggy accounts summary (sub-cards) */}
              {allPluggyAccounts.length > 0 && (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allPluggyAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="rounded-lg border border-border bg-muted/30 p-3 space-y-1"
                    >
                      <p className="text-xs font-semibold text-foreground truncate">
                        {acc.name || acc.number || acc.id}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {(acc.type || '').toLowerCase().replace('_', ' ')}
                      </p>
                      {acc.balance != null && (
                        <p
                          className={`text-sm font-bold ${
                            Number(acc.balance) >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          R$ {fmt(acc.balance)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B + C: Import — only when accounts are loaded */}
          {allPluggyAccounts.length > 0 && (
            <Card className="bg-card border-border border-l-4 border-l-primary shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <ArrowDownCircle className="w-5 h-5 text-primary" />
                  Importar Transações
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Section B: Pluggy account selector */}
                  <div className="space-y-1.5">
                    <Label className="text-foreground">Conta do banco (Open Finance)</Label>
                    <Select
                      value={selectedPluggyAccountId}
                      onValueChange={setSelectedPluggyAccountId}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {allPluggyAccounts.map((acc) => {
                          const item = connectedItems.find(
                            (i) => i.itemId === acc.itemId
                          );
                          return (
                            <SelectItem key={acc.id} value={acc.id}>
                              {item?.institution || item?.label || acc.itemId.slice(0, 8)} —{' '}
                              {acc.name || acc.number || acc.id}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Section C: Local bank account */}
                  <div className="space-y-1.5">
                    <Label className="text-foreground">Conta local para vincular</Label>
                    <Select
                      value={selectedLocalBankId}
                      onValueChange={setSelectedLocalBankId}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Selecione a conta local" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name} • {b.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-foreground">De</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground">Até</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                {/* Import button */}
                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    onClick={handleOfImport}
                    disabled={
                      ofImporting ||
                      !selectedPluggyAccountId ||
                      !selectedLocalBankId
                    }
                    className="gap-2"
                  >
                    {ofImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />{' '}
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> Importar transações
                      </>
                    )}
                  </Button>

                  {/* Result summary */}
                  {syncResult && (
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        {syncResult.imported} importadas
                      </span>
                      <span className="flex items-center gap-1 text-primary">
                        <Link2 className="w-4 h-4" />
                        {syncResult.matched} conciliadas
                      </span>
                      {syncResult.skipped > 0 && (
                        <span className="text-muted-foreground">
                          {syncResult.skipped} duplicatas ignoradas
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Powered by Pluggy */}
          <p className="text-xs text-muted-foreground text-center pb-2 flex items-center justify-center gap-1">
            <WifiOff className="w-3 h-3" />
            Powered by Pluggy — conexão segura via Open Finance
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
