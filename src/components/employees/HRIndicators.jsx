
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, LineChart as LineChartIcon, Calendar, Download, FileText } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, Legend } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, differenceInMonths, parseISO } from "date-fns";

function formatCurrencyBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toDateSafe(s) {
  if (!s) return null;
  try {
    // Employee dates are YYYY-MM-DD
    return parseISO(String(s));
  } catch {
    const dt = new Date(s);
    return isNaN(dt) ? null : dt;
  }
}

export default function HRIndicators({ employees = [], contracts = [], statusView = 'todos' }) {
  const [periodType, setPeriodType] = React.useState("mensal"); // mensal | trimestral | anual
  const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), "yyyy-MM"));
  const [activeTab, setActiveTab] = React.useState("turnover"); // turnover | desgaste

  const [chartView, setChartView] = React.useState("por_contrato"); // por_contrato | por_mes

  // NOVO: filtro por contrato
  const [selectedContract, setSelectedContract] = React.useState("all");

  // NOVO: excluir ferista (para índices mais realistas)
  // Substitui o estado inicial para considerar o status "ferista"
  const [excludeFerista, setExcludeFerista] = React.useState(statusView === 'ferista' ? false : true);

  // Se o usuário escolher a visão "Ferista", não faz sentido excluir feristas
  React.useEffect(() => {
    if (statusView === 'ferista') {
      setExcludeFerista(false);
    }
  }, [statusView]);

  const isFerista = (emp) => {
    if (emp?.is_ferista) return true; // considerar campo explícito
    const src = `${emp.role || ''} ${emp.observations || ''}`.toLowerCase();
    return src.includes('ferista');
  };

  const contractMap = React.useMemo(() => {
    const map = new Map();
    contracts.forEach(c => map.set(c.id, c.name));
    return map;
  }, [contracts]);

  // Ajuste: aplica filtro de contrato aos funcionários
  const filteredEmployees = React.useMemo(() => {
    return selectedContract === "all"
      ? employees
      : employees.filter(e => e.contract_id === selectedContract);
  }, [employees, selectedContract]);

  // NOVO: remover feristas dos cálculos quando marcado
  const employeesUsed = React.useMemo(() => {
    return excludeFerista ? filteredEmployees.filter(e => !isFerista(e)) : filteredEmployees;
  }, [filteredEmployees, excludeFerista]);

  const periodRange = React.useMemo(() => {
    // returns {start, end}
    const ref = selectedMonth ? startOfMonth(new Date(`${selectedMonth}-01`)) : startOfMonth(new Date());
    if (periodType === "mensal") {
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    }
    if (periodType === "trimestral") {
      const start = startOfMonth(subMonths(ref, 2));
      const end = endOfMonth(ref);
      return { start, end };
    }
    if (periodType === "anual") {
      const year = ref.getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      return { start, end };
    }
    return { start: startOfMonth(ref), end: endOfMonth(ref) };
  }, [periodType, selectedMonth]);

  const monthsInRange = React.useMemo(() => {
    // list of month keys within periodRange
    const out = [];
    let d = startOfMonth(periodRange.start);
    const end = startOfMonth(periodRange.end);
    while (d <= end) {
      out.push(monthKey(d));
      d = startOfMonth(addMonths(d, 1));
    }
    return out;
  }, [periodRange]);

  // Ajuste: usar employeesUsed no cálculo por contrato
  const indicatorsByContract = React.useMemo(() => {
    // compute per contract: admissions, dismissals, activeAtStart, turnover %, avgAttritionMonths
    const start = periodRange.start;
    const end = periodRange.end;

    // helpers
    const isBetween = (date, a, b) => date && date >= a && date <= b;

    // Initialize structure
    const result = new Map(); // contract_id -> metrics

    const ensureContract = (cid) => {
      if (!result.has(cid)) {
        result.set(cid, {
          contract_id: cid,
          admissions: 0,
          dismissals: 0,
          activeAtStart: 0,
          turnoverPercent: 0,
          avgAttritionMonths: 0,
          sumTenureMonths: 0,
        });
      }
      return result.get(cid);
    };

    // Pre-calc active at start per contract
    employeesUsed.forEach(emp => { // Changed from filteredEmployees to employeesUsed
      const cid = emp.contract_id;
      if (!cid) return;
      const adm = toDateSafe(emp.admission_date);
      const dism = toDateSafe(emp.dismissal_date);
      const wasActiveAtStart = adm && adm <= start && (!dism || dism >= start);
      if (wasActiveAtStart) {
        const rec = ensureContract(cid);
        rec.activeAtStart += 1;
      }
    });

    // Admissions and dismissals within period
    employeesUsed.forEach(emp => { // Changed from filteredEmployees to employeesUsed
      const cid = emp.contract_id;
      if (!cid) return;
      const adm = toDateSafe(emp.admission_date);
      const dism = toDateSafe(emp.dismissal_date);

      const rec = ensureContract(cid);
      if (isBetween(adm, start, end)) {
        rec.admissions += 1;
      }
      if (isBetween(dism, start, end)) {
        rec.dismissals += 1;
        // Tenure months for terminated
        if (adm && dism) {
          const months = Math.max(0, differenceInMonths(dism, adm));
          rec.sumTenureMonths += months;
        }
      }
    });

    // Finalize
    result.forEach((rec, cid) => {
      const denom = ((rec.activeAtStart + rec.admissions) / 2) || 0;
      rec.turnoverPercent = denom > 0 ? (rec.dismissals / denom) * 100 : 0;
      rec.avgAttritionMonths = rec.dismissals > 0 ? (rec.sumTenureMonths / rec.dismissals) : 0;
      // remove helper
      delete rec.sumTenureMonths;
    });

    return Array.from(result.values())
      .sort((a, b) => (contractMap.get(a.contract_id) || "").localeCompare(contractMap.get(b.contract_id) || ""));
  }, [employeesUsed, contractMap, periodRange]); // Changed dependency

  // Ajuste: usar employeesUsed no turnover por mês
  const turnoverByMonth = React.useMemo(() => {
    // Company-level turnover by month in range
    const out = [];
    monthsInRange.forEach(mk => {
      const base = startOfMonth(new Date(`${mk}-01`));
      const start = startOfMonth(base);
      const end = endOfMonth(base);

      // active at start (of that month)
      let activeAtStart = 0, admissions = 0, dismissals = 0;
      employeesUsed.forEach(emp => { // Changed from filteredEmployees to employeesUsed
        const adm = toDateSafe(emp.admission_date);
        const dism = toDateSafe(emp.dismissal_date);
        if (adm && adm <= start && (!dism || dism >= start)) activeAtStart += 1;
        if (adm && adm >= start && adm <= end) admissions += 1;
        if (dism && dism >= start && dism <= end) dismissals += 1;
      });
      const denom = ((activeAtStart + admissions) / 2) || 0;
      const t = denom > 0 ? (dismissals / denom) * 100 : 0;
      out.push({
        mes: format(base, "MMM/yy"),
        turnover: Number(t.toFixed(1)),
      });
    });
    return out;
  }, [employeesUsed, monthsInRange]); // Changed dependency

  const totalAdmissions = React.useMemo(() => indicatorsByContract.reduce((s, r) => s + r.admissions, 0), [indicatorsByContract]);
  const totalDismissals = React.useMemo(() => indicatorsByContract.reduce((s, r) => s + r.dismissals, 0), [indicatorsByContract]);

  const tableRows = React.useMemo(() => {
    return indicatorsByContract.map(r => ({
      contract: contractMap.get(r.contract_id) || "—",
      admissions: r.admissions,
      dismissals: r.dismissals,
      turnover: Number(r.turnoverPercent.toFixed(1)),
      desgaste: Number(r.avgAttritionMonths.toFixed(1)),
    }));
  }, [indicatorsByContract, contractMap]);

  const exportCSV = () => {
    const headers = ["Contrato", "Admissões", "Demissões", "Turnover (%)", "Desgaste Médio (meses)"];
    const lines = tableRows.map(r => [r.contract, r.admissions, r.dismissals, r.turnover, r.desgaste]);
    const csv = [headers.join(","), ...lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicadores_rh_${selectedMonth}_${periodType}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportHTML = () => {
    const periodLabel = periodType === 'mensal' ? format(new Date(`${selectedMonth}-01`), "MMMM 'de' yyyy") :
      periodType === 'trimestral' ? `Trimestre até ${format(new Date(`${selectedMonth}-01`), "MMMM 'de' yyyy")}` :
      `Ano ${selectedMonth?.slice(0, 4)}`;
    const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Indicadores de RH</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; }
          h1 { font-size: 22px; margin: 8px 0; }
          h2 { font-size: 16px; margin: 16px 0 8px; color: #374151; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; }
          th { background: #f9fafb; text-align: left; }
          .muted { color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>Indicadores de RH — ${periodLabel}</h1>
        <div class="muted">Turnover e Desgaste Médio por contrato</div>
        <h2>Tabela Resumo</h2>
        <table>
          <thead>
            <tr>
              <th>Contrato</th>
              <th>Admissões</th>
              <th>Demissões</th>
              <th>Turnover (%)</th>
              <th>Desgaste Médio (meses)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.map(r => `
              <tr>
                <td>${r.contract}</td>
                <td>${r.admissions}</td>
                <td>${r.dismissals}</td>
                <td>${r.turnover}</td>
                <td>${r.desgaste}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p class="muted">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
      </body>
      </html>
    `;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicadores_rh_${selectedMonth}_${periodType}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-white shadow-sm border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Indicadores de RH
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3"> {/* expanded grid */}
          <div className="flex flex-col">
            <span className="text-sm text-gray-700 mb-1">Visão</span>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-gray-700 mb-1">Mês referência</span>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <Input type="month" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)} className="pl-8" />
            </div>
          </div>

          {/* NOVO: filtro por contrato */}
          <div className="flex flex-col">
            <span className="text-sm text-gray-700 mb-1">Contrato</span>
            <Select value={selectedContract} onValueChange={setSelectedContract}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* NOVO: excluir ferista para índices realistas */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={excludeFerista}
                onChange={(e)=>setExcludeFerista(e.target.checked)}
                disabled={statusView === 'ferista'} // Disable if statusView is 'ferista'
              />
              Excluir ferista
            </label>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
            <Button variant="outline" onClick={exportHTML}>
              <FileText className="w-4 h-4 mr-2" /> Exportar HTML/PDF
            </Button>
          </div>
        </div>

        {/* KPIs Rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-800">Admissões</div>
            <div className="text-2xl font-bold text-blue-700 kpi-value">{totalAdmissions}</div>
          </div>
          <div className="p-4 bg-rose-50 rounded-lg">
            <div className="text-xs text-rose-800">Demissões</div>
            <div className="text-2xl font-bold text-rose-700 kpi-value">{totalDismissals}</div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg">
            <div className="text-xs text-emerald-800">Turnover Médio (%)</div>
            <div className="text-2xl font-bold text-emerald-700 kpi-value">
              {indicatorsByContract.length > 0
                ? (indicatorsByContract.reduce((s, r) => s + r.turnoverPercent, 0) / indicatorsByContract.length).toFixed(1)
                : "0.0"}
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg">
            <div className="text-xs text-amber-800">Desgaste Médio (meses)</div>
            <div className="text-2xl font-bold text-amber-700 kpi-value">
              {indicatorsByContract.length > 0
                ? (indicatorsByContract.reduce((s, r) => s + r.avgAttritionMonths, 0) / indicatorsByContract.length).toFixed(1)
                : "0.0"}
            </div>
          </div>
        </div>

        {/* Alternância de visualização do gráfico de Turnover */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 font-medium flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-gray-500" />
            Turnover
          </div>
          <Select value={chartView} onValueChange={setChartView}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Visão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="por_contrato">Por Contrato (colunas)</SelectItem>
              <SelectItem value="por_mes">Por Mês (linha)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {chartView === "por_contrato" ? (
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tableRows.map(r => ({ name: r.contract, turnover: r.turnover }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={50} />
                <YAxis unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="turnover" fill="#3B82F6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={turnoverByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="turnover" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de Desgaste por Contrato */}
        <div className="mt-4">
          <div className="text-sm text-gray-700 font-medium mb-2">Desgaste Médio por Contrato (meses)</div>
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tableRows.map(r => ({ name: r.contract, desgaste: r.desgaste }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={50} />
                <YAxis />
                <Tooltip formatter={(v) => `${v} meses`} />
                <Bar dataKey="desgaste" fill="#F59E0B" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabela comparativa */}
        <div className="bg-gray-50 border rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3">Contrato</th>
                <th className="text-right p-3">Admissões</th>
                <th className="text-right p-3">Demissões</th>
                <th className="text-right p-3">Turnover (%)</th>
                <th className="text-right p-3">Desgaste (meses)</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{r.contract}</td>
                  <td className="p-3 text-right">{r.admissions}</td>
                  <td className="p-3 text-right">{r.dismissals}</td>
                  <td className="p-3 text-right">{r.turnover.toFixed(1)}</td>
                  <td className="p-3 text-right">{r.desgaste.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
