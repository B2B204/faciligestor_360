import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AccountsReceivable } from '@/entities/AccountsReceivable';
import { Contract } from '@/entities/Contract';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Edit, Trash2, FileDown, Copy, History as HistoryIcon, CreditCard } from 'lucide-react';
import ReceivableForm from '@/components/accountsReceivable/ReceivableForm';
import ReceivableDashboard from '@/components/accountsReceivable/ReceivableDashboard';
import PaymentModal from '@/components/accountsReceivable/PaymentModal';
import HistoryModal from '@/components/accountsReceivable/HistoryModal';
import { ReceivablePayment } from '@/entities/ReceivablePayment';
import { ReceivablePreference } from '@/entities/ReceivablePreference';
import { AccountsReceivableHistory } from '@/entities/AccountsReceivableHistory';
import { generateDueRecurringEntries } from '@/lib/recurringGenerator';
import { format, subMonths, differenceInDays, isBefore, startOfDay, getMonth, getYear } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { canEditPage } from '@/components/permissions';


export default function AccountsReceivablePage() {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // This will be deprecated by selectedStatuses
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const [periodType, setPeriodType] = useState("mensal");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedContractIds, setSelectedContractIds] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedMethods, setSelectedMethods] = useState([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [preferenceId, setPreferenceId] = useState(null);

  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAccount, setHistoryAccount] = useState(null);

  const [payments, setPayments] = useState([]);

  const canEdit = canEditPage(user?.department, 'AccountsReceivable');

  useEffect(() => {
    loadInitialData();
  }, []);

  const calculateDashboardData = (accountsData, contractsData) => {
    const today = startOfDay(new Date());

    // KPIs (based on accountsData provided, which will be filteredAccounts)
    const totalAReceber = accountsData.filter(a => a.status === 'aberto' || a.status === 'parcial' || a.status === 'vencido').reduce((sum, a) => sum + (a.open_amount || 0), 0);
    const totalVencido = accountsData.filter(a => a.status === 'vencido').reduce((sum, a) => sum + (a.open_amount || 0), 0);
    const liquidatedAccounts = accountsData.filter(a => (a.status === 'liquidado' || a.status === 'pago') && a.payment_date && a.due_date); // 'pago' for legacy

    const totalRecebido = liquidatedAccounts.reduce((sum, a) => sum + (a.paid_amount || 0), 0);

    const paymentDaysDiffs = liquidatedAccounts.map(a => differenceInDays(startOfDay(new Date(a.payment_date)), startOfDay(new Date(a.due_date))));
    const prazoMedioPagamento = paymentDaysDiffs.length > 0 ? paymentDaysDiffs.reduce((sum, days) => sum + days, 0) / paymentDaysDiffs.length : 0;

    const onTimePayments = liquidatedAccounts.filter(a => !isBefore(startOfDay(new Date(a.payment_date)), startOfDay(new Date(a.due_date)))).length;
    const pontualidade = liquidatedAccounts.length > 0 ? (onTimePayments / liquidatedAccounts.length) * 100 : 0;

    // Trend Data
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = subMonths(today, i);
      const monthName = format(targetDate, 'MMM/yy', { locale: pt });
      const monthYear = { month: getMonth(targetDate), year: getYear(targetDate) };

      const monthlyTotal = accountsData
        .filter(a => (a.status === 'liquidado' || a.status === 'pago') && a.payment_date)
        .filter(a => {
          const paymentDate = new Date(a.payment_date);
          return getMonth(paymentDate) === monthYear.month && getYear(paymentDate) === monthYear.year;
        })
        .reduce((sum, a) => sum + (a.paid_amount || 0), 0);

      trendData.push({ name: monthName, 'Valor Recebido': monthlyTotal });
    }

    // Top Overdue
    const overdueByContract = accountsData
      .filter(a => a.status === 'vencido' && a.open_amount > 0)
      .reduce((acc, curr) => {
        acc[curr.contract_id] = (acc[curr.contract_id] || 0) + curr.open_amount;
        return acc;
      }, {});
    const topOverdue = Object.entries(overdueByContract)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([contractId, value]) => ({
          name: contractsData.find(c => c.id === contractId)?.name || 'Contrato Desconhecido',
          value
      }));

    // Overdue by Range
    const overdue = accountsData.filter(a => a.status === 'vencido' && a.due_date);
    const ranges = { '0-7 dias': 0, '8-15 dias': 0, '16-30 dias': 0, '> 30 dias': 0 };
    overdue.forEach(a => {
        const daysOverdue = differenceInDays(today, startOfDay(new Date(a.due_date)));
        if (daysOverdue <= 7) ranges['0-7 dias']++;
        else if (daysOverdue <= 15) ranges['8-15 dias']++;
        else if (daysOverdue <= 30) ranges['16-30 dias']++;
        else ranges['> 30 dias']++;
    });
    const overdueByRange = Object.entries(ranges).map(([name, value]) => ({ name, 'Contas': value }));

    setDashboardData({
      kpis: { totalAReceber, totalVencido, totalRecebido, prazoMedioPagamento, pontualidade },
      trendData,
      topOverdue,
      overdueByRange
    });
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (currentUser?.cnpj) await generateDueRecurringEntries(currentUser.cnpj);
      const [receivables, contractsData, prefs, pay] = await Promise.all([
        AccountsReceivable.filter({ cnpj: currentUser.cnpj }),
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' }),
        ReceivablePreference.filter({ cnpj: currentUser.cnpj, user_email: currentUser.email }),
        ReceivablePayment.filter({ cnpj: currentUser.cnpj })
      ]);
      setAccounts(receivables.filter(a => !a.deleted_at));
      setContracts(contractsData);
      setPayments(pay || []);

      if (prefs && prefs.length) {
        const p = prefs[0];
        const prefsData = p.preferences || {};
        setPreferenceId(p.id);
        setPeriodType(prefsData.period_type || "mensal");
        setSelectedMonth(prefsData.selected_month || format(new Date(), 'yyyy-MM'));
        setCustomFrom(prefsData.custom_from || "");
        setCustomTo(prefsData.custom_to || "");
        setSelectedContractIds(prefsData.contract_ids || []);
        setSelectedClients(prefsData.clients || []);
        setSelectedStatuses(prefsData.statuses || []);
        setSelectedMethods(prefsData.billing_methods || []);
        setSelectedUnits(prefsData.units || []);
        setSelectedResponsibles(prefsData.responsibles || []);
        setPageSize(prefsData.page_size || 50);
      }

      // calculateDashboardData will be called by useEffect on filteredAccounts
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  const savePreferences = useCallback(async () => {
    if (!user) return;
    const data = {
      user_email: user.email,
      cnpj: user.cnpj,
      preferences: {
        period_type: periodType,
        selected_month: selectedMonth,
        custom_from: customFrom || null,
        custom_to: customTo || null,
        contract_ids: selectedContractIds,
        clients: selectedClients,
        statuses: selectedStatuses,
        billing_methods: selectedMethods,
        units: selectedUnits,
        responsibles: selectedResponsibles,
        page_size: pageSize
      }
    };
    try {
      if (preferenceId) {
        await ReceivablePreference.update(preferenceId, data);
      } else {
        const created = await ReceivablePreference.create(data);
        setPreferenceId(created.id);
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  }, [user, periodType, selectedMonth, customFrom, customTo, selectedContractIds, selectedClients, selectedStatuses, selectedMethods, selectedUnits, selectedResponsibles, pageSize, preferenceId]);

  useEffect(() => {
    // Persistir preferências quando filtros mudarem
    const t = setTimeout(() => { savePreferences(); }, 400);
    return () => clearTimeout(t);
  }, [savePreferences]);

  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  const monthsBetween = (from, to) => {
    const [fy,fm] = from.split('-').map(Number);
    const [ty,tm] = to.split('-').map(Number);
    const out = [];
    let d = new Date(fy, fm-1, 1);
    const end = new Date(ty, tm-1, 1);
    while (d <= end) {
      out.push(monthKey(d));
      d = new Date(d.getFullYear(), d.getMonth()+1, 1);
    }
    return out;
  };

  const computePeriodMonths = () => {
    const ref = selectedMonth || format(new Date(), 'yyyy-MM');
    if (periodType === "mensal") return [ref];
    if (periodType === "trimestral") {
      const base = new Date(ref + "-01");
      const m = [];
      for (let i=2; i>=0; i--) { const d = subMonths(base, i); m.push(monthKey(d)); }
      return m;
    }
    if (periodType === "anual") {
      const y = ref.slice(0,4);
      return Array.from({length:12},(_,i)=>`${y}-${String(i+1).padStart(2,'0')}`);
    }
    if (periodType === "custom" && customFrom && customTo) {
      return monthsBetween(customFrom.slice(0,7), customTo.slice(0,7));
    }
    return [ref];
  };

  const periodMonths = computePeriodMonths();

  const isWithinCustomRange = useCallback((dateStr) => {
    if (!dateStr || periodType !== 'custom' || !customFrom || !customTo) return true; // if not custom, or missing dates, don't filter by range
    const d = startOfDay(new Date(dateStr));
    const fromDate = startOfDay(new Date(customFrom));
    const toDate = startOfDay(new Date(customTo));
    return d >= fromDate && d <= toDate;
  }, [periodType, customFrom, customTo]);

  const handleSave = async () => {
    await loadInitialData();
    setIsFormOpen(false);
    setEditingAccount(null);
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  const handleDelete = async (accountId) => {
    if (window.confirm("Tem certeza que deseja excluir esta conta?")) {
      try {
        await AccountsReceivable.update(accountId, { deleted_at: new Date().toISOString() });
        await loadInitialData();
      } catch (error) {
        console.error("Erro ao excluir conta:", error);
        alert("Falha ao excluir a conta.");
      }
    }
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const statusMap = {
    aberto: { label: "Aberto", color: "bg-blue-100 text-blue-800" },
    parcial: { label: "Parcial", color: "bg-amber-100 text-amber-800" },
    vencido: { label: "Vencido", color: "bg-red-100 text-red-800" },
    pago: { label: "Pago", color: "bg-green-100 text-green-800" }, // legacy
    liquidado: { label: "Liquidado", color: "bg-green-100 text-green-800" },
    cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-700" }
  };

  // Filtros adicionais (contratos, cliente, status, método, unidade, responsável) + período
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const contract = contracts.find(c => c.id === acc.contract_id);

      const accCompetenceMonth = (acc.competence_month && acc.competence_month.length === 7) ? acc.competence_month : (acc.due_date ? acc.due_date.slice(0,7) : "");

      let periodMatch = true;
      if (periodType === 'custom') {
        periodMatch = isWithinCustomRange(acc.due_date || acc.issue_date);
      } else {
        periodMatch = periodMonths.includes(accCompetenceMonth);
      }

      if (!periodMatch) return false;

      const contractMatch = !selectedContractIds.length || selectedContractIds.includes(acc.contract_id);
      const clientMatch = !selectedClients.length || (contract?.client_name && selectedClients.includes(contract.client_name));

      let currentStatus = acc.status;
      if (acc.status === 'aberto' && acc.due_date && startOfDay(new Date(acc.due_date)) < startOfDay(new Date()) && (acc.open_amount || 0) > 0) {
        currentStatus = 'vencido';
      }
      const statusFilterMatch = !selectedStatuses.length || selectedStatuses.includes(currentStatus);

      const methodMatch = !selectedMethods.length || (acc.billing_method && selectedMethods.includes(acc.billing_method));
      const unitMatch = !selectedUnits.length || (contract?.unidade && selectedUnits.includes(contract.unidade));
      const respMatch = !selectedResponsibles.length || (contract?.apoio_administrativo && selectedResponsibles.includes(contract.apoio_administrativo));

      // Busca rápida existente
      const searchMatch = searchTerm === '' ||
        (contract?.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        acc.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contract?.client_name?.toLowerCase().includes(searchTerm.toLowerCase()));

      return contractMatch && clientMatch && statusFilterMatch && methodMatch && unitMatch && respMatch && searchMatch;
    });
  }, [accounts, contracts, searchTerm, selectedContractIds, selectedClients, selectedStatuses, selectedMethods, selectedUnits, selectedResponsibles, periodType, periodMonths, isWithinCustomRange]);

  // KPIs
  const kpis = useMemo(() => {
    const totalReceber = filteredAccounts.reduce((s,a)=> s + (a.face_value || 0), 0);
    const emAberto = filteredAccounts.reduce((s,a)=> s + (a.open_amount != null ? a.open_amount : ((a.face_value||0) - (a.paid_amount||0))), 0);

    // Received in period logic, filters payments based on their payment_date and selected filters
    const receivedInPeriod = payments.filter(p => {
      if (!p.payment_date) return false;
      const paymentAccount = accounts.find(a => a.id === p.receivable_id);
      if (!paymentAccount) return false; // Payment for a non-existent or deleted account

      // Check if the payment's associated account would be included by contract filters
      const contractMatch = !selectedContractIds.length || selectedContractIds.includes(paymentAccount.contract_id);
      if (!contractMatch) return false;

      // Check if payment date falls within the selected period
      const paymentMonth = p.payment_date.slice(0,7);
      if (periodType === 'custom') {
        return isWithinCustomRange(p.payment_date);
      } else {
        return periodMonths.includes(paymentMonth);
      }
    }).reduce((s,p)=> s + (p.amount || 0), 0);

    const atrasados = filteredAccounts.filter(a => {
      const overdue = a.due_date && startOfDay(new Date(a.due_date)) < startOfDay(new Date()) && (a.open_amount || 0) > 0 && a.status !== 'cancelado' && a.status !== 'liquidado' && a.status !== 'pago';
      return overdue;
    });
    const totalAtrasado = atrasados.reduce((s,a)=> s + (a.open_amount || 0), 0);
    const inadimplencia = totalReceber > 0 ? (totalAtrasado / totalReceber) * 100 : 0;

    // PMR ponderado por valor recebido (usando contas com payment_date dentro do período)
    const pmrBase = filteredAccounts.filter(a => a.payment_date && (periodType==='custom' ? isWithinCustomRange(a.payment_date) : periodMonths.includes(a.payment_date.slice(0,7))));
    const diffs = pmrBase.map(a => differenceInDays(startOfDay(new Date(a.payment_date)), startOfDay(new Date(a.due_date))));
    const pmr = diffs.length ? diffs.reduce((s,d)=> s+d, 0)/diffs.length : 0;

    return {
      totalReceber,
      receivedInPeriod,
      emAberto,
      emAbertoPct: totalReceber > 0 ? (emAberto/totalReceber)*100 : 0,
      totalAtrasado,
      qtdAtrasado: atrasados.length,
      pmr,
      inadimplencia
    };
  }, [filteredAccounts, payments, periodType, periodMonths, selectedContractIds, isWithinCustomRange, accounts]);

  // Atualizar dashboard (gráficos) respeitando filtros
  useEffect(() => {
    calculateDashboardData(filteredAccounts, contracts);
  }, [filteredAccounts, contracts]);

  // Paginação
  const total = filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = (page-1)*pageSize;
  const showing = filteredAccounts.slice(pageStart, pageStart + pageSize);

  const handleRegisterPayment = (acc) => { setPaymentAccount(acc); setShowPaymentModal(true); };
  const handleHistory = (acc) => { setHistoryAccount(acc); setShowHistoryModal(true); };

  const handleDuplicate = async (acc) => {
    if (!user) return;
    try {
      const nextMonth = format(subMonths(new Date(acc.due_date || new Date()), -1), 'yyyy-MM-dd');
      const dup = await AccountsReceivable.create({
        contract_id: acc.contract_id,
        document_number: `${acc.document_number}-CÓPIA ${format(new Date(), 'yyyyMMddHHmmss')}`,
        status: "aberto",
        issue_date: acc.issue_date || null,
        competence_month: acc.competence_month || (acc.due_date ? acc.due_date.slice(0,7) : null),
        due_date: nextMonth,
        billing_method: acc.billing_method || "outros",
        face_value: acc.face_value,
        open_amount: acc.face_value,
        observations: `Duplicado de ${acc.document_number}`,
        cnpj: user.cnpj,
        created_by: user.email
      });
      await AccountsReceivableHistory.create({
        receivable_id: dup.id,
        action: "duplicated",
        notes: `Título duplicado a partir de ${acc.document_number}. Novo documento: ${dup.document_number}.`,
        cnpj: user.cnpj
      });
      alert(`Título ${dup.document_number} duplicado com sucesso!`);
      await loadInitialData();
    } catch (error) {
      console.error("Erro ao duplicar conta:", error);
      alert("Falha ao duplicar a conta.");
    }
  };

  const exportCSV = () => {
    const headers = ["ID","Documento","Contrato","Cliente","Competência","Emissão","Vencimento","DiasAtraso","Forma","Bruto","Descontos","Líquido","Aberto","Status","Responsável","Unidade"];
    const rows = filteredAccounts.map(a => {
      const c = contracts.find(ct => ct.id === a.contract_id);
      const daysLate = a.due_date && startOfDay(new Date(a.due_date)) < startOfDay(new Date()) ? Math.max(0, differenceInDays(startOfDay(new Date()), startOfDay(new Date(a.due_date)))) : 0;
      const liquid = (a.face_value || 0) - (a.discount_amount || 0);
      let currentStatus = a.status;
      if (a.status === 'aberto' && a.due_date && startOfDay(new Date(a.due_date)) < startOfDay(new Date()) && (a.open_amount || 0) > 0) {
        currentStatus = 'vencido';
      }
      return [
        a.id,
        `"${String(a.document_number).replace(/"/g, '""')}"`, // Handle quotes in string
        `"${String(c?.name || "").replace(/"/g, '""')}"`,
        `"${String(c?.client_name || "").replace(/"/g, '""')}"`,
        `"${String(a.competence_month || (a.due_date ? a.due_date.slice(0,7) : "")).replace(/"/g, '""')}"`,
        `"${String(a.issue_date || "").replace(/"/g, '""')}"`,
        `"${String(a.due_date || "").replace(/"/g, '""')}"`,
        daysLate,
        `"${String(a.billing_method || "").replace(/"/g, '""')}"`,
        a.face_value || 0,
        a.discount_amount || 0,
        liquid,
        a.open_amount != null ? a.open_amount : ((a.face_value||0) - (a.paid_amount||0)),
        `"${String(statusMap[currentStatus]?.label || currentStatus).replace(/"/g, '""')}"`,
        `"${String(c?.apoio_administrativo || "").replace(/"/g, '""')}"`,
        `"${String(c?.unidade || "").replace(/"/g, '""')}"`
      ].join(";");
    });
    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" }); // Add BOM for UTF-8 compatibility
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas_a_receber_${selectedMonth}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {/* Filtros de Período e Avançados */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
            <div className="col-span-2 flex items-center gap-2">
              <Label htmlFor="period-type" className="text-sm">Período</Label>
              <Select value={periodType} onValueChange={v => { setPeriodType(v); setPage(1); }}>
                <SelectTrigger id="period-type" className="w-40"><SelectValue placeholder="Visão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodType !== 'custom' && (
              <div className="flex items-center gap-2">
                <Label htmlFor="selected-month" className="text-sm">Mês/Ano</Label>
                <Input type="month" id="selected-month" value={selectedMonth} onChange={(e)=>{ setSelectedMonth(e.target.value); setPage(1); }} className="w-44" />
              </div>
            )}
            {periodType === 'custom' && (
              <>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-from" className="text-sm">De</Label>
                  <Input type="date" id="custom-from" value={customFrom} onChange={(e)=>{ setCustomFrom(e.target.value); setPage(1); }} className="w-44" />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-to" className="text-sm">Até</Label>
                  <Input type="date" id="custom-to" value={customTo} onChange={(e)=>{ setCustomTo(e.target.value); setPage(1); }} className="w-44" />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Label htmlFor="page-size" className="text-sm">Itens por pág.</Label>
              <Select value={String(pageSize)} onValueChange={(v)=>{ setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger id="page-size" className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div>
              <Label className="text-sm">Contrato</Label>
              <Select onValueChange={(v)=> {
                setSelectedContractIds(prev => {
                  const newSelection = prev.includes(v) ? prev.filter(i=>i!==v) : [...prev, v];
                  setPage(1);
                  return newSelection;
                });
              }}>
                <SelectTrigger><SelectValue placeholder={selectedContractIds.length ? `${selectedContractIds.length} selecionados` : "Filtrar contratos"} /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  {selectedContractIds.length > 0 && <SelectItem value={null} className="text-red-500">Limpar Contratos</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Cliente/Órgão</Label>
              <Select onValueChange={(v)=> {
                setSelectedClients(prev => {
                  const newSelection = prev.includes(v) ? prev.filter(i=>i!==v) : [...prev, v];
                  setPage(1);
                  return newSelection;
                });
              }}>
                <SelectTrigger><SelectValue placeholder={selectedClients.length ? `${selectedClients.length} selecionados` : "Filtrar clientes"} /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(contracts.map(c=>c.client_name).filter(Boolean))).sort().map(n => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                  {selectedClients.length > 0 && <SelectItem value={null} className="text-red-500">Limpar Clientes</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Status</Label>
              <Select onValueChange={(v)=> {
                setSelectedStatuses(prev => {
                  const newSelection = prev.includes(v) ? prev.filter(i=>i!==v) : [...prev, v];
                  setPage(1);
                  return newSelection;
                });
              }}>
                <SelectTrigger><SelectValue placeholder={selectedStatuses.length ? `${selectedStatuses.length} selecionados` : "Status"} /></SelectTrigger>
                <SelectContent>
                  {["aberto","parcial","vencido","liquidado","cancelado"].map(s => (<SelectItem value={s} key={s} className="capitalize">{statusMap[s]?.label || s}</SelectItem>))}
                  {selectedStatuses.length > 0 && <SelectItem value={null} className="text-red-500">Limpar Status</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Forma</Label>
              <Select onValueChange={(v)=> {
                setSelectedMethods(prev => {
                  const newSelection = prev.includes(v) ? prev.filter(i=>i!==v) : [...prev, v];
                  setPage(1);
                  return newSelection;
                });
              }}>
                <SelectTrigger><SelectValue placeholder={selectedMethods.length ? `${selectedMethods.length} selecionados` : "Forma"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="nota_empenho">Nota/Empenho</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                  {selectedMethods.length > 0 && <SelectItem value={null} className="text-red-500">Limpar Formas</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Unidade</Label>
              <Select onValueChange={(v)=> {
                setSelectedUnits(prev => {
                  const newSelection = prev.includes(v) ? prev.filter(i=>i!==v) : [...prev, v];
                  setPage(1);
                  return newSelection;
                });
              }}>
                <SelectTrigger><SelectValue placeholder={selectedUnits.length ? `${selectedUnits.length} selecionados` : "Unidade"} /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(contracts.map(c=>c.unidade).filter(Boolean))).sort().map(u => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                  {selectedUnits.length > 0 && <SelectItem value={null} className="text-red-500">Limpar Unidades</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Responsável</Label>
              <Select onValueChange={(v)=> {
                setSelectedResponsibles(prev => {
                  const newSelection = prev.includes(v) ? prev.filter(i=>i!==v) : [...prev, v];
                  setPage(1);
                  return newSelection;
                });
              }}>
                <SelectTrigger><SelectValue placeholder={selectedResponsibles.length ? `${selectedResponsibles.length} selecionados` : "Responsável"} /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(contracts.map(c=>c.apoio_administrativo).filter(Boolean))).sort().map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                  {selectedResponsibles.length > 0 && <SelectItem value={null} className="text-red-500">Limpar Responsáveis</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-grow w-full md:max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por contrato, cliente ou nº do documento..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" onClick={exportCSV} className="w-full md:w-auto"><FileDown className="w-4 h-4 mr-2" />Exportar CSV</Button>
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                {canEdit && (
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditingAccount(null)} className="w-full md:w-auto">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Conta
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta a Receber'}</DialogTitle>
                  </DialogHeader>
                  <ReceivableForm
                    account={editingAccount}
                    onSave={handleSave}
                    onCancel={() => setIsFormOpen(false)}
                    user={user}
                    contracts={contracts}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total a Receber</p><p className="text-xl font-bold text-foreground">{formatCurrency(kpis.totalReceber)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recebido no Período</p><p className="text-xl font-bold text-green-600">{formatCurrency(kpis.receivedInPeriod)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em Aberto</p><p className="text-xl font-bold text-blue-600">{formatCurrency(kpis.emAberto)} <span className="text-xs text-muted-foreground">({kpis.emAbertoPct.toFixed(1)}%)</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Atrasado</p><p className="text-xl font-bold text-red-600">{formatCurrency(kpis.totalAtrasado)} <span className="text-xs text-muted-foreground">({kpis.qtdAtrasado} títulos)</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">PMR</p><p className="text-xl font-bold text-foreground">{kpis.pmr.toFixed(1)} dias</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Inadimplência</p><p className="text-xl font-bold text-amber-600">{kpis.inadimplencia.toFixed(1)}%</p></CardContent></Card>
      </div>

      {/* Dashboard existente (respeita filtros via filteredAccounts) */}
      <ReceivableDashboard data={dashboardData} />

      {/* Tabela */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <CardTitle>Títulos Filtrados ({total})</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" onClick={()=> setPage(Math.max(1, page-1))} disabled={page === 1}>Anterior</Button>
              <Button variant="outline" size="sm" onClick={()=> setPage(Math.min(totalPages, page+1))} disabled={page === totalPages}>Próxima</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="grid gap-4">
            {showing.length > 0 ? (
              showing.map((account) => {
                const contract = contracts.find(c => c.id === account.contract_id);
                const daysLate = account.due_date && startOfDay(new Date(account.due_date)) < startOfDay(new Date()) ? Math.max(0, differenceInDays(startOfDay(new Date()), startOfDay(new Date(account.due_date)))) : 0;
                const liquid = (account.face_value || 0) - (account.discount_amount || 0);

                let displayStatus = account.status;
                if (account.status === 'aberto' && daysLate > 0 && (account.open_amount || 0) > 0) {
                  displayStatus = 'vencido';
                }

                return (
                  <Card key={account.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-7 gap-4 items-center">
                      <div className="lg:col-span-2">
                        <p className="font-semibold text-foreground">{contract?.name || 'Contrato'}</p>
                        <p className="text-sm text-muted-foreground">{contract?.client_name}</p>
                        <p className="text-xs text-muted-foreground">Título: {account.document_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Competência</p>
                        <p className="font-medium">{account.competence_month || (account.due_date ? account.due_date.slice(0,7) : "-")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vencimento</p>
                        <p className="font-medium">{account.due_date ? format(new Date(account.due_date), 'dd/MM/yyyy') : "-"}</p>
                        {daysLate > 0 && <p className="text-xs text-red-600">{daysLate} dias atraso</p>}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valores</p>
                        <p className="font-bold text-foreground">{formatCurrency(liquid)}</p>
                        <p className="text-xs text-blue-600">Aberto: {formatCurrency(account.open_amount != null ? account.open_amount : ((account.face_value||0)-(account.paid_amount||0)))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Forma</p>
                        <p className="capitalize text-sm">{account.billing_method || "-"}</p>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusMap[displayStatus]?.color || 'bg-gray-100 text-gray-800'}`}>
                          {statusMap[displayStatus]?.label || displayStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 lg:col-span-1">
                        {canEdit && (
                          <Button variant="outline" size="sm" onClick={()=> handleRegisterPayment(account)} disabled={displayStatus === 'liquidado' || displayStatus === 'cancelado'}><CreditCard className="w-4 h-4 mr-1" /> Receber</Button>
                        )}
                        <Button variant="outline" size="sm" onClick={()=> handleHistory(account)}><HistoryIcon className="w-4 h-4 mr-1" /> Histórico</Button>
                        {canEdit && (
                          <>
                            <Button variant="outline" size="sm" onClick={()=> handleDuplicate(account)}><Copy className="w-4 h-4 mr-1" /> Duplicar</Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(account)}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(account.id)} className="text-red-500"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhum título encontrado para os filtros selecionados.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        account={paymentAccount}
        user={user}
        onSaved={loadInitialData}
      />
      <HistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        account={historyAccount}
        user={user}
      />
    </div>
  );
}