import React, { useState, useEffect, useCallback } from "react";
import { Contract } from "@/entities/Contract";
import { Employee } from "@/entities/Employee";
import { FinancialEntry } from "@/entities/FinancialEntry";
import { Measurement } from "@/entities/Measurement";
import { IndirectCost } from "@/entities/IndirectCost";
import { User } from "@/entities/User";
import { AccountsReceivable } from "@/entities/AccountsReceivable";
import { Repactuacao } from "@/entities/Repactuacao";
import { DashboardPreference } from "@/entities/DashboardPreference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  TrendingUp, TrendingDown, FileText, Users, DollarSign,
  BarChart3, Calendar, AlertCircle, CheckCircle, Award, AlertTriangle, Shield, FileCheck,
  Columns3, Settings2, ClipboardCheck, Banknote
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from "recharts";
import { format, subMonths } from "date-fns";
import { pt } from "date-fns/locale";
import { Seguro } from "@/entities/Seguro";
import { Laudo } from "@/entities/Laudo";
import { generateOperationalAlerts } from "@/lib/alertsGenerator";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [kpis, setKpis] = useState({
    activeContracts: 0,
    monthlyRevenue: 0,
    activeEmployees: 0,
    netMargin: 0,
    netProfit: 0,
    totalCosts: 0
  });
  const [strategicKpis, setStrategicKpis] = useState({
    efficiencyIndex: 0,
    atRiskContracts: 0,
    topContracts: [],
    bottomContracts: [],
    averageMargin: 0 // New strategic KPI
  });
  const [chartData, setChartData] = useState({
    profitByContract: [],
    profitEvolution: [],
    contractsByService: [],
    topRevenue: [],
    costsDistribution: [],
    statusContractsData: [],
    rankingUnits: []
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contractAlerts, setContractAlerts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedView, setSelectedView] = useState("mensal"); // Kept for now, but will be replaced by periodType logic

  const [preferences, setPreferences] = useState({
    kpis: true, strategic: true, alerts: true, charts: true,
    costsDistribution: true, statusContracts: true, topRevenue: true, rankingUnits: true
  });
  const [userPrefId, setUserPrefId] = useState(null);

  // Filtros avançados
  const [periodType, setPeriodType] = useState("mensal"); // mensal | trimestral | anual | custom
  const [fromMonth, setFromMonth] = useState(""); // YYYY-MM (custom)
  const [contractFilter, setContractFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [allContracts, setAllContracts] = useState([]); // To populate the contract filter dropdown

  // KPIs adicionais
  const [extraKpis, setExtraKpis] = useState({
    monthlyContractRevenue: 0,
    pendingRepacts: 0,
    delayedRepacts: 0, // New KPI
    openMeasurements: 0,
    expiringInspections: 0,
    receivablesOpen: 0,
    probationEmployees: 0
  });

  const computePeriodMonths = useCallback(() => {
    const ref = selectedMonth || format(new Date(), 'yyyy-MM');
    const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (periodType === "mensal") return [ref];

    if (periodType === "trimestral") {
      const base = new Date(ref + "-01");
      const months = [];
      for (let i = 2; i >= 0; i--) {
        const d = subMonths(base, i);
        months.push(mk(d));
      }
      return months;
    }

    if (periodType === "anual") {
      const y = ref.slice(0, 4);
      return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
    }

    if (periodType === "custom" && fromMonth && selectedMonth) {
      const [sy, sm] = fromMonth.split('-').map(Number);
      const [ey, em] = selectedMonth.split('-').map(Number);
      const out = [];
      let d = new Date(sy, sm - 1, 1);
      const endDate = new Date(ey, em - 1, 1);
      while (d.getFullYear() < endDate.getFullYear() || (d.getFullYear() === endDate.getFullYear() && d.getMonth() <= endDate.getMonth())) {
        out.push(mk(d));
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
      return out;
    }

    return [ref];
  }, [selectedMonth, periodType, fromMonth]);

  const getEndDate = (c) => {
    if (c.end_date) return new Date(c.end_date);
    if (c.start_date && typeof c.duration_months === 'number') {
      const d = new Date(c.start_date);
      d.setMonth(d.getMonth() + c.duration_months);
      return d;
    }
    return null;
  };

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [contracts, employees, financialEntries, measurements, indirectCosts, receivables, repacts, seguros, laudos] = await Promise.all([
        Contract.filter({ cnpj: currentUser.cnpj }),
        Employee.filter({ cnpj: currentUser.cnpj }),
        FinancialEntry.filter({ cnpj: currentUser.cnpj }),
        Measurement.filter({ cnpj: currentUser.cnpj }),
        IndirectCost.filter({ cnpj: currentUser.cnpj }),
        AccountsReceivable.filter({ cnpj: currentUser.cnpj }),
        Repactuacao.filter({ cnpj: currentUser.cnpj }),
        Seguro.filter({ cnpj: currentUser.cnpj }),
        Laudo.filter({ cnpj: currentUser.cnpj })
      ]);

      setAllContracts(contracts); // Save for filter dropdown

      // Aplicar filtros por contrato/unidade/responsável (nas coleções relevantes)
      const filteredContracts = contracts.filter(c => {
        const contractMatch = contractFilter === "all" || c.id === contractFilter;
        const unitMatch = unitFilter === "all" || (c.unidade || "").toLowerCase() === unitFilter.toLowerCase();
        const respMatch = responsibleFilter === "all" || (c.apoio_administrativo || "").toLowerCase() === responsibleFilter.toLowerCase();
        return contractMatch && unitMatch && respMatch;
      });

      const contractIdsFilter = new Set(filteredContracts.map(c => c.id));
      const filteredEntries = financialEntries.filter(e => contractFilter === "all" || contractIdsFilter.has(e.contract_id));
      const filteredMeasurements = measurements.filter(m => contractFilter === "all" || contractIdsFilter.has(m.contract_id));

      // Meses do período
      const months = computePeriodMonths();
      const inPeriod = (entry) => entry.reference_month && months.includes(entry.reference_month);

      // Entradas do período (financeiro)
      const periodEntries = filteredEntries.filter(inPeriod);
      const periodRevenue = periodEntries.reduce((sum, e) => sum + (e.net_revenue || 0), 0);

      // FINAL RESULT vindo do Financeiro (fallback para net_revenue - total_costs se não existir)
      const sumFinalResultPeriod = periodEntries.reduce((s, e) => {
        const fr = e.final_result != null ? e.final_result : ((e.net_revenue || 0) - (e.total_costs || 0));
        return s + fr;
      }, 0);

      // Ano de referência
      const refYear = (selectedMonth || format(new Date(), 'yyyy-MM')).slice(0, 4);

      // Custos indiretos no período
      const indirectInPeriod = indirectCosts.filter(cost => {
        const rm = cost.reference_month || "";
        if (periodType === "anual") return rm.startsWith(`${refYear}-`);
        return months.includes(rm);
      });
      const periodIndirectCosts = indirectInPeriod.reduce((s, c) => s + (c.monthly_value || 0), 0);

      // KPIs principais (lucro líquido REAL = soma dos final_result - indiretos)
      const activeContracts = filteredContracts.filter(c => c.status === 'ativo');
      const activeEmployeesCount = employees.filter(e => e.status === 'ativo').length;
      const netProfit = sumFinalResultPeriod - periodIndirectCosts;

      setKpis({
        activeContracts: activeContracts.length,
        monthlyRevenue: periodRevenue,
        activeEmployees: activeEmployeesCount,
        netMargin: periodRevenue > 0 ? (netProfit / periodRevenue * 100) : 0,
        netProfit,
        totalCosts: (periodRevenue - sumFinalResultPeriod) + periodIndirectCosts // diretos já embutidos no final_result
      });

      // Faturamento mensal via contratos (valor mensal dos ativos)
      const monthlyContractRevenue = activeContracts.reduce((s, c) => s + (c.monthly_value || 0), 0);

      // Repactuações pendentes e atrasadas
      const today = new Date();
      const pendingRepactsList = repacts.filter(r =>
        filteredContracts.some(c => c.id === r.contract_id) &&
        (r.status_licitacao === 'solicitada' || r.status_cobranca === 'em_analise')
      );
      const delayedRepacts = pendingRepactsList.filter(r => r.data_solicitacao && (today.getTime() - new Date(r.data_solicitacao).getTime()) / (1000 * 60 * 60 * 24) > 30);


      // Medições em aberto (em análise/não enviadas mapeadas)
      const openMeasurements = filteredMeasurements.filter(m =>
        (m.status !== 'Aprovada') && (m.approval_status === 'pendente')
      ).length;

      // Seguros e Laudos a vencer (< 30 dias)
      const in30 = new Date(); in30.setDate(today.getDate() + 30);
      const expiringSeguros = seguros.filter(s => s.termino_vigencia && new Date(s.termino_vigencia) >= today && new Date(s.termino_vigencia) <= in30);
      const expiringLaudos = laudos.filter(l => l.validade && new Date(l.validade) >= today && new Date(l.validade) <= in30);
      const expiringInspections = expiringSeguros.length + expiringLaudos.length;

      // Contas a Receber (em aberto no período)
      const receivablesInPeriod = receivables.filter(r => {
        const m = (r.due_date || "").slice(0, 7);
        const inM = months.includes(m);
        return inM && (r.status === 'aberto' || r.status === 'vencido');
      });
      const receivablesOpen = receivablesInPeriod.reduce((s, r) => {
        const open = (r.open_amount != null ? r.open_amount : ((r.face_value || 0) - (r.paid_amount || 0)));
        return s + (open || 0);
      }, 0);

      // Funcionários em experiência (<=90 dias da admissão)
      const probationEmployees = employees.filter(e => {
        if (e.status !== 'ativo' || !e.admission_date) return false;
        const ad = new Date(e.admission_date);
        const days = Math.floor((today.getTime() - ad.getTime()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 90;
      }).length;

      setExtraKpis({
        monthlyContractRevenue,
        pendingRepacts: pendingRepactsList.length,
        openMeasurements,
        expiringInspections,
        receivablesOpen,
        probationEmployees,
        delayedRepacts: delayedRepacts.length
      });

      // Lucro líquido por contrato com rateio dos indiretos (for main KPIs and evolution)
      const byContractRevenueMap = {};
      const byContractFinalResultMap = {}; // This will serve as the 'unallocated' profit per contract, for ranking/chart
      activeContracts.forEach(c => { byContractRevenueMap[c.id] = 0; byContractFinalResultMap[c.id] = 0; });

      periodEntries.forEach(e => {
        if (byContractRevenueMap[e.contract_id] !== undefined) {
          byContractRevenueMap[e.contract_id] += e.net_revenue || 0;
          const fr = e.final_result != null ? e.final_result : ((e.net_revenue || 0) - (e.total_costs || 0));
          byContractFinalResultMap[e.contract_id] += fr;
        }
      });
      const totalRevenueForAllocation = Object.values(byContractRevenueMap).reduce((a, b) => a + b, 0);

      const byContractNetProfit = {}; // This one includes indirect allocation
      activeContracts.forEach(c => {
        const fr = byContractFinalResultMap[c.id] || 0;
        const rev = byContractRevenueMap[c.id] || 0;
        const indShare = totalRevenueForAllocation > 0 ? periodIndirectCosts * (rev / totalRevenueForAllocation) : 0;
        byContractNetProfit[c.id] = fr - indShare;
      });

      // Índice de eficiência
      const periodMeasurements = filteredMeasurements.filter(m => {
        const mm = m.measurement_month || "";
        if (periodType === "anual") return mm.startsWith(`${refYear}-`);
        return months.includes(mm);
      });
      const expectedMeasurements = periodMeasurements.length > 0 ? periodMeasurements.length : activeContracts.length;
      const onTimeMeasurements = periodMeasurements.filter(m =>
        m.status === 'Aprovada' && m.updated_date && m.due_date && new Date(m.updated_date) <= new Date(m.due_date)
      ).length;
      const efficiencyIndex = expectedMeasurements > 0 ? (onTimeMeasurements / expectedMeasurements) * 100 : 100;

      // Top/Bottom 5 por lucro líquido (usando resultado financeiro direto, sem rateio de indiretos)
      const contractSummaries = filteredContracts
        .filter(c => c.status === 'ativo') // considerar apenas ativos no ranking
        .map(c => {
          const rev = byContractRevenueMap[c.id] || 0;
          const profit = byContractFinalResultMap[c.id] || 0; // Usa resultado direto do financeiro
          const margin = rev > 0 ? (profit / rev) * 100 : 0;
          return { id: c.id, name: c.name || 'Contrato', profit, margin };
        })
        .sort((a, b) => b.profit - a.profit);

      const atRiskContracts = contractSummaries.filter(c => c.profit < 0).length;
      const topContracts = contractSummaries.slice(0, 5);
      const bottomContracts = contractSummaries.slice(-5).reverse();

      // Margem média ponderada por receita (usando resultado financeiro direto, sem rateio de indiretos)
      const totalRevActive = Object.values(byContractRevenueMap).reduce((s, val) => s + val, 0);
      const totalProfitActive = Object.values(byContractFinalResultMap).reduce((s, val) => s + val, 0); // Usa resultado direto do financeiro
      const averageMargin = totalRevActive > 0 ? (totalProfitActive / totalRevActive) * 100 : 0;

      setStrategicKpis(prev => ({
        ...prev, // Keep efficiencyIndex
        atRiskContracts,
        topContracts,
        bottomContracts,
        averageMargin
      }));

      // Gráfico: Lucro por Contrato (Acumulado) (usando resultado financeiro direto, sem rateio de indiretos)
      const profitByContract = filteredContracts
        .filter(c => c.status === 'ativo')
        .slice(0, 6)
        .map(contract => {
          const contractProfit = byContractFinalResultMap[contract.id] || 0; // Usa resultado direto do financeiro
          return {
            name: contract.name?.substring(0, 15) + (contract.name && contract.name.length > 15 ? "..." : ""),
            lucro: contractProfit
          };
        });

      // Evolução de Receita e Lucro (usando final_result mensal - rateio mensal dos indiretos)
      const totalPeriodRevenue = periodEntries.reduce((sum, e) => sum + (e.net_revenue || 0), 0); // Re-calculate for allocation basis

      const profitEvolution = months.map(m => {
        const monthEntries = filteredEntries.filter(entry => entry.reference_month === m);
        const monthRevenue = monthEntries.reduce((s, e) => s + (e.net_revenue || 0), 0);
        const monthFinalResult = monthEntries.reduce((s, e) => {
          const fr = e.final_result != null ? e.final_result : ((e.net_revenue || 0) - (e.total_costs || 0));
          return s + fr;
        }, 0);
        const monthAllocatedIndirectCost = totalPeriodRevenue > 0 ? periodIndirectCosts * (monthRevenue / totalPeriodRevenue) : 0;

        const monthProfit = monthFinalResult - monthAllocatedIndirectCost;
        const date = new Date(m + "-01");
        return { mes: format(date, 'MMM', { locale: pt }), receita: monthRevenue, lucro: monthProfit };
      });

      // Top 5 receita (barra horizontal) - now by contract's monthly_value
      const topRevenue = activeContracts
        .map(c => ({ id: c.id, contrato: c.name || 'Contrato Desconhecido', receita: c.monthly_value || 0 }))
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 5);

      // Distribuição de custos (inclui Indiretos explicitamente)
      const sum = periodEntries.reduce((acc, e) => {
        acc.rh += (e.payroll_cost || 0) + (e.social_charges_cost || 0) + (e.meal_allowance_cost || 0) + (e.transport_allowance_cost || 0);
        acc.materiais += (e.cleaning_products || 0) + (e.equipment_tools || 0) + (e.uniforms_epis || 0) + (e.disposable_materials || 0) + (e.other_materials || 0);
        const impostos = (e.inss_value || 0) + (e.irrf_value || 0) + (e.iss_value || 0) + (e.pis_value || 0) + (e.cofins_value || 0) + (e.csll_value || 0);
        acc.impostos += impostos + (e.linked_account_value || 0);
        acc.outros += (e.other_costs || 0);
        return acc;
      }, { rh: 0, materiais: 0, impostos: 0, outros: 0 });
      const costsDistribution = [
        { name: 'RH', value: sum.rh },
        { name: 'Materiais', value: sum.materiais },
        { name: 'Impostos/Retenções', value: sum.impostos },
        { name: 'Indiretos', value: periodIndirectCosts }, // Explicitly add indirect costs
        { name: 'Outros', value: sum.outros },
      ].filter(item => item.value > 0); // Only show categories with value > 0

      // Status dos contratos
      const thirty = new Date(); thirty.setDate(thirty.getDate() + 30);
      const statusAgg = { ativos: 0, vencendo: 0, encerrados: 0 };
      filteredContracts.forEach(c => {
        const end = getEndDate(c);
        if (c.status === 'ativo') {
          if (end && end <= thirty && end >= today) statusAgg.vencendo++;
          else statusAgg.ativos++;
        } else {
          statusAgg.encerrados++;
        }
      });
      const statusContractsData = [
        { name: 'Ativos', value: statusAgg.ativos },
        { name: 'Vencendo', value: statusAgg.vencendo },
        { name: 'Encerrados', value: statusAgg.encerrados },
      ];

      // Ranking por unidade (lucro líquido - usando resultado financeiro direto, sem rateio de indiretos)
      const unitMap = {};
      activeContracts.forEach(c => {
        const net = byContractFinalResultMap[c.id] || 0; // Usa resultado direto do financeiro
        const unit = c.unidade || 'Sem unidade';
        unitMap[unit] = (unitMap[unit] || 0) + net;
      });
      const rankingUnits = Object.keys(unitMap).map(u => ({ unidade: u, lucro: unitMap[u] }))
        .sort((a, b) => b.lucro - a.lucro).slice(0, 10);

      // Contratos por serviço
      const serviceTypes = {};
      activeContracts.forEach(contract => {
        const type = contract.service_type || 'outros';
        serviceTypes[type] = (serviceTypes[type] || 0) + 1;
      });
      const contractsByService = Object.entries(serviceTypes).map(([type, count]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: count
      }));

      setChartData(prev => ({
        ...prev,
        profitByContract,
        profitEvolution,
        contractsByService,
        topRevenue,
        costsDistribution,
        statusContractsData,
        rankingUnits
      }));

      // Alertas de contratos
      const expiringContracts = filteredContracts.filter(c => {
        const end = getEndDate(c);
        return end && end <= thirty && end >= today;
      });
      setContractAlerts(expiringContracts);

      // Gerar alertas inteligentes (contratos em camadas 30/60/90, SLA de reajuste, seguros, laudos)
      try {
        await generateOperationalAlerts(currentUser.cnpj, currentUser.email);
      } catch (e) {
        console.log("Falha ao gerar alertas:", e);
      }

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    }
    setIsLoading(false);
  }, [computePeriodMonths, selectedMonth, periodType, contractFilter, unitFilter, responsibleFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Carregar preferências ao montar
  useEffect(() => {
    (async () => {
      try {
        const currentUser = await User.me();
        if (currentUser) {
          const found = await DashboardPreference.filter({ user_email: currentUser.email, cnpj: currentUser.cnpj });
          if (found && found.length) {
            setUserPrefId(found[0].id);
            setPreferences(prev => ({ ...prev, ...(found[0].widgets || {}) }));
          }
        }
      } catch (e) {
        console.log("Preferências não encontradas (usando padrão).", e);
      }
    })();
     
  }, []);

  const savePreferences = async (newPrefs) => {
    try {
      const currentUser = await User.me();
      if (!currentUser) return;

      const dataToSave = { widgets: newPrefs };
      if (userPrefId) {
        await DashboardPreference.update(userPrefId, dataToSave);
      } else {
        const created = await DashboardPreference.create({ user_email: currentUser.email, cnpj: currentUser.cnpj, ...dataToSave });
        setUserPrefId(created.id);
      }
    } catch (e) {
      console.log("Falha ao salvar preferências: ", e);
    }
  };

  const COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#A855F7', '#64748B', '#F87171', '#34D399', '#FBBE24', '#C084FC']; // Tailwind shades

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <div className="h-8 bg-muted rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-40 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-4 sm:p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">

      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {user?.full_name || 'Usuário'}! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}
        </p>
      </div>

      {/* Filtros Avançados */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">Visão</span>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger className="w-36 bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="custom">Customizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">Mês ref.</span>
              <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-40 bg-background border-border text-foreground" />
            </div>
            {periodType === 'custom' && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">De</span>
                <Input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="w-36 bg-background border-border text-foreground" />
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Settings2 className="w-4 h-4 shrink-0" />
              <span className="text-xs">KPIs e gráficos respeitam filtros e período.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">Contrato</span>
              <Select value={contractFilter} onValueChange={setContractFilter}>
                <SelectTrigger className="w-full bg-background border-border text-foreground">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {allContracts.map(contract => (
                    <SelectItem key={contract.id} value={contract.id}>{contract.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">Unidade</span>
              <Input placeholder="Ex: Sede Asa Sul" value={unitFilter === 'all' ? '' : unitFilter}
                onChange={(e) => setUnitFilter(e.target.value || 'all')} className="w-full bg-background border-border text-foreground" />
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">Responsável</span>
              <Input placeholder="Nome do gestor" value={responsibleFilter === 'all' ? '' : responsibleFilter}
                onChange={(e) => setResponsibleFilter(e.target.value || 'all')} className="w-full bg-background border-border text-foreground" />
            </div>
          </div>

          {/* Preferências (Admin) */}
          {user?.department === 'admin' && (
            <div className="flex flex-wrap gap-2 pt-3 border-t border-border items-center">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Columns3 className="w-3 h-3" /> Widgets
              </Badge>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Selecionar</span>
                <Select onValueChange={(v) => {
                  const keys = ["kpis","strategic","alerts","charts","topRevenue","costsDistribution","statusContracts","rankingUnits"];
                  const np = { ...preferences };
                  if (v === 'all') keys.forEach(k => np[k] = true);
                  if (v === 'none') keys.forEach(k => np[k] = false);
                  setPreferences(np);
                  savePreferences(np);
                }}>
                  <SelectTrigger className="h-8 w-28 bg-background border-border text-foreground">
                    <SelectValue placeholder="Opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="none">Nenhum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {[
                ["kpis", "KPIs"], ["strategic", "Estratégicos"], ["alerts", "Alertas"], ["charts", "Lucro/Contratos"],
                ["topRevenue", "Top Receita"], ["costsDistribution", "Custos"], ["statusContracts", "Status"], ["rankingUnits", "Ranking Unidades"]
              ].map(([key, label]) => (
                <label key={key} className="text-xs flex items-center gap-1 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={!!preferences[key]}
                    onChange={(e) => { const np = { ...preferences, [key]: e.target.checked }; setPreferences(np); savePreferences(np); }}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs Ampliados */}
      {preferences.kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 animate-in fade-in slide-in-from-bottom-2">

          {/* Contratos Ativos */}
          <Card className="bg-card border-border border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">Contratos Ativos</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mono-number mt-1">{kpis.activeContracts}</p>
                  <div className="flex items-center mt-2 text-blue-600">
                    <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                    <span className="text-xs sm:text-sm">Total</span>
                  </div>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Faturamento Período */}
          <Card className="bg-card border-border border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">
                    {periodType === 'mensal' ? 'Faturamento Mensal' : 'Faturamento Período'}
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground kpi-value tracking-tight mt-1">{formatCurrency(kpis.monthlyRevenue)}</p>
                  <div className="flex items-center mt-2 text-green-600">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                    <span className="text-xs sm:text-sm">Soma das entradas</span>
                  </div>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Faturamento Mensal (Contratos) */}
          <Card className="bg-card border-border border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">Fat. Mensal (Contratos)</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground kpi-value tracking-tight mt-1">
                    {formatCurrency(extraKpis.monthlyContractRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Soma dos contratos ativos</p>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                </div>
              </div>
              <div className="text-right mt-2">
                <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("Contracts")}>Ver detalhes</Link>
              </div>
            </CardContent>
          </Card>

          {/* Funcionários Ativos */}
          <Card className="bg-card border-border border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">Funcionários Ativos</p>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground mono-number mt-1">{kpis.activeEmployees}</p>
                  <div className="flex items-center mt-2 text-purple-600">
                    <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                    <span className="text-xs sm:text-sm">Total</span>
                  </div>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repactuações Pendentes */}
          <Card className="bg-card border-border border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">Repactuações Pendentes</p>
                  <p className="text-2xl sm:text-3xl font-bold text-orange-600 mono-number mt-1">{extraKpis.pendingRepacts}</p>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                </div>
              </div>
              <div className="text-right mt-2">
                <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("ReajusteContratual")}>Ver detalhes</Link>
              </div>
            </CardContent>
          </Card>

          {/* Medições em Aberto */}
          <Card className="bg-card border-border border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">Medições em Aberto</p>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-600 mono-number mt-1">{extraKpis.openMeasurements}</p>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                </div>
              </div>
              <div className="text-right mt-2">
                <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("Measurements")}>Ver detalhes</Link>
              </div>
            </CardContent>
          </Card>

          {/* Lucro Líquido */}
          <Card className="bg-card border-border border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">Lucro Líquido</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground kpi-value tracking-tight mt-1">{formatCurrency(kpis.netProfit)}</p>
                  <div className={`flex items-center mt-2 ${kpis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.netProfit >= 0 ? (
                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                    ) : (
                      <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                    )}
                    <span className="text-xs sm:text-sm">
                      {periodType === 'mensal' ? 'Mês selecionado' : 'Período selecionado'}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contas a Receber */}
          <Card className="bg-card border-border border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">Contas a Receber</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground kpi-value tracking-tight mt-1">{formatCurrency(extraKpis.receivablesOpen)}</p>
                </div>
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                </div>
              </div>
              <div className="text-right mt-2">
                <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("AccountsReceivable")}>Ver detalhes</Link>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Indicadores Estratégicos */}
      {preferences.strategic && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-blue-500" />
              Indicadores Estratégicos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Índice de Eficiência</p>
              <p className={`text-2xl sm:text-3xl font-bold mono-number mt-1 ${strategicKpis.efficiencyIndex < 85 ? 'text-red-500' : 'text-green-600'}`}>
                {strategicKpis.efficiencyIndex.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Medições no prazo</p>
            </div>
            <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Contratos em Risco</p>
              <p className={`text-2xl sm:text-3xl font-bold mono-number mt-1 ${strategicKpis.atRiskContracts > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {strategicKpis.atRiskContracts}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Rentabilidade negativa</p>
            </div>
            <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Margem Média por Contrato</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mono-number mt-1">
                {strategicKpis.averageMargin ? strategicKpis.averageMargin.toFixed(1) : 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Ponderada pela receita</p>
            </div>
            <div className="text-center p-3 sm:p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Despesas Totais</p>
              <p className="text-lg sm:text-2xl font-bold text-foreground kpi-value tracking-tight mt-1">
                {formatCurrency(kpis.totalCosts)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {periodType === 'mensal' ? 'Mês selecionado' : 'Período selecionado'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertas Inteligentes */}
      {preferences.alerts && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2">

          {/* Contratos vencendo */}
          {contractAlerts.length > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-red-800 dark:text-red-300 text-sm sm:text-base">
                  <AlertTriangle className="w-4 h-4 mr-2 text-red-700 dark:text-red-400" />
                  Contratos Próximos do Fim
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <ul className="space-y-1 text-xs sm:text-sm text-red-800 dark:text-red-300">
                  {contractAlerts.map(c => (
                    <li key={c.id}>• {c.name} ({getEndDate(c)?.toLocaleDateString('pt-BR')})</li>
                  ))}
                </ul>
                <div className="text-right mt-2">
                  <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("Contracts")}>Ver detalhes</Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Funcionários em experiência */}
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-amber-800 dark:text-amber-300 text-sm sm:text-base">
                <Users className="w-4 h-4 mr-2 text-amber-700 dark:text-amber-400" />
                Funcionários em Experiência (≤ 90 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-amber-800 dark:text-amber-300 text-2xl font-bold mono-number">
              {extraKpis.probationEmployees}
              <div className="text-right mt-2">
                <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("Employees")}>Ver detalhes</Link>
              </div>
            </CardContent>
          </Card>

          {/* Repactuações Atrasadas */}
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-orange-800 dark:text-orange-300 text-sm sm:text-base">
                <ClipboardCheck className="w-4 h-4 mr-2 text-orange-700 dark:text-orange-400" />
                Repactuações Atrasadas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-orange-800 dark:text-orange-300">
              <p className="text-2xl font-bold mono-number">
                {extraKpis.delayedRepacts || 0}
              </p>
              <div className="text-right mt-2">
                <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("ReajusteContratual")}>Ver detalhes</Link>
              </div>
            </CardContent>
          </Card>

          {/* Seguros/Laudos vencendo */}
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-yellow-800 dark:text-yellow-300 text-sm sm:text-base">
                <AlertTriangle className="w-4 h-4 mr-2 text-yellow-700 dark:text-yellow-400" />
                Seguros/Laudos Vencendo (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-yellow-800 dark:text-yellow-300 text-2xl font-bold mono-number">
              {extraKpis.expiringInspections}
              <div className="text-right mt-2">
                <Link className="text-xs text-blue-600 hover:underline" to={createPageUrl("SegurosLaudos")}>Ver detalhes</Link>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Gráficos principais */}
      {preferences.charts && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" />
                Lucro por Contrato (Acumulado)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={260} className="animate-in fade-in duration-500">
                <BarChart data={chartData.profitByContract}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="lucro" fill="#3B82F6" name="Lucro" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Evolução de Receita e Lucro */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500" />
                Evolução de Receita e Lucro ({periodType === 'mensal' ? 'Período' : periodType === 'anual' ? 'Ano' : 'Período'})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={260} className="animate-in fade-in duration-500">
                <LineChart data={chartData.profitEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value, name) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="receita" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6' }} name="Receita" />
                  <Line type="monotone" dataKey="lucro" stroke="#22C55E" strokeWidth={3} dot={{ r: 5, fill: '#22C55E' }} activeDot={{ r: 7, stroke: '#22C55E', strokeWidth: 2 }} name="Lucro" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking de Contratos */}
      {preferences.strategic && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                <Award className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500" />
                Top 5 Contratos (Maior Lucro Líquido)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ul className="space-y-1 sm:space-y-2">
                {strategicKpis.topContracts.length > 0 ? (
                  strategicKpis.topContracts.map(c => (
                    <li key={c.id} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-100 dark:border-green-800">
                      <span className="font-medium text-xs sm:text-sm text-foreground">{c.name}</span>
                      <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs sm:text-sm mono-number">{formatCurrency(c.profit)}</Badge>
                    </li>
                  ))
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground">Nenhum contrato encontrado para ranking.</p>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-red-500" />
                Top 5 Contratos (Menor Lucro/Prejuízo)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ul className="space-y-1 sm:space-y-2">
                {strategicKpis.bottomContracts.length > 0 ? (
                  strategicKpis.bottomContracts.map(c => (
                    <li key={c.id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-100 dark:border-red-800">
                      <span className="font-medium text-xs sm:text-sm text-foreground">{c.name}</span>
                      <div className="flex gap-2">
                        <Badge variant="destructive" className="text-xs sm:text-sm mono-number">{formatCurrency(c.profit)}</Badge>
                        <Badge variant="outline" className={`text-xs sm:text-sm mono-number ${c.margin < 0 ? 'text-red-700 border-red-300' : 'text-foreground'}`}>
                          {c.margin ? c.margin.toFixed(1) : 0}%
                        </Badge>
                      </div>
                    </li>
                  ))
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground">Nenhum contrato encontrado para ranking.</p>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 5 Contratos por Receita (horizontal) */}
      {preferences.topRevenue && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-sky-500" />
              Top 5 Contratos por Receita (Valor Mensal)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData.topRevenue} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="contrato" width={140} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="receita" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Gráficos de distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-2">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-indigo-500" />
              Contratos por Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <ResponsiveContainer width="100%" height={260} className="animate-in fade-in duration-500">
              <RePieChart>
                <Pie
                  data={chartData.contractsByService}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData.contractsByService.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {preferences.costsDistribution && (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-rose-500" />
                Distribuição de Custos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={260}>
                <RePieChart>
                  <Pie data={chartData.costsDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {chartData.costsDistribution?.map((_, i) => (<Cell key={`cost-cell-${i}`} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </RePieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {preferences.statusContracts && (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-violet-500" />
                Status dos Contratos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData.statusContractsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ranking de Unidades */}
      {preferences.rankingUnits && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
              <Award className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-amber-500" />
              Ranking de Unidades por Lucro
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Unidade</th>
                    <th className="py-2 font-medium">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.rankingUnits?.length ? chartData.rankingUnits.map((r) => (
                    <tr key={r.unidade} className="border-t border-border">
                      <td className="py-2 pr-4 text-foreground">{r.unidade}</td>
                      <td className="py-2 font-semibold text-foreground kpi-value">{formatCurrency(r.lucro)}</td>
                    </tr>
                  )) : (
                    <tr><td className="py-4 text-center text-muted-foreground" colSpan={2}>Sem dados para o período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atividade Recente */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-foreground font-semibold text-sm sm:text-base">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex-shrink-0 mt-1">
                    {activity.status === 'success' && (
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                    )}
                    {activity.status === 'warning' && (
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    )}
                    {activity.status === 'info' && (
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm text-foreground">{activity.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">{activity.time}</p>
                  </div>
                  <Badge
                    variant={activity.status === 'success' ? 'default' :
                      activity.status === 'warning' ? 'destructive' : 'secondary'}
                    className="text-xs sm:text-sm"
                  >
                    {activity.type}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente para exibir.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground font-semibold text-sm sm:text-base">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Button asChild className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
              <Link to={createPageUrl("Contracts", "new")} className="flex flex-col items-center justify-center gap-1 sm:gap-2">
                <FileText className="w-4 h-4 sm:w-6 sm:h-6" />
                <span className="text-center">Novo Contrato</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm">
              <Link to={createPageUrl("Employees", "new")} className="flex flex-col items-center justify-center gap-1 sm:gap-2">
                <Users className="w-4 h-4 sm:w-6 sm:h-6" />
                <span className="text-center">Adicionar Funcionário</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm">
              <Link to={createPageUrl("FinancialEntries", "new")} className="flex flex-col items-center justify-center gap-1 sm:gap-2">
                <DollarSign className="w-4 h-4 sm:w-6 sm:h-6" />
                <span className="text-center">Lançamento Financeiro</span>
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-16 sm:h-20 flex flex-col items-center justify-center text-xs sm:text-sm">
              <Link to={createPageUrl("Reports")} className="flex flex-col items-center justify-center gap-1 sm:gap-2">
                <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6" />
                <span className="text-center">Gerar Relatório</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}