import { useState, useEffect, useMemo } from "react";
import { AccountsReceivable } from "@/entities/AccountsReceivable";
import { AccountsPayable } from "@/entities/AccountsPayable";
import { BankAccount } from "@/entities/BankAccount";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  format,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachMonthOfInterval,
  eachWeekOfInterval,
  parseISO,
  isWithinInterval,
  differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

const fmtBRL = (value) =>
  (value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

const fmtBRLShort = (value) =>
  `R$ ${(value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const OPEN_STATUSES_RECEIVABLE = ["aberto", "parcial", "vencido"];
const OPEN_STATUSES_PAYABLE = ["aberto", "parcial", "vencido"];

function getPeriodRange(preset, customFrom, customTo) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case "last3m":
      return { from: addMonths(today, -3), to: today };
    case "current":
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case "next3m":
      return { from: today, to: addMonths(today, 3) };
    case "next6m":
      return { from: today, to: addMonths(today, 6) };
    case "custom":
      return {
        from: customFrom ? parseISO(customFrom) : today,
        to: customTo ? parseISO(customTo) : addMonths(today, 1),
      };
    default:
      return { from: today, to: addMonths(today, 3) };
  }
}

function buildMonthlyBuckets(from, to) {
  const months = eachMonthOfInterval({ start: startOfMonth(from), end: endOfMonth(to) });
  return months.map((m) => ({
    key: format(m, "yyyy-MM"),
    label: format(m, "MMM/yy", { locale: ptBR }),
    start: startOfMonth(m),
    end: endOfMonth(m),
    entries: [],
    exits: [],
  }));
}

function buildWeeklyBuckets(from, to) {
  const weeks = eachWeekOfInterval(
    { start: startOfWeek(from, { weekStartsOn: 1 }), end: endOfWeek(to, { weekStartsOn: 1 }) },
    { weekStartsOn: 1 }
  );
  return weeks.map((w) => {
    const wStart = startOfWeek(w, { weekStartsOn: 1 });
    const wEnd = endOfWeek(w, { weekStartsOn: 1 });
    return {
      key: format(wStart, "yyyy-ww"),
      label: `${format(wStart, "dd/MM")}–${format(wEnd, "dd/MM")}`,
      start: wStart,
      end: wEnd,
      entries: [],
      exits: [],
    };
  });
}

function assignToBuckets(buckets, receivables, payables) {
  const result = buckets.map((b) => ({ ...b, entries: [], exits: [] }));

  for (const rec of receivables) {
    if (!rec.due_date) continue;
    if (!OPEN_STATUSES_RECEIVABLE.includes(rec.status)) continue;
    const dt = parseISO(rec.due_date);
    const bucket = result.find((b) => isWithinInterval(dt, { start: b.start, end: b.end }));
    if (bucket) bucket.entries.push(rec);
  }

  for (const pay of payables) {
    if (!pay.due_date) continue;
    if (!OPEN_STATUSES_PAYABLE.includes(pay.status)) continue;
    const dt = parseISO(pay.due_date);
    const bucket = result.find((b) => isWithinInterval(dt, { start: b.start, end: b.end }));
    if (bucket) bucket.exits.push(pay);
  }

  return result;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{fmtBRLShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="bg-card border-border animate-pulse">
      <CardContent className="p-6">
        <div className="h-4 bg-muted rounded w-1/2 mb-3" />
        <div className="h-7 bg-muted rounded w-3/4" />
      </CardContent>
    </Card>
  );
}

export default function CashFlow() {
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState("next3m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [viewMode, setViewMode] = useState("monthly");
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [rec, pay, banks] = await Promise.all([
          AccountsReceivable.list("-due_date", 5000),
          AccountsPayable.list("-due_date", 5000),
          BankAccount.list("-updated_at", 100),
        ]);
        setReceivables(rec ?? []);
        setPayables(pay ?? []);
        setBankAccounts(banks ?? []);
      } catch (e) {
        console.error("CashFlow load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const { from, to } = useMemo(
    () => getPeriodRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const buckets = useMemo(() => {
    const raw =
      viewMode === "monthly"
        ? buildMonthlyBuckets(from, to)
        : buildWeeklyBuckets(from, to);
    return assignToBuckets(raw, receivables, payables);
  }, [from, to, viewMode, receivables, payables]);

  const bankBalance = useMemo(
    () => bankAccounts.reduce((s, b) => s + (b.current_balance ?? 0), 0),
    [bankAccounts]
  );

  const totalEntradas = useMemo(
    () =>
      buckets.reduce(
        (s, b) => s + b.entries.reduce((ss, r) => ss + (r.open_amount ?? r.face_value ?? 0), 0),
        0
      ),
    [buckets]
  );

  const totalSaidas = useMemo(
    () =>
      buckets.reduce(
        (s, b) => s + b.exits.reduce((ss, p) => ss + (p.open_amount ?? p.face_value ?? 0), 0),
        0
      ),
    [buckets]
  );

  const saldoProjetado = bankBalance + totalEntradas - totalSaidas;

  const chartData = useMemo(() => {
    let running = bankBalance;
    return buckets.map((b) => {
      const entradas = b.entries.reduce((s, r) => s + (r.open_amount ?? r.face_value ?? 0), 0);
      const saidas = b.exits.reduce((s, p) => s + (p.open_amount ?? p.face_value ?? 0), 0);
      running = running + entradas - saidas;
      return {
        label: b.label,
        Entradas: entradas,
        Saídas: saidas,
        "Saldo Projetado": running,
      };
    });
  }, [buckets, bankBalance]);

  const today = new Date();
  const next7 = addDays(today, 7);
  const alertsReceivable = receivables.filter((r) => {
    if (!r.due_date || !OPEN_STATUSES_RECEIVABLE.includes(r.status)) return false;
    const dt = parseISO(r.due_date);
    return isWithinInterval(dt, { start: today, end: next7 });
  });
  const alertsPayable = payables.filter((p) => {
    if (!p.due_date || !OPEN_STATUSES_PAYABLE.includes(p.status)) return false;
    const dt = parseISO(p.due_date);
    return isWithinInterval(dt, { start: today, end: next7 });
  });

  const toggleRow = (key) =>
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));

  const tableRows = useMemo(() => {
    let running = bankBalance;
    return buckets.map((b) => {
      const entradas = b.entries.reduce((s, r) => s + (r.open_amount ?? r.face_value ?? 0), 0);
      const saidas = b.exits.reduce((s, p) => s + (p.open_amount ?? p.face_value ?? 0), 0);
      const saldoPeriodo = entradas - saidas;
      running += saldoPeriodo;
      return { ...b, entradas, saidas, saldoPeriodo, saldoAcumulado: running };
    });
  }, [buckets, bankBalance]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
              <p className="text-sm text-muted-foreground">Projeção e análise de entradas e saídas</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Período</label>
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger className="w-44 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last3m">Últimos 3 meses</SelectItem>
                    <SelectItem value="current">Mês atual</SelectItem>
                    <SelectItem value="next3m">Próximos 3 meses</SelectItem>
                    <SelectItem value="next6m">Próximos 6 meses</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preset === "custom" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">De</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Até</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visualização</label>
                <div className="flex h-9 rounded-md border border-border overflow-hidden">
                  <button
                    onClick={() => setViewMode("monthly")}
                    className={`px-4 text-sm font-medium transition-colors ${
                      viewMode === "monthly"
                        ? "bg-blue-500 text-white"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setViewMode("weekly")}
                    className={`px-4 text-sm font-medium transition-colors border-l border-border ${
                      viewMode === "weekly"
                        ? "bg-blue-500 text-white"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Semanal
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Saldo Bancário */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Saldo Bancário Atual
                    </p>
                    <p className="text-2xl font-bold text-blue-500">{fmtBRL(bankBalance)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bankAccounts.length} conta{bankAccounts.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
                <div className="h-1 bg-blue-500 w-full" />
              </CardContent>
            </Card>

            {/* Total Entradas */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Total Entradas Previstas
                    </p>
                    <p className="text-2xl font-bold text-emerald-500">{fmtBRL(totalEntradas)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {receivables.filter((r) => OPEN_STATUSES_RECEIVABLE.includes(r.status)).length} recebíveis em aberto
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
                <div className="h-1 bg-emerald-500 w-full" />
              </CardContent>
            </Card>

            {/* Total Saídas */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Total Saídas Previstas
                    </p>
                    <p className="text-2xl font-bold text-red-500">{fmtBRL(totalSaidas)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {payables.filter((p) => OPEN_STATUSES_PAYABLE.includes(p.status)).length} pagamentos em aberto
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <ArrowDownCircle className="w-5 h-5 text-red-500" />
                  </div>
                </div>
                <div className="h-1 bg-red-500 w-full" />
              </CardContent>
            </Card>

            {/* Saldo Projetado */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Saldo Projetado
                    </p>
                    <p className={`text-2xl font-bold ${saldoProjetado >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {fmtBRL(saldoProjetado)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Ao final do período</p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${saldoProjetado >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                    {saldoProjetado >= 0
                      ? <TrendingUp className="w-5 h-5 text-emerald-500" />
                      : <TrendingDown className="w-5 h-5 text-red-500" />
                    }
                  </div>
                </div>
                <div className={`h-1 w-full ${saldoProjetado >= 0 ? "bg-emerald-500" : "bg-red-500"}`} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts */}
        {!loading && (alertsReceivable.length > 0 || alertsPayable.length > 0) && (
          <Card className="bg-card border-amber-500/30 border">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground mb-2">
                    Vencimentos nos próximos 7 dias ({alertsReceivable.length + alertsPayable.length} item{alertsReceivable.length + alertsPayable.length !== 1 ? "s" : ""})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {alertsReceivable.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center gap-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-1">
                        <ArrowUpCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="text-foreground font-medium truncate max-w-[120px]">{r.customer_name ?? "—"}</span>
                        <span className="text-emerald-500 font-semibold shrink-0">{fmtBRL(r.open_amount ?? r.face_value ?? 0)}</span>
                        <span className="text-muted-foreground shrink-0">{r.due_date ? format(parseISO(r.due_date), "dd/MM") : ""}</span>
                      </div>
                    ))}
                    {alertsPayable.slice(0, 5).map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded-md px-2 py-1">
                        <ArrowDownCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="text-foreground font-medium truncate max-w-[120px]">{p.supplier_name ?? "—"}</span>
                        <span className="text-red-500 font-semibold shrink-0">{fmtBRL(p.open_amount ?? p.face_value ?? 0)}</span>
                        <span className="text-muted-foreground shrink-0">{p.due_date ? format(parseISO(p.due_date), "dd/MM") : ""}</span>
                      </div>
                    ))}
                    {alertsReceivable.length + alertsPayable.length > 10 && (
                      <span className="text-xs text-muted-foreground self-center">
                        +{alertsReceivable.length + alertsPayable.length - 10} mais
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Evolução do Fluxo de Caixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-72 bg-muted animate-pulse rounded-lg" />
            ) : chartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum dado encontrado para o período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    width={72}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
                  />
                  <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line
                    type="monotone"
                    dataKey="Saldo Projetado"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              Detalhamento por Período
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : tableRows.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                Nenhum dado para o período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-8" />
                      <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">Período</TableHead>
                      <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide text-right">Entradas</TableHead>
                      <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide text-right">Saídas</TableHead>
                      <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide text-right">Saldo Período</TableHead>
                      <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide text-right">Saldo Acumulado</TableHead>
                      <TableHead className="font-semibold text-muted-foreground text-xs uppercase tracking-wide text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((row) => {
                      const expanded = expandedRows[row.key];
                      const positive = row.saldoPeriodo >= 0;
                      const accPositive = row.saldoAcumulado >= 0;
                      return (
                        <>
                          <TableRow
                            key={row.key}
                            className="border-border cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleRow(row.key)}
                          >
                            <TableCell className="py-3 pr-0 pl-4">
                              {expanded
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              }
                            </TableCell>
                            <TableCell className="py-3 font-medium text-foreground">
                              {row.label}
                            </TableCell>
                            <TableCell className="py-3 text-right font-medium text-emerald-500">
                              {fmtBRL(row.entradas)}
                            </TableCell>
                            <TableCell className="py-3 text-right font-medium text-red-500">
                              {fmtBRL(row.saidas)}
                            </TableCell>
                            <TableCell className={`py-3 text-right font-semibold ${positive ? "text-emerald-500" : "text-red-500"}`}>
                              {fmtBRL(row.saldoPeriodo)}
                            </TableCell>
                            <TableCell className={`py-3 text-right font-bold ${accPositive ? "text-blue-500" : "text-red-500"}`}>
                              {fmtBRL(row.saldoAcumulado)}
                            </TableCell>
                            <TableCell className="py-3 text-center">
                              <Badge
                                variant="outline"
                                className={`text-xs font-semibold ${
                                  positive
                                    ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                                    : "border-red-500/40 text-red-500 bg-red-500/10"
                                }`}
                              >
                                {positive ? "Positivo" : "Negativo"}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {expanded && (
                            <TableRow key={`${row.key}-expanded`} className="border-border bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={7} className="p-0">
                                <div className="px-6 pb-4 pt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {/* Entradas */}
                                  <div>
                                    <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                      <ArrowUpCircle className="w-3.5 h-3.5" />
                                      Entradas ({row.entries.length})
                                    </p>
                                    {row.entries.length === 0 ? (
                                      <p className="text-xs text-muted-foreground italic">Nenhuma entrada neste período.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {row.entries.map((r) => (
                                          <div key={r.id} className="flex items-center justify-between text-xs rounded-md bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5">
                                            <span className="text-foreground font-medium truncate mr-2">{r.customer_name ?? "—"}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <span className="text-muted-foreground">{r.due_date ? format(parseISO(r.due_date), "dd/MM/yyyy") : ""}</span>
                                              <Badge variant="outline" className="text-[10px] border-amber-400/40 text-amber-400 bg-amber-400/10 capitalize">
                                                {r.status}
                                              </Badge>
                                              <span className="text-emerald-500 font-semibold">{fmtBRL(r.open_amount ?? r.face_value ?? 0)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Saídas */}
                                  <div>
                                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                      <ArrowDownCircle className="w-3.5 h-3.5" />
                                      Saídas ({row.exits.length})
                                    </p>
                                    {row.exits.length === 0 ? (
                                      <p className="text-xs text-muted-foreground italic">Nenhuma saída neste período.</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {row.exits.map((p) => (
                                          <div key={p.id} className="flex items-center justify-between text-xs rounded-md bg-red-500/5 border border-red-500/10 px-3 py-1.5">
                                            <span className="text-foreground font-medium truncate mr-2">{p.supplier_name ?? "—"}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                              {p.category && (
                                                <span className="text-muted-foreground text-[10px]">{p.category}</span>
                                              )}
                                              <span className="text-muted-foreground">{p.due_date ? format(parseISO(p.due_date), "dd/MM/yyyy") : ""}</span>
                                              <Badge variant="outline" className="text-[10px] border-amber-400/40 text-amber-400 bg-amber-400/10 capitalize">
                                                {p.status}
                                              </Badge>
                                              <span className="text-red-500 font-semibold">{fmtBRL(p.open_amount ?? p.face_value ?? 0)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer note */}
        {!loading && (
          <p className="text-xs text-muted-foreground text-center pb-4">
            * Projeção baseada em lançamentos com status <strong>aberto</strong>, <strong>parcial</strong> e <strong>vencido</strong>. Valores liquidados/pagos não são incluídos.
          </p>
        )}
      </div>
    </div>
  );
}
