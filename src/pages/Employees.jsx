import React, { useState, useEffect, useCallback } from "react";
import { Employee } from "@/entities/Employee";
import { Contract } from "@/entities/Contract";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, Upload, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import EmployeeForm from "../components/employees/EmployeeForm";
import EmployeeList from "../components/employees/EmployeeList";
import EmployeeFilters from "../components/employees/EmployeeFilters";
import CSVImport from "../components/employees/CSVImport";
import BulkUpdateForm from "../components/employees/BulkUpdateForm";

import { User } from "@/entities/User";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { canEditPage } from '@/components/permissions';
import { generateEmployeeTasks } from '@/lib/hrOnboarding';
import { logDataAccess } from '@/lib/lgpdAudit';
import { useToast } from '@/components/ui/use-toast';

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [user, setUser] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 0,
    averageSalary: 0,
    totalPayroll: 0,
    totalCharges: 0
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilteringLoading, setIsFilteringLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Paginação
  const [empPage, setEmpPage] = useState(1);
  const [empPageSize, setEmpPageSize] = useState(10);

  // Status global de visualização
  const [statusView, setStatusView] = useState('ativos');
  const [lastFilters, setLastFilters] = useState({});

  const isFerista = useCallback((emp) => {
    if (emp?.is_ferista) return true;
    const src = `${emp.role || ''} ${emp.observations || ''}`.toLowerCase();
    return src.includes('ferista');
  }, []);

  const applyStatusView = useCallback((list) => {
    switch (statusView) {
      case 'ativos':
        return list.filter(emp => emp.status === 'ativo' && !emp.dismissal_date);
      case 'demissao':
        return list.filter(emp => emp.status === 'inativo' || (emp.dismissal_date && emp.status !== 'ferias'));
      case 'ferias':
        return list.filter(emp => emp.status === 'ferias');
      case 'ferista':
        return list.filter(emp => isFerista(emp));
      case 'todos':
      default:
        return list;
    }
  }, [statusView, isFerista]);

  const applyAllFilters = useCallback((baseEmployees, filters) => {
    let filtered = [...baseEmployees];

    if (filters?.name) {
      filtered = filtered.filter(emp =>
        (emp.name || '').toLowerCase().includes(filters.name.toLowerCase())
      );
    }
    if (filters?.email) {
      filtered = filtered.filter(emp =>
        emp.email && emp.email.toLowerCase().includes(filters.email.toLowerCase())
      );
    }
    if (filters?.whatsapp) {
      filtered = filtered.filter(emp =>
        emp.whatsapp && emp.whatsapp.includes(filters.whatsapp)
      );
    }
    if (filters?.cpf) {
      filtered = filtered.filter(emp =>
        emp.cpf && emp.cpf.includes(filters.cpf.replace(/\D/g, ''))
      );
    }
    if (filters?.role) {
      filtered = filtered.filter(emp =>
        (emp.role || '').toLowerCase().includes(filters.role.toLowerCase())
      );
    }
    if (filters?.contract_id) {
      filtered = filtered.filter(emp => emp.contract_id === filters.contract_id);
    }
    if (filters?.unidade) {
      filtered = filtered.filter(emp =>
        emp.unidade && emp.unidade.toLowerCase().includes(filters.unidade.toLowerCase())
      );
    }
    if (filters?.status && ['ativo','inativo','ferias'].includes(filters.status)) {
      filtered = filtered.filter(emp => emp.status === filters.status);
    }
    if (filters?.admission_date_from) {
      filtered = filtered.filter(emp =>
        emp.admission_date && emp.admission_date >= filters.admission_date_from
      );
    }
    if (filters?.admission_date_to) {
      filtered = filtered.filter(emp =>
        emp.admission_date && emp.admission_date <= filters.admission_date_to
      );
    }
    if (filters?.dismissal_date_from) {
      filtered = filtered.filter(emp =>
        emp.dismissal_date && emp.dismissal_date >= filters.dismissal_date_from
      );
    }
    if (filters?.dismissal_date_to) {
      filtered = filtered.filter(emp =>
        emp.dismissal_date && emp.dismissal_date <= filters.dismissal_date_to
      );
    }
    if (filters?.uniform_shirt_size) {
      filtered = filtered.filter(emp => (emp.uniform_shirt_size || '').toLowerCase() === filters.uniform_shirt_size.toLowerCase());
    }
    if (filters?.uniform_pants_size) {
      filtered = filtered.filter(emp => (emp.uniform_pants_size || '').toLowerCase().includes(filters.uniform_pants_size.toLowerCase()));
    }
    if (filters?.uniform_boot_size) {
      const boot = Number(filters.uniform_boot_size) || null;
      if (boot !== null) filtered = filtered.filter(emp => Number(emp.uniform_boot_size || 0) === boot);
    }
    if (filters?.uniform_jacket_size) {
      filtered = filtered.filter(emp => (emp.uniform_jacket_size || '').toLowerCase() === filters.uniform_jacket_size.toLowerCase());
    }
    if (filters?.uniform_gloves_size) {
      filtered = filtered.filter(emp => (emp.uniform_gloves_size || '').toLowerCase() === filters.uniform_gloves_size.toLowerCase());
    }
    if (filters?.uniform_hat_size) {
      filtered = filtered.filter(emp => (emp.uniform_hat_size || '').toLowerCase() === filters.uniform_hat_size.toLowerCase());
    }
    if (filters?.missing_sizes) {
      filtered = filtered.filter(emp => {
        const req = [
          "uniform_shirt_size","uniform_pants_size","uniform_pants_modeling",
          "uniform_boot_size","uniform_jacket_size","uniform_gloves_size",
          "uniform_hat_size","uniform_notes"
        ];
        return req.some(k => {
          const v = emp[k];
          return v === undefined || v === null || (typeof v === "string" ? v.trim() === "" : v === 0);
        });
      });
    }

    filtered = applyStatusView(filtered);
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return filtered;
  }, [applyStatusView]);


  const calculateDashboard = (empList) => {
    const activeEmployees = empList.filter(emp => emp.status === 'ativo');
    const totalSalaries = activeEmployees.reduce((sum, emp) => sum + (emp.base_salary || 0), 0);
    const totalCosts = activeEmployees.reduce((sum, emp) => sum + (emp.total_cost || 0), 0);
    const totalCharges = totalCosts - totalSalaries;

    setDashboardData({
      totalEmployees: activeEmployees.length,
      averageSalary: activeEmployees.length > 0 ? totalSalaries / activeEmployees.length : 0,
      totalPayroll: totalSalaries,
      totalCharges: totalCharges
    });
  };

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const [empData, contractData] = await Promise.all([
        Employee.filter({ cnpj: currentUser.cnpj }, "-created_at"),
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' })
      ]);
      setEmployees(empData);
      setFilteredEmployees(applyAllFilters(empData, lastFilters));
      setContracts(contractData);
      calculateDashboard(empData);
      setEmpPage(1);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  }, [lastFilters, applyAllFilters]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleFiltersChange = async (filters) => {
    setIsFilteringLoading(true);
    setEmpPage(1);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      setLastFilters(filters);
      const filtered = applyAllFilters(employees, filters);
      setFilteredEmployees(filtered);
    } catch (error) {
      console.error("Erro ao aplicar filtros:", error);
    } finally {
      setIsFilteringLoading(false);
    }
  };

  useEffect(() => {
    if (employees.length > 0 || Object.keys(lastFilters).length > 0) {
      setFilteredEmployees(applyAllFilters(employees, lastFilters));
    }
  }, [statusView, employees, lastFilters, applyAllFilters]);


  const handleSuccess = () => {
    setIsFormOpen(false);
    setIsImportOpen(false);
    setIsBulkUpdateOpen(false);
    setSelectedEmployee(null);
    loadInitialData();
  };

  const normalizeCpf = (cpf) => String(cpf || '').replace(/\D/g, '');

  const handleSave = async (formData) => {
    // Validação de CPF duplicado por CNPJ — impede novo cadastro com mesmo CPF
    const newCpfDigits = normalizeCpf(formData.cpf);
    if (newCpfDigits) {
      const duplicate = employees.find((emp) => {
        const empCpfDigits = normalizeCpf(emp.cpf);
        if (!empCpfDigits) return false;
        if (empCpfDigits !== newCpfDigits) return false;
        // Ao editar, ignora o próprio registro
        if (selectedEmployee && emp.id === selectedEmployee.id) return false;
        return true;
      });
      if (duplicate) {
        toast({
          variant: 'destructive',
          title: 'CPF já cadastrado',
          description: `Já existe um funcionário cadastrado com este CPF: "${duplicate.name}" (${duplicate.cpf}). Atualize os dados do funcionário existente ao invés de criar um novo cadastro.`,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        cnpj: user.cnpj,
        created_by: selectedEmployee ? undefined : user.email,
        updated_by: selectedEmployee ? user.email : undefined,
        lgpd_consent_by: formData.lgpd_consent_at ? user.email : undefined,
      };

      let savedEmployee;
      if (selectedEmployee) {
        savedEmployee = await Employee.update(selectedEmployee.id, dataToSave);
        await logDataAccess({ user, action: 'edicao', resourceType: 'employee', resourceId: savedEmployee.id, resourceLabel: savedEmployee.name });

        const becameInactive = selectedEmployee.status !== 'inativo' && dataToSave.status === 'inativo';
        if (becameInactive) {
          await generateEmployeeTasks({
            employeeId: selectedEmployee.id,
            cnpj: user.cnpj,
            type: 'offboarding',
            userEmail: user.email,
          });
        }
      } else {
        savedEmployee = await Employee.create(dataToSave);
        await logDataAccess({ user, action: 'criacao', resourceType: 'employee', resourceId: savedEmployee.id, resourceLabel: savedEmployee.name });

        await generateEmployeeTasks({
          employeeId: savedEmployee.id,
          cnpj: user.cnpj,
          type: 'onboarding',
          userEmail: user.email,
        });
      }

      handleSuccess();
      toast({
        title: selectedEmployee ? 'Funcionário atualizado' : 'Funcionário cadastrado',
        description: selectedEmployee ? 'As alterações foram salvas com sucesso.' : 'O novo funcionário foi cadastrado com sucesso.',
      });

    } catch (error) {
      console.error("Erro ao salvar funcionário:", error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar funcionário',
        description: error.message || 'Verifique os dados e tente novamente.',
      });
    }
    setIsSaving(false);
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setIsFormOpen(true);
  };

  const handleImportSuccess = () => {
    handleSuccess();
    toast({ title: 'Importação concluída', description: 'Funcionários importados com sucesso.' });
  };

  const handleBulkUpdateSuccess = () => {
    handleSuccess();
    toast({ title: 'Atualização em massa concluída', description: 'Funcionários atualizados com sucesso.' });
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const userRole = user?.department || 'comercial';
  const canEdit = canEditPage(userRole, 'Employees');

  // Paginação derivada
  const totalEmployeesCount = filteredEmployees.length;
  const empTotalPages = Math.max(1, Math.ceil(totalEmployeesCount / empPageSize));
  const empCurrentPage = Math.min(empPage, empTotalPages);
  const empStartIdx = (empCurrentPage - 1) * empPageSize;
  const displayedEmployees = filteredEmployees.slice(empStartIdx, empStartIdx + empPageSize);

  const vacationCount = employees.filter(e => e.status === 'ferias').length;
  const inactiveCount = employees.filter(e => e.status === 'inativo').length;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-lg w-64" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
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
          <h1 className="text-2xl font-bold text-foreground">Funcionários</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie sua equipe, salários e alocações</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Status view selector */}
          <Select value={statusView} onValueChange={(v) => { setStatusView(v); setEmpPage(1); }}>
            <SelectTrigger className="w-full sm:w-52 bg-background border-border">
              <SelectValue placeholder="Exibir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Funcionários Ativos</SelectItem>
              <SelectItem value="demissao">Demissão</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="ferista">Ferista</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>

          {canEdit && (
            <>
              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={() => setIsImportOpen(true)}>
                    <Upload className="w-4 h-4" />
                    Importar CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] bg-card">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Importar Funcionários em Massa</DialogTitle>
                  </DialogHeader>
                  <CSVImport
                    contracts={contracts}
                    user={user}
                    onSuccess={handleImportSuccess}
                    onCancel={() => setIsImportOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" onClick={() => setIsBulkUpdateOpen(true)}>
                    <Users className="w-4 h-4" />
                    Atualizar em Massa
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-card">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Atualização em Massa de Funcionários</DialogTitle>
                  </DialogHeader>
                  <BulkUpdateForm
                    employees={filteredEmployees}
                    contracts={contracts}
                    onSuccess={handleBulkUpdateSuccess}
                    onCancel={() => setIsBulkUpdateOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="gap-2"
                    onClick={() => { setSelectedEmployee(null); setIsFormOpen(true); }}
                  >
                    <Plus className="w-4 h-4" />
                    Novo Funcionário
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-card">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">{selectedEmployee ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
                  </DialogHeader>
                  <EmployeeForm
                    employee={selectedEmployee}
                    contracts={contracts}
                    onSave={handleSave}
                    onCancel={() => setIsFormOpen(false)}
                    isSaving={isSaving}
                  />
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ativos</p>
            <p className="text-2xl font-bold text-foreground mt-1">{dashboardData.totalEmployees}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-green-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Salário Médio</p>
            <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(dashboardData.averageSalary)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">De Férias</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{vacationCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Inativos</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{inactiveCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports notice */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-foreground font-medium">Relatórios de RH foram movidos para a aba Relatórios.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Gere e baixe em PDF por lá.</p>
          </div>
          <Link to={createPageUrl("Reports")}>
            <Button variant="outline" className="gap-2 whitespace-nowrap">
              <FileText className="w-4 h-4" /> Abrir Relatórios
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <EmployeeFilters
        contracts={contracts}
        onFiltersChange={handleFiltersChange}
        totalResults={filteredEmployees.length}
        isLoading={isFilteringLoading}
      />

      {/* Employee List */}
      <EmployeeList
        employees={displayedEmployees}
        contracts={contracts}
        onEdit={handleEdit}
        onDataChange={loadInitialData}
        user={user}
        isLoading={isFilteringLoading}
      />

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Exibindo {displayedEmployees.length} de {totalEmployeesCount} funcionários
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Itens por página</span>
          <Select value={String(empPageSize)} onValueChange={(v) => { setEmpPageSize(Number(v)); setEmpPage(1); }}>
            <SelectTrigger className="w-20 bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={empCurrentPage === 1} onClick={() => setEmpPage(p => Math.max(1, p - 1))}>Anterior</Button>
          <span className="px-2 text-sm text-foreground">{empCurrentPage} / {empTotalPages}</span>
          <Button variant="outline" disabled={empCurrentPage === empTotalPages} onClick={() => setEmpPage(p => Math.min(empTotalPages, p + 1))}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}
