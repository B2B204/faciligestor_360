import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Save, CheckCircle, PlusCircle, ClipboardCheck } from "lucide-react"; // Added PlusCircle icon for notes
import RepactuacaoSection from "./RepactuacaoSection";
import CnpjLookupInput, { formatCnpj } from "@/components/common/CnpjLookupInput";
import { TaskTemplate } from "@/entities/TaskTemplate";
import { User } from "@/entities/User";
import { CompanyCnpj } from "@/entities/CompanyCnpj";

export default function ContractForm({ contract, onSave, onCancel, isSaving }) {
  const [formData, setFormData] = useState({
    contract_number: "",
    name: "",
    unidade: "", // Added new field
    client_name: "",
    client_cnpj: "",
    contractor_cnpj: "", // Novo campo: CNPJ da empresa contratada
    apoio_administrativo: "", // New field
    useful_link: "",
    monthly_value: 0,
    duration_months: 12,
    annual_value: 0,
    expected_margin: 15,
    number_of_employees: 1,
    start_date: "",
    service_type: "limpeza",
    client_type: "pj",
    status: "ativo",
    observations: "",
    notes: [], // New field for contract notes/messages
    task_template_id: null // Modelo de Tarefas a instanciar automaticamente
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newNoteText, setNewNoteText] = useState(""); // State to manage the input for new notes
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [companyCnpjs, setCompanyCnpjs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await User.me();
        const templates = await TaskTemplate.filter({ cnpj: currentUser.cnpj, is_active: true });
        setTaskTemplates(templates);
      } catch (e) {
        console.error("Erro ao carregar modelos de tarefas:", e);
      }
    })();
    (async () => {
      try {
        // Os funcionários de um contrato ficam vinculados ao CNPJ contratado,
        // então só faz sentido oferecer os CNPJs já cadastrados e liberados
        // em Configurações da Empresa — não um texto livre.
        const rows = await CompanyCnpj.filter({ is_active: true });
        setCompanyCnpjs(rows || []);
      } catch (e) {
        console.error("Erro ao carregar CNPJs cadastrados:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (contract) {
      setFormData({
        contract_number: contract.contract_number || "",
        name: contract.name || "",
        unidade: contract.unidade || "", // Populate new field
        client_name: contract.client_name || "",
        client_cnpj: contract.client_cnpj || "",
        contractor_cnpj: contract.contractor_cnpj || "",
        apoio_administrativo: contract.apoio_administrativo || "", // Populate new field
        useful_link: contract.useful_link || "",
        monthly_value: contract.monthly_value || 0,
        duration_months: contract.duration_months || 12,
        annual_value: contract.annual_value || (contract.monthly_value * (contract.duration_months || 12)),
        expected_margin: contract.expected_margin || 15,
        number_of_employees: contract.number_of_employees || 1,
        start_date: contract.start_date ? contract.start_date.split('T')[0] : '',
        service_type: contract.service_type || 'limpeza',
        client_type: contract.client_type || 'pj',
        status: contract.status || 'ativo',
        observations: contract.observations || "",
        notes: contract.notes || [], // Populate notes from existing contract
        task_template_id: contract.task_template_id || null
      });
    } else {
      // Reset form for new contract
      setFormData({
        contract_number: "",
        name: "",
        unidade: "", // Reset new field
        client_name: "",
        client_cnpj: "",
        contractor_cnpj: "",
        apoio_administrativo: "", // Reset new field
        useful_link: "",
        monthly_value: 0,
        duration_months: 12,
        annual_value: 0,
        expected_margin: 15,
        number_of_employees: 1,
        start_date: "",
        service_type: "limpeza",
        client_type: "pj",
        status: "ativo",
        observations: "",
        notes: [], // Reset notes for new contract
        task_template_id: null
      });
      setSaveSuccess(false);
    }
  }, [contract]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    if (type === 'date' && value) {
      const year = value.split('-')[0];
      if (year.length > 4) {
        alert("Ano inválido. Digite um ano com 4 dígitos, como 2025.");
        return; // Impede a atualização do estado com valor inválido
      }
    }

    let newFormData = { ...formData, [name]: value };

    // Calcular valor anual automaticamente
    if (name === 'monthly_value' || name === 'duration_months') {
      const monthlyValue = name === 'monthly_value' ? Number(value) : Number(formData.monthly_value);
      const durationMonths = name === 'duration_months' ? Number(value) : Number(formData.duration_months);
      newFormData.annual_value = monthlyValue * durationMonths;
    }

    setFormData(newFormData);
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddNote = async () => {
    if (newNoteText.trim() === "") {
      alert("Por favor, digite algo para adicionar à nota.");
      return;
    }

    const newNote = {
      id: Date.now(), // Simple unique ID for the note (for key prop)
      text: newNoteText.trim(),
      timestamp: new Date().toISOString(), // ISO string for consistent date/time
    };

    const updatedNotes = [...formData.notes, newNote];
    const updatedFormData = { ...formData, notes: updatedNotes };

    // Update local state immediately for visual feedback
    setFormData(updatedFormData);
    setNewNoteText(""); // Clear input field

    // Trigger save for persistence of notes
    try {
      await onSave(updatedFormData); // Save the contract with the updated notes array
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000); // Briefly show success message
    } catch (error) {
      console.error("Erro ao adicionar nota e salvar contrato:", error);
      alert("Erro ao salvar a nota. Por favor, tente novamente.");
      // Optionally, revert the notes if save fails to avoid data mismatch
      // setFormData(prev => ({ ...prev, notes: prev.notes.slice(0, -1) }));
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação rigorosa de campos obrigatórios
    if (!formData.contract_number.trim()) {
      alert("📌 Número do contrato é obrigatório para concluir o cadastro.");
      return;
    }
    if (!formData.name.trim()) {
      alert("Nome do contrato é obrigatório");
      return;
    }
    if (!formData.client_name.trim()) {
      alert("Nome do cliente é obrigatório");
      return;
    }
    if (!formData.client_cnpj.trim()) {
      alert("CNPJ do cliente é obrigatório");
      return;
    }
    if (!formData.start_date) {
      alert("Data de início é obrigatória");
      return;
    }
    if (!formData.monthly_value || formData.monthly_value <= 0) {
      alert("Valor mensal deve ser maior que zero");
      return;
    }
    if (!formData.duration_months || formData.duration_months <= 0) {
      alert("Duração em meses deve ser maior que zero");
      return;
    }

    // Garantir que os campos numéricos sejam números
    const cleanedData = {
      ...formData,
      monthly_value: Number(formData.monthly_value) || 0,
      duration_months: Number(formData.duration_months) || 12,
      annual_value: Number(formData.monthly_value) * Number(formData.duration_months),
      expected_margin: Number(formData.expected_margin) || 15,
      number_of_employees: Number(formData.number_of_employees) || 1,
      contractor_cnpj: formData.contractor_cnpj || ""
    };

    try {
      await onSave(cleanedData);
      setSaveSuccess(true);

      // Resetar o formulário após sucesso se for um novo contrato
      if (!contract) {
        setTimeout(() => {
          setFormData({
            contract_number: "",
            name: "",
            unidade: "",
            client_name: "",
            client_cnpj: "",
            apoio_administrativo: "",
            useful_link: "",
            monthly_value: 0,
            duration_months: 12,
            annual_value: 0,
            expected_margin: 15,
            number_of_employees: 1,
            start_date: "",
            service_type: "limpeza",
            client_type: "pj",
            status: "ativo",
            observations: "",
            notes: [], // Reset notes on new contract creation success
            task_template_id: null
          });
          setSaveSuccess(false);
        }, 2000);
      } else {
        setTimeout(() => setSaveSuccess(false), 2000); // Clear success message for existing contract
      }
    } catch (error) {
      console.error("Erro no submit:", error);
      alert("Erro ao salvar contrato");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bloco 1: Informações Principais */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-4">📄 Informações Principais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contract_number">Número do Contrato *</Label>
            <Input id="contract_number" name="contract_number" value={formData.contract_number} onChange={handleChange} required placeholder="Ex: 2024/001" />
          </div>
          <div>
            <Label htmlFor="name">Nome do Contrato *</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="Contrato de Limpeza XPTO" />
          </div>
          {/* New Unidade / Sede field */}
          <div>
            <Label htmlFor="unidade">Unidade / Sede (Opcional)</Label>
            <Input id="unidade" name="unidade" value={formData.unidade} onChange={handleChange} placeholder="Ex: Sede Principal, Filial Centro" />
          </div>
          <div>
            <Label htmlFor="apoio_administrativo">Apoio Administrativo</Label>
            <Input id="apoio_administrativo" name="apoio_administrativo" value={formData.apoio_administrativo} onChange={handleChange} placeholder="Nome do responsável administrativo" />
          </div>
          <div>
            <Label htmlFor="client_name">Nome do Cliente *</Label>
            <Input id="client_name" name="client_name" value={formData.client_name} onChange={handleChange} required placeholder="Empresa XPTO Ltda." />
          </div>
          <div>
            <Label htmlFor="client_cnpj">CNPJ do Cliente *</Label>
            <CnpjLookupInput
              id="client_cnpj"
              name="client_cnpj"
              value={formData.client_cnpj}
              onChange={handleChange}
              onFound={(data) => setFormData((prev) => ({ ...prev, client_name: prev.client_name || data.nome || prev.client_name }))}
              required
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div>
            <Label htmlFor="contractor_cnpj">CNPJ da Empresa Contratada (opcional)</Label>
            <Select
              value={formData.contractor_cnpj || ""}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, contractor_cnpj: v }))}
            >
              <SelectTrigger id="contractor_cnpj">
                <SelectValue placeholder="Selecione o CNPJ cadastrado" />
              </SelectTrigger>
              <SelectContent>
                {companyCnpjs.map((c) => (
                  <SelectItem key={c.cnpj} value={c.cnpj}>
                    {formatCnpj(c.cnpj)}{c.display_name ? ` — ${c.display_name}` : ''}
                  </SelectItem>
                ))}
                {/* Garante que um valor já salvo apareça mesmo se não estiver mais na lista de ativos */}
                {formData.contractor_cnpj && !companyCnpjs.some((c) => c.cnpj === formData.contractor_cnpj) && (
                  <SelectItem value={formData.contractor_cnpj}>{formatCnpj(formData.contractor_cnpj)}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Os funcionários deste contrato ficam vinculados a este CNPJ. Cadastre novos CNPJs em Configurações da Empresa.
            </p>
          </div>
          <div className="md:col-span-2"> {/* Useful link now within the grid and spans 2 columns */}
            <Label htmlFor="useful_link">Link Útil do Cliente (Portal)</Label>
            <div className="relative">
              <ExternalLink className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input id="useful_link" name="useful_link" value={formData.useful_link} onChange={handleChange} placeholder="https://portal.cliente.com" className="pl-10" />
            </div>
          </div>
        </div>
      </div>

      {/* Bloco 2: Valores e Prazos */}
      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="font-semibold text-green-900 mb-4">💰 Valores e Prazos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="monthly_value">Valor Mensal (R$) *</Label>
            <Input type="number" id="monthly_value" name="monthly_value" value={formData.monthly_value} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="duration_months">Duração (meses) *</Label>
            <Input type="number" id="duration_months" name="duration_months" value={formData.duration_months} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="annual_value">Valor Anual (R$)</Label>
            <Input type="number" id="annual_value" name="annual_value" value={formData.annual_value} disabled className="bg-gray-200" />
          </div>
          <div>
            <Label htmlFor="start_date">Data de Início *</Label>
            <Input type="date" id="start_date" name="start_date" value={formData.start_date} onChange={handleChange} required />
          </div>
        </div>
      </div>

      {/* Bloco 3: Detalhes do Serviço */}
      <div className="bg-yellow-50 p-6 rounded-lg">
        <h3 className="font-semibold text-yellow-900 mb-4">🛠️ Detalhes do Serviço</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Tipo de Serviço *</Label>
            <Select value={formData.service_type} onValueChange={(v) => handleSelectChange("service_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="limpeza">Limpeza</SelectItem>
                <SelectItem value="portaria">Portaria</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
                <SelectItem value="seguranca">Segurança</SelectItem>
                <SelectItem value="jardinagem">Jardinagem</SelectItem>
                <SelectItem value="ar_condicionado">Ar-condicionado</SelectItem>
                <SelectItem value="obras">Obras</SelectItem>
                <SelectItem value="copeiragem">Copeiragem</SelectItem>
                <SelectItem value="garcom">Garçom</SelectItem>
                <SelectItem value="administrativo">Administrativo</SelectItem> {/* Added new service type */}
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Cliente *</Label>
            <Select value={formData.client_type} onValueChange={(v) => handleSelectChange("client_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pj">Pessoa Jurídica (Privada)</SelectItem>
                <SelectItem value="pf">Pessoa Física</SelectItem>
                <SelectItem value="orgao_publico">Órgão Público</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Usado para calcular impostos automaticamente via Regras Fiscais.</p>
          </div>
          <div>
            <Label>Status *</Label>
            <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="expected_margin">Margem Esperada (%)</Label>
            <Input type="number" id="expected_margin" name="expected_margin" value={formData.expected_margin} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="number_of_employees">Nº de Funcionários</Label>
            <Input type="number" id="number_of_employees" name="number_of_employees" value={formData.number_of_employees} onChange={handleChange} />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="observations">Observações</Label>
          <Textarea id="observations" name="observations" value={formData.observations} onChange={handleChange} placeholder="Detalhes importantes sobre o contrato..." />
        </div>
      </div>

      {/* Bloco 4: Modelo de Tarefas */}
      <div className="bg-indigo-50 p-6 rounded-lg">
        <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" /> Modelo de Tarefas
        </h3>
        <Label>Modelo a ser aplicado {!contract && "(opcional)"}</Label>
        <Select
          value={formData.task_template_id || "none"}
          onValueChange={(v) => handleSelectChange("task_template_id", v === "none" ? null : v)}
        >
          <SelectTrigger><SelectValue placeholder="Nenhum modelo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum modelo</SelectItem>
            {taskTemplates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          {contract
            ? "Alterar o modelo aqui não recria as tarefas já geradas para este contrato."
            : "Ao salvar, todas as tarefas do modelo escolhido serão criadas automaticamente para este contrato."}
        </p>
      </div>

      {/* Mural de Recados - only visible in edit mode */}
      {contract && (
        <div className="bg-orange-50 p-6 rounded-lg">
          <h3 className="font-semibold text-orange-900 mb-4">💬 Mural de Recados</h3>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-2"> {/* Added scroll for notes */}
            {formData.notes && formData.notes.length > 0 ? (
              formData.notes.map((note) => (
                <div key={note.id} className="border-b pb-2 mb-2 last:border-b-0 last:pb-0">
                  <p className="text-sm text-gray-700">{note.text}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(note.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">Nenhum recado ainda. Adicione o primeiro!</p>
            )}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <Textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Escreva um novo recado aqui..."
              rows={2}
              className="flex-grow"
            />
            <Button
              type="button"
              onClick={handleAddNote}
              disabled={isSaving || newNoteText.trim() === ""}
              className="sm:self-end px-4 py-2 flex items-center justify-center min-w-[120px]"
            >
              <PlusCircle className="w-4 h-4 mr-2" /> Adicionar Recado
            </Button>
          </div>
        </div>
      )}

      {/* Repactuação Section - only in edit mode */}
      {contract && (
        <div className="bg-purple-50 p-6 rounded-lg">
          <RepactuacaoSection contractId={contract.id} userCnpj={contract.cnpj} />
        </div>
      )}

      {/* Ações */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSaving} className={`px-6 py-3 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isSaving ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Salvando...</>) : saveSuccess ? (<><CheckCircle className="w-4 h-4 mr-2" />Salvo!</>) : (<><Save className="w-4 h-4 mr-2" />{contract ? "Salvar Alterações" : "Cadastrar Contrato"}</>)}
        </Button>
      </div>
    </form>
  );
}