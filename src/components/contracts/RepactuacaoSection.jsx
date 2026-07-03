import React, { useState, useEffect } from "react";
import { Repactuacao } from "@/entities/Repactuacao";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
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
import { Plus, FileText, MoreVertical, Edit, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function RepactuacaoSection({ contractId }) {
  const [repactuacoes, setRepactuacoes] = useState([]);
  const [user, setUser] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRepactuacao, setEditingRepactuacao] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    cct_number: "",
    data_solicitacao: "",
    data_efetivacao: "",
    descricao: "",
    status_licitacao: "solicitada",
    observations: ""
  });

  useEffect(() => {
    loadData();
  }, [contractId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      const repactuacoesData = await Repactuacao.filter({ 
        contract_id: contractId,
        cnpj: currentUser.cnpj 
      }, "-data_solicitacao");
      
      setRepactuacoes(repactuacoesData);
    } catch (error) {
      console.error("Erro ao carregar repactuações:", error);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      cct_number: "",
      data_solicitacao: "",
      data_efetivacao: "",
      descricao: "",
      status_licitacao: "solicitada",
      observations: ""
    });
    setEditingRepactuacao(null);
  };

  const handleEdit = (repactuacao) => {
    setEditingRepactuacao(repactuacao);
    setFormData({
      cct_number: repactuacao.cct_number || "",
      data_solicitacao: repactuacao.data_solicitacao ? repactuacao.data_solicitacao.split('T')[0] : "",
      data_efetivacao: repactuacao.data_efetivacao ? repactuacao.data_efetivacao.split('T')[0] : "",
      descricao: repactuacao.descricao || "",
      status_licitacao: repactuacao.status_licitacao || "solicitada",
      observations: repactuacao.observations || ""
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (repactuacao) => {
    if (window.confirm(`Tem certeza que deseja excluir a repactuação CCT ${repactuacao.cct_number}?`)) {
      try {
        await Repactuacao.delete(repactuacao.id);
        await loadData();
        alert("Repactuação excluída com sucesso!");
      } catch (error) {
        console.error("Erro ao excluir repactuação:", error);
        alert("Erro ao excluir repactuação.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.cct_number.trim()) {
      alert("📑 Número da CCT é obrigatório.");
      return;
    }
    
    if (!formData.data_solicitacao) {
      alert("📅 Data da solicitação é obrigatória.");
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        contract_id: contractId,
        cnpj: user.cnpj
      };

      if (editingRepactuacao) {
        await Repactuacao.update(editingRepactuacao.id, dataToSave);
        alert("Repactuação atualizada com sucesso!");
      } else {
        await Repactuacao.create(dataToSave);
        alert("Repactuação cadastrada com sucesso!");
      }

      await loadData();
      setIsFormOpen(false);
      resetForm();
      
    } catch (error) {
      console.error("Erro ao salvar repactuação:", error);
      alert("Erro ao salvar repactuação. Tente novamente.");
    }
    setIsSaving(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const statusColors = {
    solicitada: "bg-yellow-100 text-yellow-800",
    aprovada: "bg-blue-100 text-blue-800",
    efetivada: "bg-green-100 text-green-800",
    cancelada: "bg-red-100 text-red-800"
  };

  const statusLabels = {
    solicitada: "Solicitada",
    aprovada: "Aprovada",
    efetivada: "Efetivada",
    cancelada: "Cancelada"
  };

  return (
    <div className="bg-purple-50 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-purple-900 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          📑 Repactuações ({repactuacoes.length})
        </h3>
        
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm"
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Repactuação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingRepactuacao ? "Editar Repactuação" : "Nova Repactuação"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cct_number">Número da CCT *</Label>
                  <Input
                    id="cct_number"
                    name="cct_number"
                    value={formData.cct_number}
                    onChange={handleChange}
                    required
                    placeholder="Ex: CCT-2024-001"
                  />
                </div>
                <div>
                  <Label htmlFor="status_licitacao">Status</Label>
                  <Select
                    value={formData.status_licitacao}
                    onValueChange={(v) => handleSelectChange("status_licitacao", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solicitada">Solicitada</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                      <SelectItem value="efetivada">Efetivada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="data_solicitacao">Data da Solicitação *</Label>
                  <Input
                    type="date"
                    id="data_solicitacao"
                    name="data_solicitacao"
                    value={formData.data_solicitacao}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="data_efetivacao">Data Efetiva</Label>
                  <Input
                    type="date"
                    id="data_efetivacao"
                    name="data_efetivacao"
                    value={formData.data_efetivacao}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Descrição da repactuação..."
                />
              </div>

              <div>
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  name="observations"
                  value={formData.observations}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Observações adicionais..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Salvando..." : (editingRepactuacao ? "Atualizar" : "Cadastrar")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <p className="text-purple-700">Carregando repactuações...</p>
        </div>
      ) : repactuacoes.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CCT</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data Solicitação</TableHead>
              <TableHead>Data Efetiva</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repactuacoes.map((repactuacao) => (
              <TableRow key={repactuacao.id}>
                <TableCell className="font-medium">{repactuacao.cct_number}</TableCell>
                <TableCell>
                  <Badge className={statusColors[repactuacao.status_licitacao]}>
                    {statusLabels[repactuacao.status_licitacao]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {format(new Date(repactuacao.data_solicitacao), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  {repactuacao.data_efetivacao
                    ? format(new Date(repactuacao.data_efetivacao), "dd/MM/yyyy")
                    : "-"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleEdit(repactuacao)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(repactuacao)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-purple-700">
          <Calendar className="w-12 h-12 mx-auto mb-2 text-purple-400" />
          <p>Nenhuma repactuação cadastrada para este contrato.</p>
          <p className="text-sm mt-1">Clique em "Adicionar Repactuação" para começar.</p>
        </div>
      )}
    </div>
  );
}