import React, { useState, useEffect, useCallback } from "react";
import { IndirectCost } from "@/entities/IndirectCost";
import { Contract } from "@/entities/Contract";
import { User } from "@/entities/User"; // Added import for User entity
import { canEditPage } from "@/components/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Calculator, TrendingUp, AlertCircle, Trash2 } from "lucide-react";

export default function IndirectCostsPage() {
  const [indirectCosts, setIndirectCosts] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [totalCosts, setTotalCosts] = useState(0);
  const [percentageOverRevenue, setPercentageOverRevenue] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [user, setUser] = useState(null); // Added user state
  const canEdit = canEditPage(user?.department, 'IndirectCosts');

  const calculateTotals = useCallback((costs, contractList) => {
    // Calcular faturamento mensal dos contratos ativos
    // Contracts are already filtered by status 'ativo' in loadData
    const revenue = contractList.reduce((sum, contract) => sum + (contract.monthly_value || 0), 0);
    
    // Calcular total de custos indiretos
    const costsTotal = costs.reduce((sum, cost) => sum + (cost.amount || 0), 0);
    
    // Calcular percentual sobre faturamento
    const percentage = revenue > 0 ? (costsTotal / revenue) * 100 : 0;
    
    setMonthlyRevenue(revenue);
    setTotalCosts(costsTotal);
    setPercentageOverRevenue(percentage);
  }, []); // Dependencies are empty as it only uses its arguments and setters

  const loadData = useCallback(async () => {
    try {
      const currentUser = await User.me(); // Fetch current user
      setUser(currentUser); // Set user state

      const [costsData, contractsData] = await Promise.all([
        IndirectCost.filter({ cnpj: currentUser.cnpj }, "-created_at"), // Filter IndirectCosts by user's CNPJ
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' }) // Filter Contracts by user's CNPJ and status
      ]);
      setIndirectCosts(costsData);
      setContracts(contractsData);
      calculateTotals(costsData, contractsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  }, [calculateTotals]); // Depends on calculateTotals

  useEffect(() => {
    loadData();
  }, [loadData]); // Depends on loadData

  const CostForm = ({ cnpj }) => { // Added cnpj prop
    const [formData, setFormData] = useState({
      category: "outros",
      description: "",
      amount: 0,
      competence_month: ""
    });

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: name === 'amount' ? Number(value) : value
      }));
    };

    const handleSelectChange = (name, value) => {
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        if (!cnpj) { // Check if CNPJ is available
          alert("Não foi possível identificar o CNPJ da empresa. Tente recarregar a página.");
          return;
        }
        await IndirectCost.create({ ...formData, cnpj }); // Add cnpj to the form data
        loadData();
        setIsFormOpen(false);
        setFormData({
          category: "outros",
          description: "",
          amount: 0,
          competence_month: ""
        });
        alert("Custo indireto adicionado com sucesso!");
      } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao adicionar custo indireto.");
      }
    };

    const costTypes = {
      aluguel: "Aluguel/Financiamento",
      energia: "Energia Elétrica",
      internet: "Internet/Telefone",
      salarios: "Salários + Encargos",
      marketing: "Marketing/Publicidade",
      contador: "Contador/Jurídico",
      sistemas: "Sistemas/Software",
      depreciacao: "Depreciação de Ativos",
      outros: "Outros Custos"
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="font-semibold text-orange-900 mb-3">💰 Novo Custo Indireto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Custo *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => handleSelectChange("category", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(costTypes).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Valor Mensal (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder="Descreva o custo específico..."
              />
            </div>
            <div>
              <Label htmlFor="competence_month">Mês/Ano de Referência</Label>
              <Input
                type="month"
                id="competence_month"
                name="competence_month"
                value={formData.competence_month}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
            Adicionar Custo
          </Button>
        </div>
      </form>
    );
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este custo?")) {
      try {
        await IndirectCost.delete(id);
        loadData();
      } catch (error) {
        console.error("Erro ao excluir custo:", error);
      }
    }
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const costTypeLabels = {
    aluguel: "Aluguel/Financiamento",
    energia: "Energia Elétrica",
    internet: "Internet/Telefone",
    salarios: "Salários + Encargos",
    marketing: "Marketing/Publicidade",
    contador: "Contador/Jurídico",
    sistemas: "Sistemas/Software",
    depreciacao: "Depreciação de Ativos",
    outros: "Outros Custos"
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calculadora de Custos Indiretos</h1>
          <p className="text-muted-foreground">Calcule o impacto dos custos fixos sobre o lucro da empresa</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          {canEdit && (
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Custo
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Adicionar Custo Indireto</DialogTitle>
            </DialogHeader>
            <CostForm cnpj={user?.cnpj} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard de Custos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Faturamento Mensal</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(monthlyRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Contratos ativos</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Custos Fixos</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalCosts)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Custos mensais</p>
              </div>
              <Calculator className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">% sobre Faturamento</p>
                <p className={`text-2xl font-bold ${
                  percentageOverRevenue <= 20 ? 'text-green-600' :
                  percentageOverRevenue <= 35 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {percentageOverRevenue.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Impacto no lucro</p>
              </div>
              <AlertCircle className={`w-8 h-8 ${
                percentageOverRevenue <= 20 ? 'text-green-600' :
                percentageOverRevenue <= 35 ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lucro Líquido Impactado</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(monthlyRevenue - totalCosts)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Após custos fixos</p>
              </div>
              <div className="text-2xl">💰</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Performance */}
      {percentageOverRevenue > 35 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">⚠️ Alerta de Custos Elevados</h3>
                <p className="text-red-700 mt-1">
                  Seus custos indiretos representam {percentageOverRevenue.toFixed(1)}% do faturamento, 
                  o que pode impactar significativamente a rentabilidade. 
                  Considere revisar e otimizar os custos fixos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Custos - agora com rolagem horizontal e larguras mínimas */}
      <Card>
        <CardHeader>
          <CardTitle>Custos Indiretos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Tipo</TableHead>
                  <TableHead className="min-w-[260px]">Descrição</TableHead>
                  <TableHead className="min-w-[160px]">Valor Mensal</TableHead>
                  <TableHead className="min-w-[140px]">Mês/Ano</TableHead>
                  <TableHead className="min-w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indirectCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum custo indireto cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  indirectCosts.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell className="min-w-[180px]">
                        <Badge variant="outline" className="capitalize">
                          {costTypeLabels[cost.category] || cost.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[260px] font-medium">{cost.description}</TableCell>
                      <TableCell className="min-w-[160px] text-red-600 font-medium kpi-value">
                        {formatCurrency(cost.amount)}
                      </TableCell>
                      <TableCell className="min-w-[140px]">{cost.competence_month || '-'}</TableCell>
                      <TableCell className="min-w-[100px]">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cost.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Resumo por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(costTypeLabels).map(([type, label]) => {
              const categoryCosts = indirectCosts.filter(c => c.category === type);
              const categoryTotal = categoryCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
              
              if (categoryTotal === 0) return null;
              
              return (
                <div key={type} className="bg-muted/50 p-4 rounded-lg text-center">
                  <div className="text-lg font-semibold text-foreground">
                    {formatCurrency(categoryTotal)}
                  </div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {categoryCosts.length} item(s)
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}