import React, { useState, useEffect } from "react";
import { Contract } from "@/entities/Contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus, MoreVertical, Edit, Trash2, ExternalLink, Search, FileText, History
} from "lucide-react";
import { format } from "date-fns";
import ContractForm from "../components/contracts/ContractForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { User } from "@/entities/User";
import { canEditPage } from "@/components/permissions";
import { recordContractVersion } from "@/lib/contractVersioning";
import ContractHistoryDialog from "@/components/contracts/ContractHistoryDialog";
import { instantiateTemplateForContract } from "@/lib/taskTemplateEngine";

const planLimits = {
  essencial: { contracts: 10, users: 5 },
  avancado: { contracts: 20, users: 10 },
  pro: { contracts: Infinity, users: Infinity }
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [effectivePlan, setEffectivePlan] = useState('none');
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [historyContract, setHistoryContract] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      // Determine effective plan: team members inherit owner's plan
      let plan = currentUser.plan || 'none';
      if (currentUser.department !== 'admin') {
        try {
          const owners = await User.filter({ cnpj: currentUser.cnpj, department: 'admin' });
          if (owners && owners.length) plan = owners[0].plan || 'none';
        } catch (e) {}
      }
      setEffectivePlan(plan);
      // Only fetch contracts that are not soft-deleted
      const data = await Contract.filter({ cnpj: currentUser.cnpj, deleted_at: null }, "-created_date");
      setContracts(data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  const handleSave = async (formData) => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      const currentPlan = effectivePlan || 'none';
      const planLimit = planLimits[currentPlan]?.contracts;

      if (!selectedContract && planLimit !== Infinity && contracts.length >= planLimit) {
        alert(`Você atingiu o limite de ${planLimit} contratos do seu plano. Faça um upgrade para adicionar mais.`);
        setIsSaving(false);
        return;
      }

      const dataToSave = {
        ...formData,
        cnpj: user.cnpj,
        ...(selectedContract ? { updated_by: user.email } : { created_by: user.email })
      };

      if (selectedContract) {
        await Contract.update(selectedContract.id, dataToSave);
        await recordContractVersion({
          contractId: selectedContract.id,
          cnpj: user.cnpj,
          changedBy: user.email,
          before: selectedContract,
          after: { ...selectedContract, ...dataToSave },
        });
        setSaveMessage("Contrato atualizado com sucesso!");
      } else {
        const created = await Contract.create(dataToSave);
        await recordContractVersion({
          contractId: created.id,
          cnpj: user.cnpj,
          changedBy: user.email,
          after: created,
          isCreation: true,
        });

        if (created.task_template_id) {
          try {
            await instantiateTemplateForContract({
              contractId: created.id,
              templateId: created.task_template_id,
              contractStartDate: created.start_date,
              cnpj: user.cnpj,
              actorEmail: user.email,
            });
          } catch (templateError) {
            console.error("Erro ao criar tarefas a partir do modelo:", templateError);
          }
        }

        setSaveMessage("Contrato cadastrado com sucesso!");
      }

      await loadData();

      setTimeout(() => {
        setIsFormOpen(false);
        setSelectedContract(null);
        setSaveMessage("");
      }, 2000);

    } catch (error) {
      console.error("Erro ao salvar contrato:", error);
      alert("Erro ao salvar contrato. Verifique se todos os campos obrigatórios foram preenchidos corretamente.");
    }
    setIsSaving(false);
  };

  const handleEdit = (contract) => {
    setSelectedContract(contract);
    setIsFormOpen(true);
  };

  const handleCreateNew = () => {
    const currentPlan = effectivePlan || 'none';
    const planLimit = planLimits[currentPlan]?.contracts;

    if (planLimit !== Infinity && contracts.length >= planLimit) {
      alert(`Você atingiu o limite de ${planLimit} contratos do seu plano. Faça um upgrade para adicionar mais.`);
      return;
    }

    setSelectedContract(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (contract) => {
    if (window.confirm("Tem certeza que deseja excluir este contrato?") && window.confirm("Confirma a exclusão? O contrato irá para a Lixeira e poderá ser restaurado.")) {
      try {
        const patch = {
          deleted_at: new Date().toISOString(),
          deleted_by: user.email,
          updated_by: user.email,
          status: 'inativo'
        };
        await Contract.update(contract.id, patch);
        await recordContractVersion({
          contractId: contract.id,
          cnpj: user.cnpj,
          changedBy: user.email,
          before: contract,
          after: { ...contract, ...patch },
        });

        await loadData();
        alert("Contrato excluído (enviado para a Lixeira) com sucesso!");
      } catch (error) {
        console.error("Erro ao excluir contrato:", error);
        alert("Erro ao excluir contrato.");
      }
    }
  };

  const filteredContracts = contracts.filter((c) => {
    const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contract_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesService = serviceFilter === "all" || c.service_type === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  // Paginação derivada
  const totalContracts = filteredContracts.length;
  const totalPages = Math.max(1, Math.ceil(totalContracts / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const pageContracts = filteredContracts.slice(startIdx, startIdx + pageSize);

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const serviceTypes = {
    limpeza: "Limpeza",
    portaria: "Portaria",
    manutencao: "Manutenção",
    seguranca: "Segurança",
    jardinagem: "Jardinagem",
    ar_condicionado: "Ar-condicionado",
    obras: "Obras",
    copeiragem: "Copeiragem",
    garcom: "Garçom",
    administrativo: "Administrativo",
    outros: "Outros"
  };

  const userRole = user?.department || 'comercial';
  const canEdit = canEditPage(userRole, 'Contracts');

  const activeContracts = contracts.filter((c) => c.status === 'ativo').length;
  const totalMonthly = contracts.reduce((sum, c) => sum + (c.monthly_value || 0), 0);
  const totalAnnual = contracts.reduce((sum, c) => sum + (c.annual_value || 0), 0);

  const getStatusBadge = (status) => {
    if (status === 'ativo') return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 capitalize">Ativo</Badge>;
    if (status === 'inativo') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 capitalize">Inativo</Badge>;
    if (status === 'suspenso') return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 capitalize">Suspenso</Badge>;
    return <Badge variant="secondary" className="capitalize">{status}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus contratos de prestação de serviços</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreateNew} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Contrato
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-card">
                <DialogHeader>
                  <DialogTitle className="text-foreground">{selectedContract ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
                </DialogHeader>
                <ContractForm
                  contract={selectedContract}
                  onSave={handleSave}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setSelectedContract(null);
                  }}
                  isSaving={isSaving}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total de Contratos</p>
            <p className="text-2xl font-bold text-foreground mt-1">{contracts.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ativos</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{activeContracts}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Receita Mensal</p>
            <p className="text-2xl font-bold text-blue-600 mt-1 text-sm leading-tight">{formatCurrency(totalMonthly)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-purple-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Receita Anual</p>
            <p className="text-2xl font-bold text-purple-600 mt-1 text-sm leading-tight">{formatCurrency(totalAnnual)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Success Message */}
      {saveMessage && (
        <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 text-green-800 dark:text-green-400 px-4 py-3 rounded-lg text-center text-sm font-medium">
          {saveMessage}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-background border-border"
            placeholder="Buscar por nome, cliente ou número..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-36 bg-background border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="suspenso">Suspenso</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-44 bg-background border-border">
            <SelectValue placeholder="Tipo de serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os serviços</SelectItem>
            {Object.entries(serviceTypes).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[200px]">Número & Cliente</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[180px]">Nome do Contrato</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[140px]">Tipo de Serviço</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[110px]">Status</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[140px]">Valor Mensal</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[140px]">Valor Anual</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[110px]">Funcionários</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[130px]">Início</TableHead>
              <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider min-w-[90px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12">
                  <div className="animate-pulse space-y-3 px-4">
                    <div className="h-8 bg-muted rounded-lg" />
                    <div className="h-8 bg-muted rounded-lg" />
                    <div className="h-8 bg-muted rounded-lg" />
                  </div>
                </TableCell>
              </TableRow>
            ) : pageContracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum contrato encontrado</h3>
                    <p className="text-muted-foreground text-sm mb-4">Ajuste os filtros ou adicione um novo contrato</p>
                    {canEdit && (
                      <Button onClick={handleCreateNew} className="gap-2">
                        <Plus className="w-4 h-4" /> Novo Contrato
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageContracts.map((contract) => (
                <TableRow key={contract.id} className="border-border hover:bg-muted/30 transition-colors cursor-pointer">
                  <TableCell className="align-middle">
                    <div>
                      <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 px-2 py-0.5 text-xs font-mono rounded mb-1 whitespace-nowrap">
                        {contract.contract_number || "N/A"}
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-normal break-words max-w-[200px]">
                        {contract.client_name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="font-medium text-foreground whitespace-normal break-words max-w-[240px]">
                      {contract.name}
                    </div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge variant="secondary" className="capitalize whitespace-nowrap">
                      {serviceTypes[contract.service_type] || contract.service_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-middle">
                    {getStatusBadge(contract.status)}
                  </TableCell>
                  <TableCell className="align-middle font-medium text-foreground whitespace-nowrap">
                    {formatCurrency(contract.monthly_value)}
                  </TableCell>
                  <TableCell className="align-middle font-medium text-green-600 whitespace-nowrap">
                    {formatCurrency(contract.annual_value)}
                  </TableCell>
                  <TableCell className="align-middle text-foreground whitespace-nowrap">
                    {contract.number_of_employees || 0}
                  </TableCell>
                  <TableCell className="align-middle text-muted-foreground text-sm whitespace-nowrap">
                    {contract.start_date ? format(new Date(contract.start_date), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell className="align-middle text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => handleEdit(contract)}>
                            <Edit className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setHistoryContract(contract)}>
                          <History className="w-4 h-4 mr-2" /> Histórico
                        </DropdownMenuItem>
                        {contract.useful_link && (
                          <DropdownMenuItem asChild>
                            <a href={contract.useful_link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" /> Abrir Link
                            </a>
                          </DropdownMenuItem>
                        )}
                        {canEdit && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(contract)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Exibindo {pageContracts.length} de {totalContracts} contratos
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Itens por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-20 bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Anterior</Button>
          <span className="px-2 text-sm text-foreground">{currentPage} / {totalPages}</span>
          <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
        </div>
      </div>

      <ContractHistoryDialog
        open={!!historyContract}
        onOpenChange={(v) => !v && setHistoryContract(null)}
        contract={historyContract}
      />
    </div>
  );
}
