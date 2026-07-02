
import React, { useState, useEffect } from 'react';
import { Patrimony } from '@/entities/Patrimony';
import { PatrimonyMovement } from '@/entities/PatrimonyMovement';
import { Contract } from '@/entities/Contract';
import { Employee } from '@/entities/Employee';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package, Plus, Search, Eye, Edit, Trash2, AlertTriangle,
  MoreVertical, Truck, History, QrCode, ScanLine
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import PatrimonyForm from '../components/patrimony/PatrimonyForm';
import PatrimonyView from '../components/patrimony/PatrimonyView';
import PatrimonyReport from '../components/patrimony/PatrimonyReport';
import { canPerformAction } from '@/components/permissions';
import QrCodeGenerator from '../components/patrimony/QrCodeGenerator';
import AssetLookupDialog from '../components/patrimony/AssetLookupDialog';
import DepreciationTab from '../components/patrimony/DepreciationTab';
import { generateAssetCode } from '@/lib/assetTracking';
import { generateDueDepreciationEntries } from '@/lib/depreciationEngine';

export default function PatrimonyPage() {
  const [user, setUser] = useState(null);
  const [patrimonies, setPatrimonies] = useState([]);
  const [movements, setMovements] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    totalEquipments: 0,
    totalValue: 0,
    pendingReturns: 0,
    equipmentsInUse: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editingPatrimony, setEditingPatrimony] = useState(null);
  const [viewingPatrimony, setViewingPatrimony] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('equipments'); // Changed initial state to 'equipments'
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedPatrimonyForQr, setSelectedPatrimonyForQr] = useState(null);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isGeneratingDepreciation, setIsGeneratingDepreciation] = useState(false);

  const userRole = user?.department || 'operador';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [patrimonyData, contractsData, employeesData, movementsData] = await Promise.all([
        Patrimony.filter({ cnpj: currentUser.cnpj }, '-created_date'),
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' }),
        Employee.filter({ cnpj: currentUser.cnpj, status: 'ativo' }),
        PatrimonyMovement.filter({ cnpj: currentUser.cnpj }, '-created_date')
      ]);

      setPatrimonies(patrimonyData);
      setMovements(movementsData);
      setContracts(contractsData);
      setEmployees(employeesData);
      calculateDashboard(patrimonyData);

      try {
        const result = await generateDueDepreciationEntries(currentUser.cnpj);
        if (result.generated > 0) {
          const refreshed = await Patrimony.filter({ cnpj: currentUser.cnpj }, '-created_date');
          setPatrimonies(refreshed);
          calculateDashboard(refreshed);
        }
      } catch (e) {
        console.log('Falha ao gerar depreciação automática:', e);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setIsLoading(false);
  };

  const handleGenerateDepreciation = async () => {
    if (!user) return;
    setIsGeneratingDepreciation(true);
    try {
      const result = await generateDueDepreciationEntries(user.cnpj);
      await loadData();
      alert(result.generated > 0
        ? `${result.generated} lançamento(s) de depreciação gerado(s) em ${result.assetsProcessed} ativo(s).`
        : 'Nenhum lançamento pendente — a depreciação de todos os ativos já está em dia.');
    } finally {
      setIsGeneratingDepreciation(false);
    }
  };

  const calculateDashboard = (patrimoniesData) => {
    const totalEquipments = patrimoniesData.length;
    const totalValue = patrimoniesData.reduce((sum, p) => sum + (p.equipment_value || 0), 0);
    const equipmentsInUse = patrimoniesData.filter(p => p.status === 'em_uso').length;
    
    // Equipamentos com devolução atrasada
    const today = new Date();
    const pendingReturns = patrimoniesData.filter(p => 
      p.status === 'em_uso' && 
      p.expected_return_date && 
      new Date(p.expected_return_date) < today
    ).length;

    setDashboardData({
      totalEquipments,
      totalValue,
      pendingReturns,
      equipmentsInUse
    });
  };

  const handleSave = async (data) => {
    try {
      // Se 'data' for array (múltiplos equipamentos para bulk create)
      if (Array.isArray(data)) {
        const baseSeq = patrimonies.length + 1;
        const dataToSave = data.map((item, i) => ({
          ...item,
          cnpj: user.cnpj,
          qr_code: item.qr_code || generateAssetCode(baseSeq + i),
        }));
        // Assuming Patrimony.bulkCreate handles initial movement creation on backend
        await Patrimony.bulkCreate(dataToSave);
        alert(`${data.length} equipamento(s) cadastrado(s) com sucesso!`);
      } else {
        // Edição ou criação de um único equipamento
        const dataToSave = { ...data, cnpj: user.cnpj };

        if (editingPatrimony) {
          await Patrimony.update(editingPatrimony.id, dataToSave);
          
          // Registrar movimentação de manutenção
          await PatrimonyMovement.create({
            patrimony_id: editingPatrimony.id,
            movement_type: 'manutencao',
            movement_date: new Date().toISOString().split('T')[0],
            responsible_user: user.email,
            observations: 'Dados atualizados via sistema',
            cnpj: user.cnpj
          });
          alert('Equipamento atualizado com sucesso!');
        } else {
          const newPatrimony = await Patrimony.create({
            ...dataToSave,
            qr_code: dataToSave.qr_code || generateAssetCode(patrimonies.length + 1),
          });

          // Registrar movimentação de alocação
          await PatrimonyMovement.create({
            patrimony_id: newPatrimony.id,
            movement_type: 'alocacao',
            to_contract_id: data.contract_id,
            movement_date: data.allocation_date,
            responsible_user: user.email,
            observations: 'Alocação inicial do equipamento',
            cnpj: user.cnpj
          });
          alert('Equipamento cadastrado com sucesso!');
        }
      }
      
      await loadData();
      setIsFormOpen(false);
      setEditingPatrimony(null);
    } catch (error) {
      console.error('Erro ao salvar equipamento:', error);
      alert('Erro ao salvar equipamento. Verifique os dados.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este equipamento? Esta ação não pode ser desfeita.')) {
      try {
        await Patrimony.delete(id);
        await loadData();
        alert('Equipamento excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir equipamento:', error);
        alert('Erro ao excluir equipamento.');
      }
    }
  };

  const handleStatusChange = async (patrimonyId, newStatus) => {
    try {
      const patrimony = patrimonies.find(p => p.id === patrimonyId);
      const updates = { status: newStatus };
      
      if (newStatus === 'devolvido' && !patrimony.actual_return_date) {
        updates.actual_return_date = new Date().toISOString().split('T')[0];
      }
      
      await Patrimony.update(patrimonyId, updates);
      
      // Registrar movimentação
      await PatrimonyMovement.create({
        patrimony_id: patrimonyId,
        movement_type: newStatus === 'devolvido' ? 'devolucao' : 'manutencao',
        movement_date: new Date().toISOString().split('T')[0],
        responsible_user: user.email,
        observations: `Status alterado para: ${newStatus}`,
        cnpj: user.cnpj
      });
      
      await loadData();
      alert('Status atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  const handleFormOpen = (patrimonyToEdit = null) => {
    setEditingPatrimony(patrimonyToEdit);
    setIsFormOpen(true);
  };

  const handleGenerateQr = async (patrimony) => {
    try {
      await PatrimonyMovement.create({
        patrimony_id: patrimony.id,
        movement_type: 'geracao_qr',
        movement_date: new Date().toISOString(),
        responsible_user: user.email,
        observations: `QR Code gerado para o equipamento com serial ${patrimony.serial_number}.`,
        cnpj: user.cnpj,
      });
      console.log('Movimentação de geração de QR registrada.');
    } catch(err) {
      console.error('Falha ao registrar movimentação de QR Code:', err);
    }
  };

  const openQrModal = (items) => {
    const validItems = (Array.isArray(items) ? items : [items]).filter(p => p.qr_code || p.serial_number);
    if(validItems.length === 0) {
      alert('Nenhum dos equipamentos selecionados possui código de rastreamento para gerar QR Code.');
      return;
    }
    setSelectedPatrimonyForQr(validItems);
    setIsQrModalOpen(true);
  };
  
  const filteredPatrimonies = patrimonies.filter(patrimony => {
    const matchesSearch = patrimony.equipment_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         patrimony.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || patrimony.status === statusFilter;
    const matchesContract = contractFilter === 'all' || patrimony.contract_id === contractFilter;
    
    return matchesSearch && matchesStatus && matchesContract;
  });

  const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const statusColors = {
    em_uso: 'bg-green-100 text-green-800',
    devolvido: 'bg-blue-100 text-blue-800',
    pendente: 'bg-yellow-100 text-yellow-800',
    extraviado: 'bg-red-100 text-red-800',
    manutencao: 'bg-orange-100 text-orange-800'
  };

  const statusLabels = {
    em_uso: 'Em Uso',
    devolvido: 'Devolvido',
    pendente: 'Pendente',
    extraviado: 'Extraviado',
    manutencao: 'Manutenção'
  };

  const equipmentTypes = {
    ferramenta: 'Ferramenta',
    maquinario: 'Maquinário',
    epi: 'EPI',
    mobiliario: 'Mobiliário',
    eletronico: 'Eletrônico',
    veiculo: 'Veículo',
    outros: 'Outros'
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Controle de Patrimônio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie equipamentos, alocações e movimentações.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsLookupOpen(true)}>
            <ScanLine className="w-4 h-4 mr-2" /> Consultar por Código
          </Button>
          {canPerformAction(userRole, 'create') && (
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleFormOpen(null)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Equipamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader className="flex-shrink-0 pb-4 border-b border-border">
                <DialogTitle className="text-xl font-semibold">
                  {editingPatrimony ? 'Editar Equipamento' : 'Novo Equipamento'}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-1">
                <PatrimonyForm
                  isEditing={!!editingPatrimony}
                  patrimony={editingPatrimony}
                  contracts={contracts}
                  onSave={handleSave}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setEditingPatrimony(null);
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Abas Principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="equipments">Equipamentos</TabsTrigger>
          <TabsTrigger value="depreciation">Depreciação</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total de Equipamentos</p>
                <p className="text-2xl font-bold text-foreground mt-1">{dashboardData.totalEquipments}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor do Patrimônio</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(dashboardData.totalValue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Em Uso</p>
                <p className="text-2xl font-bold text-foreground mt-1">{dashboardData.equipmentsInUse}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Devoluções Atrasadas</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{dashboardData.pendingReturns}</p>
              </CardContent>
            </Card>
          </div>

          {/* Alertas */}
          {dashboardData.pendingReturns > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Equipamentos com Devolução Atrasada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-600 dark:text-red-400 text-sm">
                  Há {dashboardData.pendingReturns} equipamento(s) com devolução atrasada.
                  Verifique a aba "Equipamentos" para mais detalhes.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="equipments" className="mt-6 space-y-4">
          {/* Filtros */}
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou série..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-background border-border"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={contractFilter} onValueChange={setContractFilter}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Todos os contratos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Contratos</SelectItem>
                    {contracts.map(contract => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setContractFilter('all');
                    }}
                  >
                    Limpar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openQrModal(filteredPatrimonies)}
                    disabled={contractFilter === 'all' || filteredPatrimonies.length === 0}
                  >
                    <QrCode className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Equipamentos */}
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-base font-semibold text-foreground">Equipamentos Registrados ({filteredPatrimonies.length})</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Equipamento</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Contrato</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Valor</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Alocação</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Devolução Prevista</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatrimonies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Package className="w-8 h-8 text-muted-foreground opacity-60" />
                          </div>
                          <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum equipamento</h3>
                          <p className="text-muted-foreground text-sm">Cadastre um equipamento para começar.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPatrimonies.map((patrimony) => {
                      const contract = contracts.find(c => c.id === patrimony.contract_id);
                      const isOverdue = patrimony.status === 'em_uso' &&
                        patrimony.expected_return_date &&
                        new Date(patrimony.expected_return_date) < new Date();

                      return (
                        <TableRow key={patrimony.id} className="border-border hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">{patrimony.equipment_name}</div>
                              <div className="text-xs text-muted-foreground">Série: {patrimony.serial_number || '—'}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{contract?.name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                              {equipmentTypes[patrimony.equipment_type] || patrimony.equipment_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[patrimony.status] + ' border-0 text-xs'}>
                                {statusLabels[patrimony.status]}
                              </Badge>
                              {isOverdue && (
                                <AlertTriangle className="w-4 h-4 text-red-500" title="Devolução atrasada" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {formatCurrency(patrimony.equipment_value)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {patrimony.allocation_date ?
                              format(new Date(patrimony.allocation_date), 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          <TableCell className={isOverdue ? 'text-red-600 font-medium text-sm' : 'text-muted-foreground text-sm'}>
                            {patrimony.expected_return_date ?
                              format(new Date(patrimony.expected_return_date), 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => {
                                  setViewingPatrimony(patrimony);
                                  setIsViewOpen(true);
                                }}>
                                  <Eye className="w-4 h-4 mr-2" /> Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleFormOpen(patrimony)}>
                                  <Edit className="w-4 h-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openQrModal(patrimony)}>
                                  <QrCode className="w-4 h-4 mr-2" /> Gerar QR Code
                                </DropdownMenuItem>
                                {patrimony.status === 'em_uso' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(patrimony.id, 'devolvido')}>
                                    <Truck className="w-4 h-4 mr-2" /> Marcar como Devolvido
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleDelete(patrimony.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                </DropdownMenuItem>
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
          </Card>
        </TabsContent>

        <TabsContent value="depreciation" className="mt-6">
          <DepreciationTab
            patrimonies={patrimonies}
            onGenerate={handleGenerateDepreciation}
            generating={isGeneratingDepreciation}
          />
        </TabsContent>

        <TabsContent value="movements" className="mt-6">
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center text-base font-semibold text-foreground">
                <History className="w-4 h-4 mr-2 text-primary" />
                Histórico de Movimentações
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Data</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Equipamento</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Responsável</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.slice(0, 50).map((movement) => {
                    const patrimony = patrimonies.find(p => p.id === movement.patrimony_id);
                    return (
                      <TableRow key={movement.id} className="border-border hover:bg-muted/30 transition-colors">
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(movement.movement_date), 'dd/MM/yyyy', { locale: pt })}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{patrimony?.equipment_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize border-border text-muted-foreground text-xs">
                            {movement.movement_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{movement.responsible_user}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                          {movement.observations}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <PatrimonyReport 
            patrimonies={patrimonies}
            contracts={contracts}
            movements={movements}
            user={user}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de Visualização */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Equipamento</DialogTitle>
          </DialogHeader>
          {viewingPatrimony && (
            <PatrimonyView 
              patrimony={viewingPatrimony}
              contract={contracts.find(c => c.id === viewingPatrimony.contract_id)}
              movements={movements.filter(m => m.patrimony_id === viewingPatrimony.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Geração de QR Code */}
      {isQrModalOpen && (
        <QrCodeGenerator 
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          patrimonies={selectedPatrimonyForQr}
          user={user}
          onConfirm={() => {
            const items = Array.isArray(selectedPatrimonyForQr) ? selectedPatrimonyForQr : [selectedPatrimonyForQr];
            items.forEach(p => handleGenerateQr(p));
          }}
        />
      )}

      {/* Modal de Consulta por Código (QR ou série) */}
      <AssetLookupDialog
        open={isLookupOpen}
        onOpenChange={setIsLookupOpen}
        patrimonies={patrimonies}
        onFound={(patrimony) => {
          setIsLookupOpen(false);
          setViewingPatrimony(patrimony);
          setIsViewOpen(true);
        }}
      />
    </div>
  );
}
