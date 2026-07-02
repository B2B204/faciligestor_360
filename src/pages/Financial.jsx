import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Contract } from "@/entities/Contract";
import { FinancialEntry } from "@/entities/FinancialEntry";
import { TaxExcess } from "@/entities/TaxExcess";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue as SelectSelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus, DollarSign, TrendingUp, TrendingDown, Calculator,
  Filter, AlertTriangle, Trash2, MoreVertical, Edit, Eye, Search
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { canEditPage } from "@/components/permissions";
import CashflowForecast from "@/components/financial/CashflowForecast";
import ContractRiskTable from "@/components/financial/ContractRiskTable";

const planLimits = {
  essencial: { contracts: 5, users: 5 },
  avancado: { contracts: 20, users: 10 },
  pro: { contracts: Infinity, users: Infinity }
};

export default function FinancialPage() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [financialData, setFinancialData] = useState([]);
  const [taxExcesses, setTaxExcesses] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    totalCosts: 0,
    linkedAccount: 0,
    netProfit: 0
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTaxExcessOpen, setIsTaxExcessOpen] = useState(false);
  const [filterContract, setFilterContract] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Novos filtros
  const [filterFromMonth, setFilterFromMonth] = useState("");
  const [filterToMonth, setFilterToMonth] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterResponsible, setFilterResponsible] = useState("all");
  const [filterResult, setFilterResult] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const userRole = user?.department || 'comercial';
  const canEdit = canEditPage(userRole, 'Financial');

  const calculateDashboard = useCallback((entries, excesses) => {
    const totals = entries.reduce((acc, entry) => ({
      totalRevenue: acc.totalRevenue + (entry.net_revenue || 0),
      totalCosts: acc.totalCosts + (entry.total_costs || 0),
      linkedAccount: acc.linkedAccount + (entry.linked_account_value || 0),
      netProfit: acc.netProfit + (entry.final_result || 0)
    }), { totalRevenue: 0, totalCosts: 0, linkedAccount: 0, netProfit: 0 });

    const totalExcess = excesses.reduce((sum, excess) => sum + (excess.total_excess || 0), 0);
    totals.netProfit -= totalExcess;

    setDashboardData(totals);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const [contractsData, financialEntries, taxExcessData] = await Promise.all([
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' }),
        FinancialEntry.filter({ cnpj: currentUser.cnpj }, "-created_date"),
        TaxExcess.filter({ cnpj: currentUser.cnpj }, "-created_date")
      ]);
      setContracts(contractsData);
      setFinancialData(financialEntries);
      setTaxExcesses(taxExcessData);
      calculateDashboard(financialEntries, taxExcessData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert("Erro ao carregar dados. Tente recarregar a página.");
    }
    setIsLoading(false);
  }, [calculateDashboard]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setIsFormOpen(true);
  };

  const handleViewEntry = (entry) => {
    setViewingEntry(entry);
    setIsViewModalOpen(true);
  };

  const handleDeleteEntry = async (entryId) => {
    if (window.confirm('Tem certeza que deseja excluir este lançamento financeiro? Esta ação não pode ser desfeita.')) {
      try {
        await FinancialEntry.delete(entryId);
        await loadData();
        alert('Lançamento excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir lançamento:', error);
        alert('Erro ao excluir lançamento. Tente novamente.');
      }
    }
  };

  const unitOptions = useMemo(() => {
    const set = new Set((contracts || []).map(c => c.unidade).filter(Boolean));
    return Array.from(set).sort();
  }, [contracts]);

  const responsibleOptions = useMemo(() => {
    const set = new Set((contracts || []).map(c => c.apoio_administrativo).filter(Boolean));
    return Array.from(set).sort();
  }, [contracts]);


  const FinancialForm = ({ user, contracts, onSaveSuccess, editingEntry }) => {
    const [formData, setFormData] = useState({
      contract_id: "",
      reference_month: "",
      gross_revenue: 0,
      net_revenue: 0,
      inss_percentage: 0, inss_value: 0,
      irrf_percentage: 0, irrf_value: 0,
      iss_percentage: 0, iss_value: 0,
      pis_percentage: 0, pis_value: 0,
      cofins_percentage: 0, cofins_value: 0,
      csll_percentage: 0, csll_value: 0,
      linked_account_percentage: 20, linked_account_value: 0,
      calculated_from: "percent",
      payroll_cost: 0,
      social_charges_cost: 0,
      meal_allowance_cost: 0,
      transport_allowance_cost: 0,
      other_costs: 0,
      cleaning_products: 0,
      equipment_tools: 0,
      uniforms_epis: 0,
      disposable_materials: 0,
      other_materials: 0,
      total_materials: 0,
      total_costs: 0,
      final_result: 0,
      observations: ""
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      if (editingEntry) {
        setFormData({
          contract_id: editingEntry.contract_id || "",
          reference_month: editingEntry.reference_month || "",
          gross_revenue: editingEntry.gross_revenue || 0,
          net_revenue: editingEntry.net_revenue || 0,
          inss_percentage: editingEntry.inss_percentage || 0,
          inss_value: editingEntry.inss_value || 0,
          irrf_percentage: editingEntry.irrf_percentage || 0,
          irrf_value: editingEntry.irrf_value || 0,
          iss_percentage: editingEntry.iss_percentage || 0,
          iss_value: editingEntry.iss_value || 0,
          pis_percentage: editingEntry.pis_percentage || 0,
          pis_value: editingEntry.pis_value || 0,
          cofins_percentage: editingEntry.cofins_percentage || 0,
          cofins_value: editingEntry.cofins_value || 0,
          linked_account_percentage: editingEntry.linked_account_percentage ?? 0,
          linked_account_value: editingEntry.linked_account_value ?? 0,
          calculated_from: editingEntry.calculated_from || (editingEntry.linked_account_percentage ? "percent" : "value"),
          payroll_cost: editingEntry.payroll_cost || 0,
          social_charges_cost: editingEntry.social_charges_cost || 0,
          meal_allowance_cost: editingEntry.meal_allowance_cost || 0,
          transport_allowance_cost: editingEntry.transport_allowance_cost || 0,
          other_costs: editingEntry.other_costs || 0,
          cleaning_products: editingEntry.cleaning_products || 0,
          equipment_tools: editingEntry.equipment_tools || 0,
          uniforms_epis: editingEntry.uniforms_epis || 0,
          disposable_materials: editingEntry.disposable_materials || 0,
          other_materials: editingEntry.other_materials || 0,
          total_materials: editingEntry.total_materials || 0,
          total_costs: editingEntry.total_costs || 0,
          final_result: editingEntry.final_result || 0,
          observations: editingEntry.observations || ""
        });
      } else {
        setFormData({
          contract_id: "",
          reference_month: "",
          gross_revenue: 0,
          net_revenue: 0,
          inss_percentage: 0, inss_value: 0,
          irrf_percentage: 0, irrf_value: 0,
          iss_percentage: 0, iss_value: 0,
          pis_percentage: 0, pis_value: 0,
          cofins_percentage: 0, cofins_value: 0,
          csll_percentage: 0, csll_value: 0,
          linked_account_percentage: 20, linked_account_value: 0,
          calculated_from: "percent",
          payroll_cost: 0,
          social_charges_cost: 0,
          meal_allowance_cost: 0,
          transport_allowance_cost: 0,
          other_costs: 0,
          cleaning_products: 0,
          equipment_tools: 0,
          uniforms_epis: 0,
          disposable_materials: 0,
          other_materials: 0,
          total_materials: 0,
          total_costs: 0,
          final_result: 0,
          observations: ""
        });
      }
    }, [editingEntry]);

    useEffect(() => {
      const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

      const {
        gross_revenue, inss_percentage, irrf_percentage, iss_percentage, pis_percentage, cofins_percentage, csll_percentage,
        payroll_cost, social_charges_cost, meal_allowance_cost, transport_allowance_cost, other_costs,
        cleaning_products, equipment_tools, uniforms_epis, disposable_materials, other_materials,
        linked_account_percentage: laPct, linked_account_value: laVal, calculated_from
      } = formData;

      const inss_value = gross_revenue * (inss_percentage / 100);
      const irrf_value = gross_revenue * (irrf_percentage / 100);
      const iss_value = gross_revenue * (iss_percentage / 100);
      const pis_value = gross_revenue * (pis_percentage / 100);
      const cofins_value = gross_revenue * (cofins_percentage / 100);
      const csll_value = gross_revenue * (csll_percentage / 100);

      let linked_account_percentage = laPct || 0;
      let linked_account_value = laVal || 0;

      const gr = Number(gross_revenue) || 0;
      if (!gr || gr <= 0) {
        linked_account_percentage = calculated_from === "value" ? 0 : Math.min(Math.max(linked_account_percentage, 0), 100);
        linked_account_value = calculated_from === "percent" ? 0 : 0;
      } else {
        if (calculated_from === "percent") {
          linked_account_percentage = Math.min(Math.max(linked_account_percentage, 0), 100);
          linked_account_value = round2(gr * (linked_account_percentage / 100));
        } else {
          linked_account_value = Math.min(Math.max(linked_account_value, 0), gr);
          linked_account_percentage = round2((linked_account_value / gr) * 100);
        }
      }

      const totalTaxesAndRetentions = inss_value + irrf_value + iss_value + pis_value + cofins_value + csll_value + linked_account_value;
      const net_revenue = gr - totalTaxesAndRetentions;

      const total_materials = (cleaning_products || 0) + (equipment_tools || 0) + (uniforms_epis || 0) + (disposable_materials || 0) + (other_materials || 0);
      const operational_costs = (payroll_cost || 0) + (social_charges_cost || 0) + (meal_allowance_cost || 0) + (transport_allowance_cost || 0) + (other_costs || 0);
      const total_costs = operational_costs + total_materials;

      const final_result = net_revenue - total_costs;

      setFormData(prev => {
        const next = {
          ...prev,
          inss_value, irrf_value, iss_value, pis_value, cofins_value, csll_value,
          linked_account_value, linked_account_percentage,
          net_revenue, total_materials, total_costs, final_result
        };

        const same =
          prev.inss_value === next.inss_value &&
          prev.irrf_value === next.irrf_value &&
          prev.iss_value === next.iss_value &&
          prev.pis_value === next.pis_value &&
          prev.cofins_value === next.cofins_value &&
          prev.csll_value === next.csll_value &&
          prev.linked_account_value === next.linked_account_value &&
          prev.linked_account_percentage === next.linked_account_percentage &&
          prev.net_revenue === next.net_revenue &&
          prev.total_materials === next.total_materials &&
          prev.total_costs === next.total_costs &&
          prev.final_result === next.final_result;

        return same ? prev : next;
      });
    }, [formData]);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: (name.includes('percentage') || name.includes('cost') || name.includes('revenue') || name.includes('products') || name.includes('tools') || name.includes('epis') || name.includes('materials') || name.includes('value'))
          ? Number(value) || 0
          : value
      }));
    };

    const handleSelectChange = (name, value) => {
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();

      if (!formData.contract_id) {
        alert("Por favor, selecione um contrato.");
        return;
      }

      if (!formData.reference_month) {
        alert("Por favor, selecione o mês/ano de referência.");
        return;
      }

      if (!user || !user.cnpj) {
        alert("Erro: Dados do usuário não carregados.");
        return;
      }

      if (!formData.gross_revenue || formData.gross_revenue <= 0) {
        alert("Por favor, informe o faturamento bruto.");
        return;
      }

      if (formData.linked_account_percentage > 100) {
        alert("Percentual da Conta Vinculada não pode exceder 100%.");
        return;
      }
      if (formData.linked_account_value > formData.gross_revenue) {
        alert("Valor da Conta Vinculada não pode exceder o Faturamento Bruto.");
        return;
      }

      setIsSaving(true);
      try {
        const dataToSave = {
          ...formData,
          cnpj: user.cnpj,
          calculated_from: formData.calculated_from || "percent",
          ...(editingEntry ? { updated_by: user.email } : { created_by: user.email })
        };

        console.log(editingEntry ? "🔄 Atualizando lançamento financeiro:" : "🔄 Salvando lançamento financeiro:", dataToSave);

        let savedEntry;
        if (editingEntry) {
          savedEntry = await FinancialEntry.update(editingEntry.id, dataToSave);
          console.log("✅ Lançamento atualizado com sucesso:", savedEntry);
        } else {
          savedEntry = await FinancialEntry.create(dataToSave);
          console.log("✅ Lançamento salvo com sucesso:", savedEntry);
        }

        console.log("🔄 Recarregando dados financeiros...");
        await onSaveSuccess();

        alert(editingEntry ? "Lançamento financeiro atualizado com sucesso!" : "Lançamento financeiro salvo com sucesso!");
        console.log("✅ Dados recarregados - lançamento deve aparecer na lista");

      } catch (error) {
        console.error("❌ Erro detalhado ao salvar lançamento:", error);
        alert(`Erro ao salvar lançamento financeiro: ${error.message || 'Erro desconhecido'}`);
      } finally {
        setIsSaving(false);
      }
    };

    const renderTaxField = (name, label) => (
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <Label htmlFor={name + "_percentage"}>{label} (%)</Label>
          <Input type="number" step="0.01" id={name + "_percentage"} name={name + "_percentage"} value={formData[name + "_percentage"]} onChange={handleChange} />
        </div>
        <div>
          <Label>Valor (R$)</Label>
          <div className="p-2 bg-muted border border-border rounded font-mono text-sm text-foreground">{formatCurrency(formData[name + "_value"])}</div>
        </div>
      </div>
    );

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">Identificação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contrato *</Label>
              <Select
                value={formData.contract_id}
                onValueChange={(v) => handleSelectChange("contract_id", v)}
                required
              >
                <SelectTrigger><SelectSelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts && contracts.length > 0 ? (
                    contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                  ) : (
                    <SelectItem value="none" disabled>Nenhum contrato ativo encontrado</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reference_month">Mês/Ano de Referência *</Label>
              <Input type="month" id="reference_month" name="reference_month" value={formData.reference_month} onChange={handleChange} required />
            </div>
          </div>
        </div>

        {/* Receitas */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">Receitas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gross_revenue">Faturamento Bruto (R$)</Label>
              <Input type="number" step="0.01" id="gross_revenue" name="gross_revenue" value={formData.gross_revenue} onChange={handleChange} />
            </div>
            <div>
              <Label>Receita Líquida (R$)</Label>
              <div className="p-2 bg-card border border-border rounded text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(formData.net_revenue)}</div>
            </div>
          </div>
        </div>

        {/* Impostos e Retenções */}
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <h3 className="font-semibold text-red-900 dark:text-red-300 mb-3">Impostos e Retenções</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderTaxField("inss", "INSS")}
            {renderTaxField("irrf", "IRRF")}
            {renderTaxField("iss", "ISS")}
            {renderTaxField("pis", "PIS")}
            {renderTaxField("cofins", "COFINS")}
            {renderTaxField("csll", "CSLL")}
          </div>
        </div>

        {/* Conta Vinculada */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
          <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Conta Vinculada</h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">Preencha % ou Valor. O outro será calculado automaticamente.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="linked_account_percentage">Percentual (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                id="linked_account_percentage"
                name="linked_account_percentage"
                value={formData.linked_account_percentage}
                onChange={(e) => {
                  const p = Number(e.target.value) || 0;
                  setFormData(prev => ({ ...prev, linked_account_percentage: p, calculated_from: "percent" }));
                }}
                placeholder="Ex.: 5,00"
              />
            </div>
            <div>
              <Label htmlFor="linked_account_value">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                id="linked_account_value"
                name="linked_account_value"
                value={formData.linked_account_value}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setFormData(prev => ({ ...prev, linked_account_value: v, calculated_from: "value" }));
                }}
                placeholder="Ex.: 7500,00"
              />
            </div>
          </div>
          {(!formData.gross_revenue || formData.gross_revenue <= 0) && (
            <p className="text-xs text-red-600 mt-2">Informe o Faturamento Bruto para calcular a Conta Vinculada.</p>
          )}
        </div>

        {/* Custos Operacionais */}
        <div className="bg-muted/50 border border-border p-4 rounded-lg">
          <h3 className="font-semibold text-foreground mb-3">Custos Operacionais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="payroll_cost">Folha de Pagamento (R$)</Label>
              <Input type="number" step="0.01" id="payroll_cost" name="payroll_cost" value={formData.payroll_cost} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="social_charges_cost">Encargos Sociais (R$)</Label>
              <Input type="number" step="0.01" id="social_charges_cost" name="social_charges_cost" value={formData.social_charges_cost} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="meal_allowance_cost">Vale Alimentação (R$)</Label>
              <Input type="number" step="0.01" id="meal_allowance_cost" name="meal_allowance_cost" value={formData.meal_allowance_cost} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="transport_allowance_cost">Vale Transporte (R$)</Label>
              <Input type="number" step="0.01" id="transport_allowance_cost" name="transport_allowance_cost" value={formData.transport_allowance_cost} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="other_costs">Outros Custos (R$)</Label>
              <Input type="number" step="0.01" id="other_costs" name="other_costs" value={formData.other_costs} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Materiais e Insumos */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">Materiais e Insumos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cleaning_products">Produtos de Limpeza (R$)</Label>
              <Input type="number" step="0.01" id="cleaning_products" name="cleaning_products" value={formData.cleaning_products} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="equipment_tools">Equipamentos/Ferramentas (R$)</Label>
              <Input type="number" step="0.01" id="equipment_tools" name="equipment_tools" value={formData.equipment_tools} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="uniforms_epis">Uniformes/EPIs (R$)</Label>
              <Input type="number" step="0.01" id="uniforms_epis" name="uniforms_epis" value={formData.uniforms_epis} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="disposable_materials">Materiais Descartáveis (R$)</Label>
              <Input type="number" step="0.01" id="disposable_materials" name="disposable_materials" value={formData.disposable_materials} onChange={handleChange} />
            </div>
            <div>
              <Label htmlFor="other_materials">Outros Materiais (R$)</Label>
              <Input type="number" step="0.01" id="other_materials" name="other_materials" value={formData.other_materials} onChange={handleChange} />
            </div>
            <div>
              <Label>Total de Materiais (R$)</Label>
              <div className="p-2 bg-card border border-border rounded font-semibold text-blue-700 dark:text-blue-400">{formatCurrency(formData.total_materials)}</div>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-3">Resumo Calculado</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Total de Custos</Label>
              <div className="p-2 bg-card border border-border rounded text-lg font-bold text-red-600">{formatCurrency(formData.total_costs)}</div>
            </div>
            <div>
              <Label>Receita Líquida</Label>
              <div className="p-2 bg-card border border-border rounded text-lg font-bold text-green-600">{formatCurrency(formData.net_revenue)}</div>
            </div>
            <div>
              <Label>Resultado Final</Label>
              <div className={`p-2 bg-card border border-border rounded text-lg font-bold ${formData.final_result >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(formData.final_result)}</div>
            </div>
          </div>
        </div>

        {/* Observações */}
        <div>
          <Label htmlFor="observations">Observações</Label>
          <Textarea id="observations" name="observations" value={formData.observations} onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))} rows={3} />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={() => onSaveSuccess()} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSaving}>
            {isSaving ? (editingEntry ? 'Atualizando...' : 'Salvando...') : (editingEntry ? 'Salvar Alterações' : 'Cadastrar Lançamento')}
          </Button>
        </div>
      </form>
    );
  };

  const TaxExcessForm = ({ user }) => {
    const [excessData, setExcessData] = useState({
      reference_month: "",
      inss: 0, irrf: 0, iss: 0, csll: 0, pis: 0, cofins: 0,
      total_excess: 0, observations: ""
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleExcessChange = (e) => {
      const { name, value } = e.target;
      let newData = { ...excessData, [name]: name === 'reference_month' ? value : Number(value) || 0 };

      const { inss, irrf, iss, csll, pis, cofins } = newData;
      newData.total_excess = (inss || 0) + (irrf || 0) + (iss || 0) + (csll || 0) + (pis || 0) + (cofins || 0);

      setExcessData(newData);
    };

    const handleExcessSubmit = async (e) => {
      e.preventDefault();

      if (!excessData.reference_month) {
        alert("Por favor, selecione o mês/ano de referência.");
        return;
      }

      setIsSaving(true);
      try {
        const dataToSave = {
          ...excessData,
          cnpj: user.cnpj
        };
        console.log("Dados de impostos excedentes que serão salvos:", dataToSave);

        const savedExcess = await TaxExcess.create(dataToSave);
        console.log("Impostos excedentes salvos com sucesso:", savedExcess);

        await loadData();
        setIsTaxExcessOpen(false);
        alert("Impostos excedentes registrados com sucesso!");

        setExcessData({
          reference_month: "",
          inss: 0, irrf: 0, iss: 0, csll: 0, pis: 0, cofins: 0,
          total_excess: 0, observations: ""
        });

      } catch (error) {
        console.error("Erro detalhado ao salvar impostos excedentes:", error);
        alert(`Erro ao salvar impostos excedentes: ${error.message || 'Erro desconhecido'}`);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <form onSubmit={handleExcessSubmit} className="space-y-6">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <h3 className="font-semibold text-red-900 dark:text-red-300 mb-3">Impostos Excedentes (Contabilidade)</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="excess_month">Mês/Ano de Referência *</Label>
              <Input
                type="month"
                id="excess_month"
                name="reference_month"
                value={excessData.reference_month}
                onChange={handleExcessChange}
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
          <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-3">Valores Adicionais (R$)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['inss', 'irrf', 'iss', 'csll', 'pis', 'cofins'].map(tax => (
              <div key={tax}>
                <Label htmlFor={tax}>{tax.toUpperCase()} (R$)</Label>
                <Input type="number" step="0.01" id={tax} name={tax} value={excessData[tax]} onChange={handleExcessChange} />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Label>Total dos Impostos Excedentes</Label>
            <div className="p-2 bg-card border border-border rounded text-lg font-bold text-red-600">
              {formatCurrency(excessData.total_excess || 0)}
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="excess_observations">Observações</Label>
          <Textarea
            id="excess_observations"
            name="observations"
            value={excessData.observations}
            onChange={handleExcessChange}
            rows={3}
            placeholder="Informações da contabilidade..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={() => setIsTaxExcessOpen(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" variant="destructive" disabled={isSaving}>
            {isSaving ? 'Registrando...' : 'Registrar Impostos'}
          </Button>
        </div>
      </form>
    );
  };

  const FinancialViewModal = ({ entry, contracts, isOpen, onClose }) => {
    if (!entry) return null;

    const contract = contracts.find(c => c.id === entry.contract_id);

    const renderField = (label, value, isCurrency = false, className = "") => (
      <div>
        <Label>{label}</Label>
        <p className={`text-sm text-foreground ${className}`}>{isCurrency ? formatCurrency(value) : (value === null || value === undefined || value === "") ? "-" : value}</p>
      </div>
    );

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Visualizar Lançamento Financeiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">Identificação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Contrato", contract?.name || 'Contrato não encontrado')}
                {renderField("Mês/Ano de Referência", entry.reference_month)}
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">Receitas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Faturamento Bruto", entry.gross_revenue, true, "text-lg font-bold text-green-700 dark:text-green-400")}
                {renderField("Receita Líquida", entry.net_revenue, true, "text-lg font-bold text-green-700 dark:text-green-400")}
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 rounded-lg">
              <h3 className="font-semibold text-red-900 dark:text-red-300 mb-3">Impostos e Retenções</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['inss', 'irrf', 'iss', 'pis', 'cofins', 'csll'].map(tax => (
                  <div key={tax}>
                    <Label>{tax.toUpperCase()}</Label>
                    <p className="text-sm font-medium text-foreground">
                      {entry[`${tax}_percentage`]}% = {formatCurrency(entry[`${tax}_value`])}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-3">Conta Vinculada</h3>
              <p className="text-lg font-bold text-foreground">{entry.linked_account_percentage}% = {formatCurrency(entry.linked_account_value)}</p>
              <p className="text-sm text-muted-foreground">Calculado a partir: {entry.calculated_from === "percent" ? "Percentual" : "Valor"}</p>
            </div>

            <div className="bg-muted/50 border border-border p-4 rounded-lg">
              <h3 className="font-semibold text-foreground mb-3">Custos</h3>
              <div className="grid grid-cols-2 gap-4">
                {renderField("Folha de Pagamento", entry.payroll_cost, true)}
                {renderField("Encargos Sociais", entry.social_charges_cost, true)}
                {renderField("Vale Alimentação", entry.meal_allowance_cost, true)}
                {renderField("Vale Transporte", entry.transport_allowance_cost, true)}
                {renderField("Outros Custos Operacionais", entry.other_costs, true)}
                {renderField("Produtos de Limpeza", entry.cleaning_products, true)}
                {renderField("Equipamentos/Ferramentas", entry.equipment_tools, true)}
                {renderField("Uniformes/EPIs", entry.uniforms_epis, true)}
                {renderField("Materiais Descartáveis", entry.disposable_materials, true)}
                {renderField("Outros Materiais", entry.other_materials, true)}
                {renderField("Total de Materiais", entry.total_materials, true)}
                {renderField("Total de Custos", entry.total_costs, true, "font-bold text-red-600")}
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-3">Resultado Final</h3>
              <p className={`text-2xl font-bold ${entry.final_result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(entry.final_result)}
              </p>
            </div>

            {entry.observations && (
              <div>
                <Label>Observações</Label>
                <p className="text-sm text-foreground bg-muted/50 p-3 rounded border border-border">{entry.observations}</p>
              </div>
            )}
            <div className="text-right text-xs text-muted-foreground">
              Última Alteração: {entry.updated_by || entry.created_by} em {format(new Date(entry.updated_date || entry.created_date), "dd/MM/yy HH:mm")}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const handleFinancialSaveSuccess = async () => {
    console.log("🔄 Executando recarregamento completo dos dados financeiros...");
    try {
      await loadData();
      console.log("✅ Dados financeiros recarregados com sucesso");
      setIsFormOpen(false);
      setEditingEntry(null);
    } catch (error) {
      console.error("❌ Erro ao recarregar dados:", error);
    }
  };

  const filteredFinancialData = useMemo(() => {
    return financialData.filter(entry => {
      const contract = contracts.find(c => c.id === entry.contract_id);

      const contractMatch = filterContract === "all" || entry.contract_id === filterContract;

      const m = entry.reference_month || "";
      let periodMatch = true;
      if (filterFromMonth && filterToMonth) {
        periodMatch = m >= filterFromMonth && m <= filterToMonth;
      } else if (filterFromMonth) {
        periodMatch = m >= filterFromMonth;
      } else if (filterToMonth) {
        periodMatch = m <= filterToMonth;
      } else if (filterMonth) {
        periodMatch = m === filterMonth;
      }

      const unitMatch = filterUnit === "all" || (contract?.unidade && contract.unidade === filterUnit);
      const respMatch = filterResponsible === "all" || (contract?.apoio_administrativo && contract.apoio_administrativo === filterResponsible);

      const result = entry.final_result || 0;
      const resultMatch = filterResult === "all" || (filterResult === "profit" ? result >= 0 : result < 0);

      const s = searchTerm.trim().toLowerCase();
      const searchMatch = s === "" ||
        (contract?.name?.toLowerCase().includes(s)) ||
        (entry.observations?.toLowerCase().includes(s));

      return contractMatch && periodMatch && unitMatch && respMatch && resultMatch && searchMatch;
    });
  }, [financialData, contracts, filterContract, filterMonth, filterFromMonth, filterToMonth, filterUnit, filterResponsible, filterResult, searchTerm]);


  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-lg w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
          </div>
          <div className="h-10 bg-muted rounded-lg" />
          <div className="h-10 bg-muted rounded-lg" />
          <div className="h-10 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe receitas, custos e resultados por contrato</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isTaxExcessOpen} onOpenChange={setIsTaxExcessOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30">
                <AlertTriangle className="w-4 h-4" />
                Impostos Excedentes
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">Impostos Excedentes da Contabilidade</DialogTitle>
              </DialogHeader>
              <TaxExcessForm user={user} />
            </DialogContent>
          </Dialog>

          {canEdit && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => setEditingEntry(null)}>
                  <Plus className="w-4 h-4" />
                  Novo Lançamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-card">
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    {editingEntry ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
                  </DialogTitle>
                </DialogHeader>
                <FinancialForm
                  user={user}
                  contracts={contracts}
                  onSaveSuccess={handleFinancialSaveSuccess}
                  editingEntry={editingEntry}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Receita Total</p>
                <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(dashboardData.totalRevenue)}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Custos Totais</p>
                <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(dashboardData.totalCosts)}</p>
              </div>
              <TrendingDown className="w-6 h-6 text-red-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Conta Vinculada</p>
                <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(dashboardData.linkedAccount)}</p>
              </div>
              <DollarSign className="w-6 h-6 text-amber-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-card border-border border-l-4 shadow-sm ${dashboardData.netProfit >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Lucro Líquido</p>
                <p className={`text-xl font-bold mt-1 ${dashboardData.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(dashboardData.netProfit)}
                </p>
              </div>
              <Calculator className="w-6 h-6 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cashflow Forecast */}
      <CashflowForecast entries={financialData} />

      {/* Financial Entries Table */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Filter className="w-5 h-5 text-muted-foreground" />
                Lançamentos Registrados
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 ml-1">
                  {filteredFinancialData.length}
                </Badge>
              </CardTitle>
              <div className="hidden lg:flex gap-2">
                <Select value={filterContract} onValueChange={setFilterContract}>
                  <SelectTrigger className="w-48 bg-background border-border">
                    <SelectSelectValue placeholder="Todos os contratos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os contratos</SelectItem>
                    {contracts.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => {
                    setFilterMonth(e.target.value);
                    setFilterFromMonth("");
                    setFilterToMonth("");
                  }}
                  className="w-40 bg-background border-border"
                  placeholder="Mês exato"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
              <div className="flex gap-2 col-span-1 md:col-span-2 lg:col-span-1">
                <Input
                  type="month"
                  value={filterFromMonth}
                  onChange={(e) => {
                    setFilterFromMonth(e.target.value);
                    setFilterMonth("");
                  }}
                  className="w-full bg-background border-border"
                  placeholder="De"
                />
                <Input
                  type="month"
                  value={filterToMonth}
                  onChange={(e) => {
                    setFilterToMonth(e.target.value);
                    setFilterMonth("");
                  }}
                  className="w-full bg-background border-border"
                  placeholder="Até"
                />
              </div>

              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectSelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {unitOptions.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterResponsible} onValueChange={setFilterResponsible}>
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectSelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  {responsibleOptions.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterResult} onValueChange={setFilterResult}>
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectSelectValue placeholder="Resultado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="profit">Lucro</SelectItem>
                  <SelectItem value="loss">Prejuízo</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-9 bg-background border-border"
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setFilterContract("all");
                  setFilterMonth("");
                  setFilterFromMonth("");
                  setFilterToMonth("");
                  setFilterUnit("all");
                  setFilterResponsible("all");
                  setFilterResult("all");
                  setSearchTerm("");
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg border-t border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Contrato</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Unidade</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Responsável</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Mês/Ano</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Rec. Bruta</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Rec. Líquida</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Custos</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Resultado</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Alteração</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFinancialData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <DollarSign className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum lançamento encontrado</h3>
                        <p className="text-muted-foreground text-sm mb-4">Ajuste os filtros ou cadastre um novo lançamento</p>
                        {canEdit && (
                          <Button className="gap-2" onClick={() => { setEditingEntry(null); setIsFormOpen(true); }}>
                            <Plus className="w-4 h-4" /> Novo Lançamento
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFinancialData.map((entry) => {
                    const contract = contracts.find(c => c.id === entry.contract_id);
                    return (
                      <TableRow key={entry.id} className="border-border hover:bg-muted/30 transition-colors cursor-pointer">
                        <TableCell className="font-medium text-foreground">
                          {contract?.name || 'Contrato não encontrado'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{contract?.unidade || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{contract?.apoio_administrativo || '-'}</TableCell>
                        <TableCell className="text-foreground">{entry.reference_month}</TableCell>
                        <TableCell className="text-foreground">{formatCurrency(entry.gross_revenue)}</TableCell>
                        <TableCell className="text-green-600 font-medium">{formatCurrency(entry.net_revenue)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(entry.total_costs)}</TableCell>
                        <TableCell>
                          <Badge className={`border-0 ${
                            (entry.final_result || 0) >= 0
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {formatCurrency(entry.final_result)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span>{entry.updated_by || entry.created_by}</span>
                            <span className="text-xs">{format(new Date(entry.updated_date || entry.created_date), "dd/MM/yy HH:mm")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewEntry(entry)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              {canEdit && (
                                <DropdownMenuItem onClick={() => handleEditEntry(entry)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              )}
                              {canEdit && (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Modal */}
      <FinancialViewModal
        entry={viewingEntry}
        contracts={contracts}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingEntry(null);
        }}
      />

      {/* Tax Summary */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Resumo de Impostos e Retenções</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {['inss', 'irrf', 'iss', 'pis', 'cofins', 'csll'].map(tax => {
              const regularTotal = financialData.reduce((sum, entry) => sum + (entry[`${tax}_value`] || 0), 0);
              const excessTotal = taxExcesses.reduce((sum, excess) => sum + (excess[tax] || 0), 0);
              const total = regularTotal + excessTotal;

              return (
                <div key={tax} className="text-center p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="text-lg font-bold text-red-600">
                    {formatCurrency(total)}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">{tax}</div>
                  {excessTotal > 0 && (
                    <div className="text-xs text-amber-600 mt-1">
                      +{formatCurrency(excessTotal)}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="text-center p-3 rounded-lg bg-muted/50 border border-border">
              <div className="text-lg font-bold text-amber-600">
                {formatCurrency(dashboardData.linkedAccount)}
              </div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">VINCULADA</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Risk Table */}
      <ContractRiskTable contracts={contracts} measurements={[]} entries={financialData} />
    </div>
  );
}
