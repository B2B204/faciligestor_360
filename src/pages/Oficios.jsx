import React, { useState, useEffect } from 'react';
import { Oficio } from '@/entities/Oficio';
import { User } from '@/entities/User';
import { TeamMember } from '@/entities/TeamMember';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, Loader2, AlertCircle, RefreshCw, FileText, CheckCircle2, XCircle } from 'lucide-react';
import OficioForm from '@/components/oficios/OficioForm';
import OficioPreview from '@/components/oficios/OficioPreview';
import { format } from 'date-fns';
import { canPerformAction } from '@/components/permissions';
import AISuggester from "@/components/common/AISuggester";
import { Textarea } from '@/components/ui/textarea';

export default function OficiosPage() {
  const [user, setUser] = useState(null);
  const [oficios, setOficios] = useState([]);
  const [allUsers, setAllUsers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingOficio, setEditingOficio] = useState(null);
  const [selectedOficio, setSelectedOficio] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [oficioToAction, setOficioToAction] = useState(null);
  const [suggestedNumber, setSuggestedNumber] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  const canApprove = ['admin', 'gestor'].includes(user?.department);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentUser = await User.me();
      if (!currentUser) throw new Error("Usuário não autenticado");

      // Determinar CNPJ de forma resiliente
      let userCnpj = currentUser.cnpj;
      if (!userCnpj) {
        try {
          const teamMembers = await TeamMember.filter({ email: currentUser.email });
          if (teamMembers && teamMembers.length > 0) userCnpj = teamMembers[0].cnpj;
        } catch (e) {
          // Ignora erro de permissão/busca ao tentar TeamMember para evitar 401
          console.log("TeamMember.filter indisponível para este usuário:", e?.message || e);
        }
      }
      if (!userCnpj) throw new Error("Não foi possível determinar o CNPJ da empresa.");

      const userWithCnpj = { ...currentUser, cnpj: userCnpj };
      setUser(userWithCnpj);

      // Buscar apenas Ofícios (consulta necessária)
      const oficiosData = await Oficio.filter({ cnpj: userCnpj }, "-created_date");
      setOficios(oficiosData);

      // Construir mapa mínimo de usuários sem depender de endpoints restritos
      // Evita 401 para perfis sem permissão de listar usuários/equipe
      const minimalUsersMap = {};
      minimalUsersMap[currentUser.email] = { full_name: currentUser.full_name || currentUser.email, email: currentUser.email };

      // Tentativa opcional (não bloqueante) de enriquecer nomes - segura contra 401
      try {
        const usersData = await User.filter({ cnpj: userCnpj });
        usersData.forEach(u => { minimalUsersMap[u.email] = { full_name: u.full_name, email: u.email }; });
      } catch (e) {
        console.log("User.filter não disponível; seguindo com mapa mínimo.");
      }
      try {
        const teamMembersData = await TeamMember.filter({ cnpj: userCnpj });
        teamMembersData.forEach(tm => {
          if (!minimalUsersMap[tm.email]) minimalUsersMap[tm.email] = { full_name: tm.full_name || tm.name || tm.email, email: tm.email };
        });
      } catch (e) {
        console.log("TeamMember.filter não disponível; seguindo com mapa mínimo.");
      }
      setAllUsers({ ...minimalUsersMap });

    } catch (err) {
      console.error("❌ Erro ao carregar dados:", err);
      setError(err.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const getNextNumeroOficio = async () => {
    // Sugere próximo número no formato 0001/ANO
    if (!user?.cnpj) {
      console.warn("CNPJ do usuário não disponível para sugerir número de ofício.");
      setSuggestedNumber(""); // Clear previous suggestion if no CNPJ
      return;
    }
    const todayYear = new Date().getFullYear();
    try {
      const lastOficioResult = await Oficio.filter({ cnpj: user.cnpj, year: todayYear }, '-numero_oficio', 1);
      let nextNumber = 1;
      if (lastOficioResult.length > 0) {
        const lastNumberStr = (lastOficioResult[0].numero_oficio || "").split('/')[0];
        const parsed = parseInt(lastNumberStr, 10);
        if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
      }
      const numero = `${String(nextNumber).padStart(4, '0')}/${todayYear}`;
      setSuggestedNumber(numero);
    } catch (err) {
      console.error("Erro ao obter próximo número de ofício:", err);
      setSuggestedNumber(""); // Clear suggestion on error
    }
  };

  const handleSave = async (oficioData) => {
    try {
      if (editingOficio) {
        await Oficio.update(editingOficio.id, { ...oficioData, updated_by: user?.email || undefined });
        alert('Ofício atualizado com sucesso!');
      } else {
        // Ensure user.cnpj is available before attempting to create
        if (!user || !user.cnpj) {
          throw new Error("Dados do usuário incompletos. Não é possível criar o ofício.");
        }

        const yearFromDate = new Date(oficioData.data_emissao).getFullYear();
        // Use provided numero_oficio if available and not empty, otherwise use suggestedNumber
        // If neither is available, default to "0001/YEAR"
        const numero = oficioData.numero_oficio && oficioData.numero_oficio.trim() !== ""
          ? oficioData.numero_oficio.trim()
          : suggestedNumber || `${String(1).padStart(4, '0')}/${yearFromDate}`;

        const dataToSave = {
          ...oficioData,
          cnpj: user.cnpj,
          numero_oficio: numero,
          year: yearFromDate,
          status: 'rascunho',
          approval_status: 'pendente',
          created_by: user.email,
        };

        await Oficio.create(dataToSave);
        alert('Ofício criado com sucesso!');
      }
      setIsFormOpen(false);
      setEditingOficio(null);
      setSuggestedNumber(""); // Clear suggested number after save
      await loadInitialData();
    } catch (err) {
      console.error('❌ Erro ao salvar ofício:', err);
      alert(`Erro ao salvar ofício: ${err.message}`);
    }
  };

  const handleDelete = async (oficioId) => {
    if (window.confirm('Tem certeza que deseja excluir este ofício?')) {
      try {
        await Oficio.delete(oficioId);
        alert('Ofício excluído com sucesso!');
        await loadInitialData();
      } catch (err) {
        console.error('❌ Erro ao excluir ofício:', err);
        alert('Erro ao excluir ofício.');
      }
    }
  };

  const handleOpenForm = async (oficioToEdit = null) => {
    setEditingOficio(oficioToEdit);
    if (!oficioToEdit && user?.cnpj) {
      await getNextNumeroOficio();
    } else {
      setSuggestedNumber(""); // Clear suggested number when editing an existing oficio
    }
    setIsFormOpen(true);
  };

  const handleOpenPreview = (oficioToPreview) => {
    setSelectedOficio(oficioToPreview);
    setIsPreviewOpen(true);
  };

  const handleApprove = async (oficio) => {
    try {
      await Oficio.update(oficio.id, {
        approval_status: 'aprovado',
        approved_by: user?.email,
        approval_date: new Date().toISOString(),
        rejection_reason: ''
      });
      alert('Ofício aprovado com sucesso!');
      await loadInitialData();
    } catch (err) {
      console.error('❌ Erro ao aprovar ofício:', err);
      alert('Erro ao aprovar ofício.');
    }
  };

  const handleOpenReject = (oficio) => {
    setOficioToAction(oficio);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!oficioToAction) return;
    try {
      await Oficio.update(oficioToAction.id, {
        approval_status: 'rejeitado',
        approved_by: user?.email,
        approval_date: new Date().toISOString(),
        rejection_reason: rejectReason || 'Sem motivo informado'
      });
      setRejectDialogOpen(false);
      setOficioToAction(null);
      alert('Ofício rejeitado.');
      await loadInitialData();
    } catch (err) {
      console.error('❌ Erro ao rejeitar ofício:', err);
      alert('Erro ao rejeitar ofício.');
    }
  };


  const filteredOficios = oficios.filter(o => {
    const term = searchTerm.toLowerCase();
    const matchesText = (
      o.assunto?.toLowerCase().includes(term) ||
      o.destinatario?.toLowerCase().includes(term) ||
      o.numero_oficio?.includes(searchTerm) ||
      (o.category||'').toLowerCase().includes(term) ||
      (o.department||'').toLowerCase().includes(term)
    );
    const catOk = categoryFilter === 'all' || (o.category||'') === categoryFilter;
    const depOk = departmentFilter === 'all' || (o.department||'') === departmentFilter;
    return matchesText && catOk && depOk;
  });

  const statusColors = { rascunho: 'bg-yellow-100 text-yellow-800', gerado: 'bg-blue-100 text-blue-800', enviado: 'bg-green-100 text-green-800' };
  const approvalColors = {
    pendente: 'bg-muted text-muted-foreground',
    aprovado: 'bg-green-100 text-green-800',
    rejeitado: 'bg-red-100 text-red-800'
  };

  if (isLoading) return (
    <div className="p-8 flex justify-center items-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Erro ao Carregar</h2>
      <p className="text-muted-foreground mb-4">{error}</p>
      <Button onClick={loadInitialData}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ofícios e Comunicados</h1>
          <p className="text-muted-foreground text-sm">Gerencie ofícios e comunicados importantes.</p>
        </div>
        {canPerformAction(user?.department, 'create') && (
          <Button onClick={() => handleOpenForm()}>
            <Plus className="w-4 h-4 mr-2" /> Novo Ofício
          </Button>
        )}
      </div>
      <div className="flex justify-end">
        <AISuggester
          contextType="oficio"
          label="Redigir com IA (Lei 14.133/21)"
          defaultPrompt="Redija um ofício formal alinhado à Lei 14.133/21, usando o template e os dados do contrato/destinatário. Estruture com: identificação, objeto, contexto, fundamentação legal, providências e prazos, e assinatura."
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lista de Ofícios ({filteredOficios.length})</CardTitle>
            <div className="w-full max-w-sm relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por assunto, destinatário, número..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-sm text-foreground">Categoria</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="oficio">Ofício</SelectItem>
                  <SelectItem value="aviso">Aviso</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                  <SelectItem value="requisicao">Requisição</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-foreground">Departamento</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="compras">Compras</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 md:justify-end">
              <Button variant="outline" onClick={()=>{setCategoryFilter('all'); setDepartmentFilter('all');}}>Limpar Filtros</Button>
            </div>
          </div>
        </CardContent>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aprovação</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOficios.map((oficio) => (
                <TableRow key={oficio.id}>
                  <TableCell className="font-medium">{oficio.numero_oficio}</TableCell>
                  <TableCell className="max-w-xs truncate">{oficio.assunto}</TableCell>
                  <TableCell className="max-w-xs truncate">{oficio.destinatario}</TableCell>
                  <TableCell>{oficio.data_emissao ? format(new Date(oficio.data_emissao), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell><Badge className={`${statusColors[oficio.status]} capitalize`}>{oficio.status}</Badge></TableCell>
                  <TableCell>
                    <Badge className={`${approvalColors[oficio.approval_status || 'pendente']} capitalize`}>
                      {oficio.approval_status || 'pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell>{allUsers[oficio.created_by]?.full_name || oficio.created_by}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleOpenPreview(oficio)}><Eye className="w-4 h-4 mr-2" /> Visualizar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenForm(oficio)}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                        {canApprove && (oficio.approval_status === 'pendente' || oficio.approval_status === 'rejeitado') && (
                          <>
                            <DropdownMenuItem onClick={() => handleApprove(oficio)}>
                              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Aprovar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenReject(oficio)} className="text-red-600">
                              <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                            </DropdownMenuItem>
                          </>
                        )}
                        {canPerformAction(user?.department, 'delete') && (
                          <DropdownMenuItem onClick={() => handleDelete(oficio.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredOficios.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>Nenhum ofício encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de rejeição */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Rejeitar Ofício</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o motivo da rejeição (opcional):</p>
            <Textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex.: Ajustar a fundamentação legal do item 3..." />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleConfirmReject}><XCircle className="w-4 h-4 mr-2" /> Confirmar Rejeição</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOficio ? 'Editar Ofício' : 'Novo Ofício'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <OficioForm
              oficio={editingOficio}
              onSave={handleSave}
              onCancel={() => { setIsFormOpen(false); setEditingOficio(null); setSuggestedNumber(""); }}
              currentUser={user}
              suggestedNumber={suggestedNumber}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualizar Ofício</DialogTitle>
          </DialogHeader>
          {selectedOficio && <OficioPreview oficio={selectedOficio} currentUser={user} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}