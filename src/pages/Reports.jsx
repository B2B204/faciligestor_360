
import React, { useState, useEffect } from "react";
import { Contract } from "@/entities/Contract";
import { FinancialEntry } from "@/entities/FinancialEntry";
import { Employee } from "@/entities/Employee";
import { Tax } from "@/entities/Tax";
import { Material } from "@/entities/Material";
import { User } from "@/entities/User";
import { InvokeLLM } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Calendar, Users, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { BRAND } from "@/components/common/Branding";

export default function ReportsPage() {
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState("");
  const [reportData, setReportData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [user, setUser] = useState(null);
  const [activeReport, setActiveReport] = useState("dre");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
      // CORREÇÃO: Filtrar contratos pelo CNPJ do usuário logado
      const contractsData = await Contract.filter({ cnpj: userData.cnpj });
      setContracts(contractsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const generateReport = async () => {
    if (!selectedContract) {
      alert("Por favor, selecione um contrato.");
      return;
    }

    setIsGenerating(true);
    try {
      const [financialEntries, employees, taxes, materials] = await Promise.all([
        FinancialEntry.filter({ contract_id: selectedContract }),
        Employee.filter({ contract_id: selectedContract }),
        Tax.filter({ contract_id: selectedContract }),
        Material.filter({ contract_id: selectedContract }),
      ]);

      const contractData = contracts.find(c => c.id === selectedContract);

      setReportData({
        contract: contractData,
        financialEntries: financialEntries || [],
        employees: employees || [],
        taxes: taxes || [],
        materials: materials || [],
        generatedAt: new Date(),
        generatedBy: user?.full_name || user?.email || 'Usuário'
      });
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório. Tente novamente.");
    }
    setIsGenerating(false);
  };

  const generatePDF = async (reportType) => {
    if (!reportData) return;

    try {
      const reportContent = getReportContent(reportType);
      
      const prompt = `
        Gere um relatório profissional em HTML para impressão com os seguintes dados: ${JSON.stringify(reportContent)}.
        Use o seguinte branding:
        - Logo da empresa: ${user?.company_logo_url || ''}
        - Nome da empresa no rodapé: ${user?.company_name || `${BRAND.name}`}
        - Cor principal para títulos e detalhes: #2563eb

        O HTML deve ser bem formatado, com tabelas claras, CSS inline para compatibilidade máxima e um layout limpo.
        Inclua um cabeçalho com o logo e o título do relatório, e um rodapé com o nome da empresa e data de geração.
      `;

      const response = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            html_content: { type: "string" }
          }
        }
      });

      // Criar blob HTML e fazer download
      const htmlContent = response.html_content;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}_${reportData.contract.name}_${format(new Date(), 'yyyy-MM-dd')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    }
  };

  const getReportContent = (reportType) => {
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const revenue = reportData.financialEntries.reduce((sum, item) => sum + (item.net_revenue || 0), 0);
    const personnelCost = reportData.employees.reduce((sum, item) => sum + (item.total_cost || 0), 0);
    const materialCost = reportData.materials.reduce((sum, item) => sum + (item.monthly_value || 0), 0);
    const totalTaxes = reportData.taxes.reduce((sum, item) => 
      sum + (item.inss || 0) + (item.irrf || 0) + (item.iss || 0) + 
      (item.csll || 0) + (item.pis || 0) + (item.cofins || 0), 0);

    return {
      contract: reportData.contract,
      revenue: formatCurrency(revenue),
      personnelCost: formatCurrency(personnelCost),
      materialCost: formatCurrency(materialCost),
      totalTaxes: formatCurrency(totalTaxes),
      netProfit: formatCurrency(revenue - personnelCost - materialCost - totalTaxes),
      employees: reportData.employees,
      generatedBy: reportData.generatedBy,
      generatedAt: format(reportData.generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: pt })
    };
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const DREReport = () => {
    if (!reportData) return null;

    const revenue = reportData.financialEntries.reduce((sum, item) => sum + (item.net_revenue || 0), 0);
    const personnelCost = reportData.employees.reduce((sum, item) => sum + (item.total_cost || 0), 0);
    const materialCost = reportData.materials.reduce((sum, item) => sum + (item.monthly_value || 0), 0);
    const totalCost = personnelCost + materialCost;
    const totalTaxes = reportData.taxes.reduce((sum, item) => 
      sum + (item.inss || 0) + (item.irrf || 0) + (item.iss || 0) + 
      (item.csll || 0) + (item.pis || 0) + (item.cofins || 0), 0);
    const netProfit = revenue - totalCost - totalTaxes;
    const margin = revenue > 0 ? ((netProfit / revenue) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-xl font-bold text-blue-900 mb-2">
            DRE - {reportData.contract?.name}
          </h3>
          <p className="text-sm text-blue-700">
            Gerado por: {reportData.generatedBy} | {format(reportData.generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(revenue)}</div>
              <p className="text-sm text-muted-foreground">Receita Líquida Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-red-600" />
                Custos Totais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalCost)}</div>
              <p className="text-sm text-muted-foreground">Pessoal + Materiais</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Demonstração do Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">Receita Líquida</span>
                <span className="text-green-600 font-bold">{formatCurrency(revenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="ml-4">(-) Custo com Pessoal</span>
                <span className="text-red-600">{formatCurrency(personnelCost)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="ml-4">(-) Custo com Materiais</span>
                <span className="text-red-600">{formatCurrency(materialCost)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b font-semibold">
                <span>= Lucro Bruto</span>
                <span className={revenue - totalCost >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(revenue - totalCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="ml-4">(-) Impostos e Retenções</span>
                <span className="text-red-600">{formatCurrency(totalTaxes)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-t-2 border-border text-xl font-bold">
                <span>LUCRO LÍQUIDO</span>
                <span className={netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Margem Líquida</span>
                <span className={margin >= 15 ? "text-green-600" : "text-yellow-600"}>
                  {margin.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const PersonnelReport = () => {
    if (!reportData) return null;

    const totalSalaries = reportData.employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    const totalCosts = reportData.employees.reduce((sum, emp) => sum + (emp.total_cost || 0), 0);

    return (
      <div className="space-y-6">
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-xl font-bold text-purple-900 mb-2">
            Relatório de Pessoal - {reportData.contract?.name}
          </h3>
          <p className="text-sm text-purple-700">
            Gerado por: {reportData.generatedBy} | {format(reportData.generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{reportData.employees.length}</div>
              <p className="text-sm text-muted-foreground">Funcionários</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{formatCurrency(totalSalaries)}</div>
              <p className="text-sm text-muted-foreground">Total Salários</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold">{formatCurrency(totalCosts)}</div>
              <p className="text-sm text-muted-foreground">Custo Total</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Funcionário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Função</th>
                    <th className="text-right p-3">Salário</th>
                    <th className="text-right p-3">Benefícios</th>
                    <th className="text-right p-3">Custo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employees.map((emp, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-3 font-medium">{emp.name}</td>
                      <td className="p-3">{emp.role}</td>
                      <td className="p-3 text-right">{formatCurrency(emp.salary)}</td>
                      <td className="p-3 text-right">
                        {formatCurrency((emp.meal_allowance || 0) + (emp.transport_allowance || 0))}
                      </td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(emp.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const TaxReport = () => {
    if (!reportData) return null;

    const totalTaxes = reportData.taxes.reduce((sum, item) => 
      sum + (item.inss || 0) + (item.irrf || 0) + (item.iss || 0) + 
      (item.csll || 0) + (item.pis || 0) + (item.cofins || 0), 0);

    return (
      <div className="space-y-6">
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-xl font-bold text-red-900 mb-2">
            Relatório de Impostos - {reportData.contract?.name}
          </h3>
          <p className="text-sm text-red-700">
            Gerado por: {reportData.generatedBy} | {format(reportData.generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Total de Impostos e Retenções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 mb-4">
              {formatCurrency(totalTaxes)}
            </div>
            {reportData.taxes.length > 0 ? (
              <div className="space-y-3">
                {reportData.taxes.map((tax, index) => (
                  <div key={index} className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      Referência: {tax.reference_month || format(new Date(tax.payment_date), 'MM/yyyy')}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>INSS: {formatCurrency(tax.inss)}</div>
                      <div>IRRF: {formatCurrency(tax.irrf)}</div>
                      <div>ISS: {formatCurrency(tax.iss)}</div>
                      <div>CSLL: {formatCurrency(tax.csll)}</div>
                      <div>PIS: {formatCurrency(tax.pis)}</div>
                      <div>COFINS: {formatCurrency(tax.cofins)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum imposto registrado para este contrato.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const ExecutiveReport = () => {
    if (!reportData) return null;

    const revenue = reportData.financialEntries.reduce((sum, item) => sum + (item.net_revenue || 0), 0);
    const costs = reportData.employees.reduce((sum, item) => sum + (item.total_cost || 0), 0) +
                  reportData.materials.reduce((sum, item) => sum + (item.monthly_value || 0), 0);
    const taxes = reportData.taxes.reduce((sum, item) => 
      sum + (item.inss || 0) + (item.irrf || 0) + (item.iss || 0) + 
      (item.csll || 0) + (item.pis || 0) + (item.cofins || 0), 0);
    const profit = revenue - costs - taxes;
    const margin = revenue > 0 ? ((profit / revenue) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Resumo Executivo - {reportData.contract?.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerado por: {reportData.generatedBy} | {format(reportData.generatedAt, "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <div className="text-2xl font-bold text-green-600">{formatCurrency(revenue)}</div>
              <p className="text-sm text-muted-foreground">Faturamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <DollarSign className="w-8 h-8 text-red-600 mx-auto mb-3" />
              <div className="text-2xl font-bold text-red-600">{formatCurrency(costs)}</div>
              <p className="text-sm text-muted-foreground">Custos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 text-orange-600 mx-auto mb-3" />
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(taxes)}</div>
              <p className="text-sm text-muted-foreground">Impostos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(profit)}
              </div>
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Análise de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Margem de Lucro:</span>
                <span className={`font-bold ${margin >= 15 ? 'text-green-600' : margin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {margin.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Funcionários Ativos:</span>
                <span className="font-semibold">{reportData.employees.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Custo Médio por Funcionário:</span>
                <span className="font-semibold">
                  {reportData.employees.length > 0 ? formatCurrency(costs / reportData.employees.length) : formatCurrency(0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Gere e exporte relatórios financeiros e de pessoal por contrato.</p>
      </div>
      {/* Controles */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-6 h-6 mr-2" />
            Gerador de Relatórios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Selecione o Contrato</label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um contrato..." />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateReport} disabled={isGenerating || !selectedContract}>
              {isGenerating ? "Gerando..." : "Gerar Relatório"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relatórios */}
      {reportData && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Relatórios Disponíveis</CardTitle>
              <Button 
                variant="outline" 
                onClick={() => generatePDF(activeReport)}
                className="flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar HTML
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeReport} onValueChange={setActiveReport}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="dre">DRE</TabsTrigger>
                <TabsTrigger value="personnel">Pessoal</TabsTrigger>
                <TabsTrigger value="taxes">Impostos</TabsTrigger>
                <TabsTrigger value="executive">Executivo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="dre" className="mt-6">
                <DREReport />
              </TabsContent>
              
              <TabsContent value="personnel" className="mt-6">
                <PersonnelReport />
              </TabsContent>
              
              <TabsContent value="taxes" className="mt-6">
                <TaxReport />
              </TabsContent>
              
              <TabsContent value="executive" className="mt-6">
                <ExecutiveReport />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

