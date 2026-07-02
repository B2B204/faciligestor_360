
import React, { useState, useEffect } from "react";
import { Repactuacao } from "@/entities/Repactuacao";
import { Contract } from "@/entities/Contract";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, Search, MoreVertical, Edit, Trash2, CheckCircle, Clock, X, ClipboardCheck, Save } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { canPerformAction } from "@/components/permissions";
import DeleteConfirmation from "@/components/common/DeleteConfirmation";
import { Ligacao } from "@/entities/Ligacao";
import AISuggester from "@/components/common/AISuggester";
import { generateOperationalAlerts } from "@/lib/alertsGenerator";

export default function ReajusteContratualPage() {
  const [user, setUser] = useState(null);
  const [repactuacoes, setRepactuacoes] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRepactuacao, setEditingRepactuacao] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contractFilter, setContractFilter] = useState("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      const [repactuacoesData, contractsData] = await Promise.all([
        Repactuacao.filter({ cnpj: currentUser.cnpj, deleted_at: null }, "-created_date"),
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' })
      ]);
      
      setRepactuacoes(repactuacoesData);
      setContracts(contractsData);

      try {
        await generateOperationalAlerts(currentUser.cnpj, currentUser.email);
      } catch (e) {
        console.log("Falha ao gerar alertas:", e);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  const handleSave = async (formData) => {
    // Normaliza campos antes de enviar
    const toNullIfEmpty = (v) => (v === "" || v === undefined ? null : v);
    const normalized = {
      ...formData,
      // datas opcionais precisam ser null quando vazias
      data_efetivacao: toNullIfEmpty(formData.data_efetivacao),
      data_envio_cobranca: toNullIfEmpty(formData.data_envio_cobranca),
      data_resposta: toNullIfEmpty(formData.data_resposta),
      // garantir números
      valor_reivindicado: typeof formData.valor_reivindicado === "number" ? formData.valor_reivindicado : Number(formData.valor_reivindicado || 0),
      valor_aprovado: typeof formData.valor_aprovado === "number" ? formData.valor_aprovado : Number(formData.valor_aprovado || 0),
    };

    try {
      const dataToSave = {
        ...normalized,
        cnpj: user.cnpj,
        updated_by: user.email,
        ...(editingRepactuacao ? {} : { created_by: user.email })
      };

      // Log útil para diagnóstico (apenas no dev console)
      console.log("Salvando Repactuação (payload):", dataToSave);

      if (editingRepactuacao) {
        await Repactuacao.update(editingRepactuacao.id, dataToSave);
        alert("Reajuste atualizado com sucesso!");
      } else {
        await Repactuacao.create(dataToSave);
        alert("Reajuste registrado com sucesso!");
      }

      await loadData();
      setIsFormOpen(false);
      setEditingRepactuacao(null);
    } catch (error) {
      console.error("Erro ao salvar reajuste (detalhes):", error);
      alert("Erro ao salvar reajuste. Verifique as datas e campos obrigatórios e tente novamente.");
    }
  };

  const handleEdit = (repactuacao) => {
    setEditingRepactuacao(repactuacao);
    setIsFormOpen(true);
  };

  const handleDeleteRequest = (repactuacao) => {
    setItemToDelete(repactuacao);
    setShowDeleteConfirm(true);
  };
  
  const confirmDelete = async () => {
    if (!itemToDelete || !user) return;
    try {
      await Repactuacao.update(itemToDelete.id, {
        deleted_at: new Date().toISOString(),
        deleted_by: user.email,
      });
      await loadData();
      alert("Reajuste movido para a lixeira!");
    } catch (error) {
      console.error("Erro ao excluir reajuste:", error);
      alert("Erro ao excluir reajuste.");
    } finally {
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  const handleCreateNew = () => {
    setEditingRepactuacao(null);
    setIsFormOpen(true);
  };

  const getPrazoStatus = (rep) => {
    if (rep.data_efetivacao || rep.status_licitacao === 'efetivada') {
      return { text: '-', color: '' };
    }
    
    // FIX: Add a check to prevent crash if data_solicitacao is missing
    if (!rep.data_solicitacao) {
      return { text: 'Data N/A', color: 'bg-gray-100 text-gray-800' };
    }

    const days = differenceInDays(new Date(), parseISO(rep.data_solicitacao));
    
    if (days >= 0 && days <= 20) return { text: 'Em análise', color: 'bg-blue-100 text-blue-800' };
    if (days > 20 && days <= 30) return { text: 'Prazo Fatal', color: 'bg-yellow-100 text-yellow-800' };
    if (days > 30 && days <= 60) return { text: 'Atraso', color: 'bg-red-100 text-red-800' };
    if (days > 60) return { text: 'Atraso Crítico', color: 'bg-red-200 text-red-900 font-bold' };
    
    return { text: '-', color: '' };
  };

  const filteredRepactuacoes = repactuacoes.filter(rep => {
    const contract = contracts.find(c => c.id === rep.contract_id);
    const searchMatch = searchTerm === "" ||
      contract?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.cct_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusMatch = statusFilter === "all" || rep.status_licitacao === statusFilter;
    const contractMatch = contractFilter === "all" || rep.contract_id === contractFilter;
    
    return searchMatch && statusMatch && contractMatch;
  });

  const statusColors = {
    solicitada: "bg-yellow-100 text-yellow-800",
    aprovada: "bg-blue-100 text-blue-800",
    efetivada: "bg-green-100 text-green-800",
    cancelada: "bg-red-100 text-red-800",
  };

  const statusIcons = {
    solicitada: <Clock className="w-4 h-4" />,
    aprovada: <CheckCircle className="w-4 h-4" />,
    efetivada: <CheckCircle className="w-4 h-4" />,
    cancelada: <X className="w-4 h-4" />,
  };

  const statusLabels = {
    solicitada: "Solicitada",
    aprovada: "Aprovada",
    efetivada: "Efetivada",
    cancelada: "Cancelada"
  };

  const userRole = user?.department || 'operador';

  const RepactuacaoForm = ({ repactuacao, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
      contract_id: "",
      nome_efetivacao: "",
      cct_number: "",
      data_solicitacao: "",
      data_efetivacao: "",
      descricao: "",
      status_licitacao: "solicitada",
      valor_reivindicado: 0,
      valor_aprovado: 0,
      data_envio_cobranca: "",
      data_resposta: "",
      status_cobranca: "em_analise",
      anexos: [],
      observations: ""
    });
    
    const [ligacoes, setLigacoes] = useState([]);
    const [newLigacao, setNewLigacao] = useState({ data_ligacao: '', hora_ligacao: '', descricao: '' });
    const [isSavingLigacao, setIsSavingLigacao] = useState(false);

    useEffect(() => {
      if (repactuacao) {
        setFormData({
          contract_id: repactuacao.contract_id || "",
          nome_efetivacao: repactuacao.nome_efetivacao || "",
          cct_number: repactuacao.cct_number || "",
          data_solicitacao: repactuacao.data_solicitacao || "",
          data_efetivacao: repactuacao.data_efetivacao || "",
          descricao: repactuacao.descricao || "",
          status_licitacao: repactuacao.status_licitacao || "solicitada",
          valor_reivindicado: repactuacao.valor_reivindicado || 0,
          valor_aprovado: repactuacao.valor_aprovado || 0,
          data_envio_cobranca: repactuacao.data_envio_cobranca || "",
          data_resposta: repactuacao.data_resposta || "",
          status_cobranca: repactuacao.status_cobranca || "em_analise",
          anexos: repactuacao.anexos || [],
          observations: repactuacao.observations || ""
        });
        loadLigacoes(repactuacao.id);
      } else {
        // Reset form for new entry creation
        setFormData({
          contract_id: "",
          nome_efetivacao: "",
          cct_number: "",
          data_solicitacao: "",
          data_efetivacao: "",
          descricao: "",
          status_licitacao: "solicitada",
          valor_reivindicado: 0,
          valor_aprovado: 0,
          data_envio_cobranca: "",
          data_resposta: "",
          status_cobranca: "em_analise",
          anexos: [],
          observations: ""
        });
      }
    }, [repactuacao]);

    const loadLigacoes = async (repactuacaoId) => {
      if (!repactuacaoId) return;
      const data = await Ligacao.filter({ repactuacao_id: repactuacaoId, deleted_at: null }, "-created_date");
      setLigacoes(data);
    };

    const handleAddLigacao = async () => {
      if (!newLigacao.data_ligacao || !newLigacao.hora_ligacao || !newLigacao.descricao) {
        alert("Preencha todos os campos da ligação.");
        return;
      }
      
      setIsSavingLigacao(true);
      try {
        await Ligacao.create({
          ...newLigacao,
          repactuacao_id: repactuacao.id,
          cnpj: user.cnpj,
          created_by: user.email,
        });
        setNewLigacao({ data_ligacao: '', hora_ligacao: '', descricao: '' });
        await loadLigacoes(repactuacao.id);
      } catch (error) {
        console.error("Erro ao adicionar ligação:", error);
      } finally {
        setIsSavingLigacao(false);
      }
    };

    const handleDeleteLigacao = async (ligacaoId) => {
      if (window.confirm("Tem certeza que deseja remover este registro de ligação?")) {
        await Ligacao.update(ligacaoId, { deleted_at: new Date().toISOString(), deleted_by: user.email });
        await loadLigacoes(repactuacao.id);
      }
    };
    
    const handleChange = (e) => {
      const { name, value, type } = e.target;
      
      if (type === 'date' && value) {
        const year = value.split('-')[0];
        if (year.length > 4) {
            alert("Ano inválido. Digite um ano com 4 dígitos, como 2025.");
            return;
        }
      }

      setFormData(prev => ({ ...prev, [name]: (type === 'number' ? Number(value) : value) }));
    };

    const handleSelectChange = (name, value) => {
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      
      if (!formData.contract_id) {
        alert("Por favor, selecione um contrato.");
        return;
      }
      if (!formData.descricao.trim()) {
        alert("A Descrição/Justificativa é obrigatória.");
        return;
      }
      if (!formData.data_solicitacao) {
        alert("Data da solicitação é obrigatória.");
        return;
      }

      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900 mb-4">📑 Informações do Reajuste</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contrato *</Label>
              <Select value={formData.contract_id} onValueChange={(v) => handleSelectChange("contract_id", v)} required>
                <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="nome_efetivacao">Nome da Efetivação</Label>
              <Input id="nome_efetivacao" name="nome_efetivacao" value={formData.nome_efetivacao} onChange={handleChange} placeholder="Ex: Reajuste CCT 2024" />
            </div>
            {/* Novo campo: Número da CCT (opcional) */}
            <div>
              <Label htmlFor="cct_number">Número da CCT (opcional)</Label>
              <Input
                id="cct_number"
                name="cct_number"
                value={formData.cct_number}
                onChange={handleChange}
                placeholder="Ex: CCT 2024/2025"
              />
            </div>
             <div>
              <Label htmlFor="data_solicitacao">Data da Solicitação *</Label>
              <Input type="date" id="data_solicitacao" name="data_solicitacao" value={formData.data_solicitacao} onChange={handleChange} required />
            </div>
             <div>
              <Label htmlFor="data_efetivacao">Data Efetiva (Opcional)</Label>
              <Input type="date" id="data_efetivacao" name="data_efetivacao" value={formData.data_efetivacao} onChange={handleChange} />
            </div>
             <div className="md:col-span-2">
              <Label>Status da Solicitação</Label>
              <Select value={formData.status_licitacao} onValueChange={(v) => handleSelectChange("status_licitacao", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solicitada">Solicitada</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="efetivada">Efetivada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-4">
            <Label htmlFor="descricao">Descrição / Justificativa *</Label>
            <Textarea id="descricao" name="descricao" value={formData.descricao} onChange={handleChange} rows={3} placeholder="Descreva o motivo do reajuste, repactuação ou reequilíbrio..." required />
          </div>
        </div>

        {/* Gestão de Cobrança */}
        <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-4">💵 Gestão de Cobrança</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div>
                    <Label htmlFor="valor_reivindicado">Valor Reivindicado (R$)</Label>
                    <Input type="number" id="valor_reivindicado" name="valor_reivindicado" value={formData.valor_reivindicado} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="valor_aprovado">Valor Aprovado (R$)</Label>
                    <Input type="number" id="valor_aprovado" name="valor_aprovado" value={formData.valor_aprovado} onChange={handleChange} />
                </div>
                <div>
                    <Label>Status da Cobrança</Label>
                    <Select value={formData.status_cobranca} onValueChange={(v) => handleSelectChange("status_cobranca", v)}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="em_analise">Em análise</SelectItem>
                            <SelectItem value="aprovado">Aprovado</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                            <SelectItem value="indeferido">Indeferido</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="data_envio_cobranca">Data Envio Cobrança</Label>
                    <Input type="date" id="data_envio_cobranca" name="data_envio_cobranca" value={formData.data_envio_cobranca} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="data_resposta">Data Resposta</Label>
                    <Input type="date" id="data_resposta" name="data_resposta" value={formData.data_resposta} onChange={handleChange} />
                </div>
            </div>
        </div>

        {/* Histórico de Ligações */}
        {repactuacao && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-4">📞 Histórico de Ligações</h3>
            <div className="space-y-3 mb-4">
              {ligacoes.map(lig => (
                <div key={lig.id} className="bg-card border border-border p-2 rounded flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{format(parseISO(lig.data_ligacao), 'dd/MM/yyyy')} às {lig.hora_ligacao} - por {lig.created_by}</p>
                    <p className="text-muted-foreground text-sm">{lig.descricao}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteLigacao(lig.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-t pt-4">
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Input value={newLigacao.descricao} onChange={e => setNewLigacao(p => ({...p, descricao: e.target.value}))} placeholder="Resumo da conversa..."/>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={newLigacao.data_ligacao} onChange={e => setNewLigacao(p => ({...p, data_ligacao: e.target.value}))} />
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={newLigacao.hora_ligacao} onChange={e => setNewLigacao(p => ({...p, hora_ligacao: e.target.value}))} />
              </div>
            </div>
            <Button type="button" onClick={handleAddLigacao} disabled={isSavingLigacao} className="mt-2">
              <Plus className="w-4 h-4 mr-2"/>
              {isSavingLigacao ? 'Salvando...' : 'Adicionar Registro'}
            </Button>
          </div>
        )}

        <div className="mt-4">
            <Label htmlFor="observations">Observações (Opcional)</Label>
            <Textarea id="observations" name="observations" value={formData.observations} onChange={handleChange} rows={2} placeholder="Observações adicionais..."/>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2" />
            {repactuacao ? "Atualizar Reajuste" : "Registrar Reajuste"}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="p-8 space-y-4">
      {/* Header com Dashboard Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Reajustes</p>
                <p className="text-3xl font-bold text-blue-600">
                  {repactuacoes.length}
                </p>
              </div>
              <ClipboardCheck className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Análise</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {repactuacoes.filter(r => {
                    const prazo = getPrazoStatus(r);
                    return prazo.text === 'Em análise';
                  }).length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Efetivadas</p>
                <p className="text-3xl font-bold text-green-600">
                  {repactuacoes.filter(r => r.status_licitacao === 'efetivada').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Atraso</p>
                <p className="text-3xl font-bold text-red-600">
                  {repactuacoes.filter(r => {
                    const prazo = getPrazoStatus(r);
                    return prazo.text.includes('Atraso');
                  }).length}
                </p>
              </div>
              <X className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <AISuggester
          contextType="repactuacao"
          label="Sugerir texto (IA – Lei 14.133/21)"
          defaultPrompt="Redija um pedido de repactuação/reequilíbrio alinhado à Lei 14.133/21, com fundamentação legal, índices e datas, impactos financeiros, prazos e forma de atualização."
        />
      </div>

      {/* Filtros e Ações */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Filtros e Busca
            </CardTitle>
            {canPerformAction(userRole, 'create') && (
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreateNew} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Reajuste
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingRepactuacao ? "Editar Reajuste" : "Novo Reajuste Contratual"}</DialogTitle>
                  </DialogHeader>
                  <RepactuacaoForm
                    repactuacao={editingRepactuacao}
                    onSave={handleSave}
                    onCancel={() => setIsFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Buscar</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Contrato, CCT ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="solicitada">Solicitada</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="efetivada">Efetivada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Contrato</Label>
              <Select value={contractFilter} onValueChange={setContractFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os contratos</SelectItem>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Reajustes */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contrato</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Data Solicitação</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>CCT</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : filteredRepactuacoes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum reajuste encontrado</TableCell></TableRow>
              ) : (
                filteredRepactuacoes.map((repactuacao) => {
                  const contract = contracts.find(c => c.id === repactuacao.contract_id);
                  const prazo = getPrazoStatus(repactuacao);
                  return (
                    <TableRow key={repactuacao.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {contract?.name || 'Contrato não encontrado'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={repactuacao.descricao}>
                        {repactuacao.descricao || "-"}
                      </TableCell>
                      <TableCell>
                        {repactuacao.data_solicitacao ? format(parseISO(repactuacao.data_solicitacao), "dd/MM/yyyy") : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${prazo.color} w-fit`}>{prazo.text}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[repactuacao.status_licitacao]} flex items-center gap-1 w-fit`}>
                          {statusIcons[repactuacao.status_licitacao]}
                          {statusLabels[repactuacao.status_licitacao]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{repactuacao.cct_number || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {canPerformAction(userRole, 'edit') && (
                              <DropdownMenuItem onClick={() => handleEdit(repactuacao)}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                            )}
                            {canPerformAction(userRole, 'delete') && (
                              <DropdownMenuItem onClick={() => handleDeleteRequest(repactuacao)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
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
        </CardContent>
      </Card>
      
      <DeleteConfirmation 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        itemName={itemToDelete?.nome_efetivacao || itemToDelete?.descricao}
        title="Mover para a Lixeira?"
        description="O item será movido para a lixeira e poderá ser recuperado por um administrador."
      />
    </div>
  );
}
