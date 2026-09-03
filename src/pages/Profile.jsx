import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { UserInvite } from "@/entities/UserInvite";
import { DataSubjectRequest } from "@/entities/DataSubjectRequest";
import { CnpjAccessRequest } from "@/entities/CnpjAccessRequest";
import { UserCnpjAccess } from "@/entities/UserCnpjAccess";
import { CompanyCnpj } from "@/entities/CompanyCnpj";
import { TeamMember } from "@/entities/TeamMember";
import { Contract } from "@/entities/Contract";
import { Employee } from "@/entities/Employee";
import { UploadFile } from "@/integrations/Core";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import UserInviteModal from "@/components/UserInviteModal";
import TrashManager from '@/components/common/TrashManager';
import CnpjLookupInput from "@/components/common/CnpjLookupInput";
import DataRecovery from "@/components/common/DataRecovery";
import BackupManager from "@/components/common/BackupManager"; // NEW IMPORT
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Save, CheckCircle, Upload, Crown, Users, FileText, TrendingUp, ShieldCheck, UserPlus, DownloadCloud, Trash2, Trash, Copy, Database } from "lucide-react";
import { format } from 'date-fns';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ contracts: 0, employees: 0, actualUsers: 0 });
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    cnpj: "",
    tax_regime: "simples_nacional",
    company_logo_url: "",
    company_name: "",
    company_address: "",
    cargo: "",
    matricula: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [effectivePlan, setEffectivePlan] = useState('none');
  const [loadError, setLoadError] = useState(false);
  const [myCnpjRequests, setMyCnpjRequests] = useState([]);
  const [myCnpjAccess, setMyCnpjAccess] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoadError(false);
      const currentUser = await User.me();
      setUser(currentUser);

      // Compute effective plan inherited from account owner for non-admins
      let plan = currentUser.plan || 'none';
      if (currentUser && currentUser.department !== 'admin') {
        try {
          const owners = await User.filter({ cnpj: currentUser.cnpj, department: 'admin' });
          if (owners && owners.length) plan = owners[0].plan || 'none';
        } catch (e) {}
      }
      setEffectivePlan(plan);

      // Assegura que o usuário seja carregado antes de outras chamadas
      if (currentUser) {
          setFormData({
              full_name: currentUser.full_name || "",
              phone: currentUser.phone || "",
              cnpj: currentUser.cnpj || "",
              tax_regime: currentUser.tax_regime || "simples_nacional",
              company_logo_url: currentUser.company_logo_url || "",
              company_name: currentUser.company_name || "",
              company_address: currentUser.company_address || "",
              cargo: currentUser.cargo || "",
              matricula: currentUser.matricula || ""
          });
          await Promise.all([
              loadTeamMembers(currentUser),
              loadPendingInvites(currentUser),
              loadStats(currentUser),
              loadCnpjAccess(currentUser)
          ]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados do perfil:", error);
      setLoadError(true);
    }
  };
  
  const loadStats = async (currentUser) => {
      // Carregar contratos e funcionários como antes
      const [contracts, employees] = await Promise.all([
        Contract.filter({ cnpj: currentUser.cnpj }),
        Employee.filter({ cnpj: currentUser.cnpj })
      ]);

      // NOVO: Contar usuários reais do sistema (que consomem licenças)
      let actualSystemUsers = 0;
      
      try {
        // Contar usuários da entidade User principal
        const mainUsers = await User.filter({ cnpj: currentUser.cnpj });
        actualSystemUsers += mainUsers.length;
        
        // Contar usuários ativos da entidade TeamMember
        const teamMembers = await TeamMember.filter({ cnpj: currentUser.cnpj, status: 'ativo' });
        actualSystemUsers += teamMembers.length;
      } catch (error) {
        console.warn("Erro ao contar usuários do sistema:", error);
        actualSystemUsers = 1; // Pelo menos o usuário atual
      }

      setStats({
        contracts: contracts.length,
        employees: employees.length, // Funcionários (não contam para o plano)
        actualUsers: actualSystemUsers // Usuários reais (contam para o plano)
      });
  };

  const loadCnpjAccess = async (currentUser) => {
    try {
      const [requests, access] = await Promise.all([
        CnpjAccessRequest.filter({ requester_email: currentUser.email }, '-created_at'),
        UserCnpjAccess.filter({ user_email: currentUser.email }),
      ]);
      setMyCnpjRequests(requests || []);
      setMyCnpjAccess(access || []);
    } catch (error) {
      console.error("Erro ao carregar acessos de CNPJ:", error);
    }
  };

  const handleCancelCnpjRequest = async (req) => {
    if (!window.confirm(`Cancelar a solicitação de acesso ao CNPJ ${req.cnpj}?`)) return;
    try {
      await CnpjAccessRequest.delete(req.id);
      await loadCnpjAccess(user);
    } catch (error) {
      console.error("Erro ao cancelar solicitação de CNPJ:", error);
      alert("Não foi possível cancelar a solicitação.");
    }
  };

  // Admin já tem autoridade pra aprovar qualquer solicitação em
  // Configurações da Empresa — evita ter que sair do Perfil pra liberar um
  // pedido próprio ou de outro usuário.
  const handleApproveCnpjRequest = async (req) => {
    try {
      const existingAccess = await UserCnpjAccess.filter({ user_email: req.requester_email, cnpj: req.cnpj });
      if (!existingAccess || existingAccess.length === 0) {
        await UserCnpjAccess.create({ user_email: req.requester_email, cnpj: req.cnpj });
      }
      await CnpjAccessRequest.update(req.id, {
        status: 'aprovado',
        decided_by: user.email,
        decided_at: new Date().toISOString(),
      });
      // O seletor de CNPJ no topo (CnpjSwitcher) vive no Layout, fora desta
      // página — avisa ele para recarregar a lista de acessos.
      if (req.requester_email === user.email) {
        window.dispatchEvent(new Event('cnpj-access-changed'));
      }
      await loadCnpjAccess(user);
    } catch (error) {
      console.error("Erro ao aprovar solicitação de CNPJ:", error);
      alert("Não foi possível aprovar a solicitação.");
    }
  };

  const loadPendingInvites = async (currentUser) => {
    if(currentUser.department === 'admin') {
      try {
        const invites = await UserInvite.filter({ cnpj: currentUser.cnpj, status: 'pendente' });
        // Filtrar convites expirados no lado do cliente
        const now = new Date();
        const validInvites = invites.filter(invite => invite.expires_at && new Date(invite.expires_at) > now);
        setPendingInvites(validInvites);
      } catch (error) {
        console.error("Erro ao carregar convites pendentes:", error);
      }
    }
  };

  const loadTeamMembers = async (currentUser) => {
    if(currentUser.department === 'admin') {
      try {
        // Carregar membros da entidade User padrão
        const usersFromBase = await User.filter({ cnpj: currentUser.cnpj });
        
        // Carregar membros da entidade TeamMember (todos os status)
        let teamMembersFromInvites = [];
        try {
          teamMembersFromInvites = await TeamMember.filter({ cnpj: currentUser.cnpj });
        } catch (error) {
          console.log("ℹ️ Entidade TeamMember não encontrada ou inacessível, usando apenas usuários base. Erro:", error.message);
        }
        
        // Combinar as duas listas, evitando duplicatas por email
        const allMembers = [...usersFromBase];
        
        teamMembersFromInvites.forEach(teamMember => {
          // Só adicionar se não existir um usuário com o mesmo email na lista de usuários base
          const existsInBase = usersFromBase.some(user => user.email === teamMember.email);
          if (!existsInBase) {
            // Transformar TeamMember no formato esperado para exibição, adicionando uma flag
            const memberAsUser = {
              id: teamMember.id,
              full_name: teamMember.full_name,
              email: teamMember.email,
              department: teamMember.department,
              created_date: teamMember.created_date,
              updated_date: teamMember.updated_date,
              status: teamMember.status || 'ativo', // Default to 'ativo' if status is not explicitly set
              // Adicionar flag para identificar que veio de convite
              from_invite: true
            };
            allMembers.push(memberAsUser);
          }
        });
        
        // Ensure all users have a 'status' field for consistent display logic
        // If a User from base doesn't explicitly have status, default to 'ativo' unless department is 'canceled'
        const normalizedMembers = allMembers.map(member => ({
            ...member,
            status: member.status || (member.department === 'canceled' ? 'inativo' : 'ativo')
        }));

        setTeamMembers(normalizedMembers);
        console.log(`✅ Carregados ${normalizedMembers.length} membros.`);
        
      } catch (error) {
        console.error("Erro ao carregar membros da equipe:", error);
      }
    }
  };

  const handleUpdateMemberRole = async (memberId, newDepartment) => {
    if (user.department !== 'admin') {
      alert('Apenas administradores podem alterar perfis de usuários.');
      return;
    }

    try {
      // Verificar se é um membro da base (User) ou de convite (TeamMember)
      const member = teamMembers.find(m => m.id === memberId);
      
      if (!member) {
        alert('Membro não encontrado.');
        return;
      }

      if (member.from_invite) {
        // Atualizar na entidade TeamMember
        await TeamMember.update(memberId, { department: newDepartment });
      } else {
        // Atualizar na entidade User
        await User.update(memberId, { department: newDepartment });
      }
      
      loadAllData();
      alert('Perfil do usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil do usuário:', error);
      alert('Erro ao atualizar perfil do usuário.');
    }
  };

  const handleDeleteInvite = async (inviteId) => {
      if(window.confirm("Tem certeza que deseja cancelar este convite?")) {
          try {
              // Em vez de deletar, vamos marcar como cancelado para manter o histórico
              await UserInvite.update(inviteId, { status: 'cancelado' });
              loadAllData();
              alert("Convite cancelado.");
          } catch (error) {
              console.error("Erro ao cancelar convite:", error);
              alert("Não foi possível cancelar o convite.");
          }
      }
  };
  
  const handleCancelUser = async (member) => {
    const confirmMessage = `Tem certeza que deseja cancelar o acesso de "${member.full_name}"? 
    
Esta ação irá:
• Desativar o usuário no sistema
• Remover acesso aos dados da empresa
• O usuário não conseguirá mais fazer login

Você pode reativar este usuário posteriormente se necessário.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log(`🔄 Cancelando usuário: ${member.full_name} (${member.email})`);

      if (member.from_invite) {
        // Se for um membro vindo de convite, atualizar na entidade TeamMember
        await TeamMember.update(member.id, { 
          status: 'inativo',
          deactivated_at: new Date().toISOString(),
          deactivated_by: user.email,
          deactivation_reason: 'Cancelado pelo administrador'
        });
        console.log("✅ Membro de convite desativado na entidade TeamMember");
      } else {
        // Se for um usuário da base, marcar como inativo (profiles não tem coluna
        // "status" própria — "department: canceled" já é o sinal usado em toda
        // esta página para identificar usuários cancelados, ver isInactive acima).
        await User.update(member.id, {
          department: 'canceled'
        });
        console.log("✅ Usuário base marcado como cancelado");
      }

      // Recarregar a lista
      await loadAllData();
      alert(`✅ Usuário "${member.full_name}" foi cancelado com sucesso.`);
      
    } catch (error) {
      console.error("❌ Erro ao cancelar usuário:", error);
      alert(`❌ Erro ao cancelar usuário: ${error.message}`);
    }
  };

  const handleReactivateUser = async (member) => {
    const confirmMessage = `Reativar o usuário "${member.full_name}"? 
    
Esta ação irá:
• Restaurar o acesso ao sistema
• Permitir login novamente
• Definir função como "Visualização" (você pode alterar depois)`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      console.log(`🔄 Reativando usuário: ${member.full_name}`);

      if (member.from_invite) {
        await TeamMember.update(member.id, { 
          status: 'ativo',
          department: 'comercial', // Função padrão ao reativar
          reactivated_at: new Date().toISOString(),
          reactivated_by: user.email
        });
      } else {
        await User.update(member.id, {
          department: 'comercial' // Função padrão ao reativar; volta a passar em isInactive === false
        });
      }

      await loadAllData();
      alert(`✅ Usuário "${member.full_name}" foi reativado com sucesso.`);

    } catch (error) {
      console.error("❌ Erro ao reativar usuário:", error);
      alert(`❌ Erro ao reativar usuário: ${error.message}`);
    }
  };

  const handleDeleteMember = async (member) => {
    if (!window.confirm(`Excluir definitivamente "${member.full_name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    try {
      if (member.from_invite) {
        await TeamMember.delete(member.id);
      } else {
        await User.delete(member.id);
      }
      await loadAllData();
      alert(`✅ "${member.full_name}" foi excluído.`);
    } catch (error) {
      console.error("❌ Erro ao excluir membro:", error);
      alert(`❌ Erro ao excluir membro: ${error.message}`);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;

    if(fileType === 'profile') setIsUploading(true);
    if(fileType === 'logo') setIsUploadingLogo(true);

    try {
      const { file_url } = await UploadFile({ file });
      const fieldToUpdate = fileType === 'profile' ? 'photo_url' : 'company_logo_url';
      await User.update(user.id, { [fieldToUpdate]: file_url });
      loadAllData();
      alert(`Sua ${fileType === 'profile' ? 'foto de perfil' : 'logo da empresa'} foi atualizada!`);
    } catch (error) {
      alert("Erro ao fazer upload.");
    }

    if(fileType === 'profile') setIsUploading(false);
    if(fileType === 'logo') setIsUploadingLogo(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name || !formData.phone || !formData.cnpj || !formData.company_name || !formData.company_address || !formData.cargo || !formData.matricula) {
      alert("Por favor, preencha todos os campos obrigatórios (*).");
      return;
    }

    setIsSaving(true);
    try {
      // O cnpj é a chave usada para vincular todos os usuários da mesma
      // empresa (Entity.filter faz igualdade exata) — precisa ir sem
      // máscara, senão o usuário deixa de ver os dados dos colegas e
      // vice-versa.
      const cnpjDigits = formData.cnpj.replace(/\D/g, '');
      const cnpjChanged = cnpjDigits !== (user.cnpj || '');

      if (cnpjChanged) {
        if (user.cnpj) {
          // Já tem empresa vinculada: trocar de CNPJ aqui pularia o fluxo de
          // aprovação. Para acessar outra empresa é "Trocar de CNPJ"
          // (acesso já aprovado) ou "Solicitar CNPJ" no topo da tela.
          alert('Para vincular sua conta a outro CNPJ, use "Trocar de CNPJ" ou "Solicitar CNPJ" no topo da tela — este campo só define o CNPJ da sua empresa no primeiro acesso.');
          setIsSaving(false);
          return;
        }

        // Primeiro acesso: um CNPJ novo aqui não pode ser assumido direto —
        // se já existe uma empresa cadastrada com esse número, isso é
        // "entrar" numa empresa já existente, e precisa da aprovação de um
        // administrador dela, não do salvamento direto deste formulário
        // (era isso que permitia qualquer conta recém-criada virar admin
        // instantâneo de qualquer CNPJ só de digitar o número, sem nunca
        // aparecer para o admin real aprovar).
        const existingCompany = await CompanyCnpj.filter({ cnpj: cnpjDigits });
        if (existingCompany && existingCompany.length > 0) {
          const already = (myCnpjRequests || []).some(r => r.cnpj === cnpjDigits && (!r.status || r.status === 'pendente'));
          if (!already) {
            await CnpjAccessRequest.create({
              requester_email: user.email,
              cnpj: cnpjDigits,
              reason: 'Solicitado ao completar o perfil.',
              status: 'pendente',
            });
          }
          await loadCnpjAccess(user);
          alert('Esse CNPJ já está cadastrado no sistema. Enviamos uma solicitação de acesso — um administrador da empresa precisa aprovar antes que você tenha acesso aos dados dela.');
          setIsSaving(false);
          return;
        }

        // CNPJ inédito: completar o perfil também registra a empresa (mesmo
        // efeito de Configurações da Empresa), e este usuário vira o admin
        // fundador dela.
        await User.update(user.id, { ...formData, cnpj: cnpjDigits });
        await CompanyCnpj.create({ cnpj: cnpjDigits, display_name: formData.company_name });
      } else {
        await User.update(user.id, formData);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadAllData();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      alert(error.message || "Erro ao atualizar perfil.");
    }
    setIsSaving(false);
  };

  // LGPD — direito de acesso/portabilidade: exporta os dados pessoais do
  // próprio usuário em JSON e registra a solicitação como já atendida.
  const handleExportMyData = async () => {
    setIsExportingData(true);
    try {
      const exportData = { ...user, exported_at: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meus-dados_${user.email}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await DataSubjectRequest.create({
        cnpj: user.cnpj,
        subject_name: user.full_name || user.email,
        subject_email: user.email,
        request_type: 'exportacao',
        description: 'Autoexportação de dados via Perfil.',
        status: 'concluido',
        resolved_by: user.email,
        resolved_at: new Date().toISOString(),
      });
    } catch (error) {
      alert("Erro ao exportar seus dados.");
    }
    setIsExportingData(false);
  };

  // LGPD — direito de exclusão: registra o pedido para análise de um
  // administrador (a exclusão da conta não é automática por segurança).
  const handleRequestDeletion = async () => {
    if (!window.confirm("Confirma a solicitação de exclusão da sua conta e dados pessoais? Um administrador irá analisar o pedido.")) {
      return;
    }
    setIsRequestingDeletion(true);
    try {
      await DataSubjectRequest.create({
        cnpj: user.cnpj,
        subject_name: user.full_name || user.email,
        subject_email: user.email,
        request_type: 'exclusao',
        description: 'Solicitação de exclusão da própria conta via Perfil.',
        status: 'pendente',
      });
      alert("Solicitação registrada. Um administrador irá analisar e retornar em breve.");
    } catch (error) {
      alert("Erro ao registrar a solicitação.");
    }
    setIsRequestingDeletion(false);
  };

  const getPlanInfo = () => {
    const plans = {
      essencial: { name: "Essencial", price: "R$ 997/mês", limits: { contracts: 10, users: 5 }, color: "bg-green-100 text-green-800" },
      avancado: { name: "Avançado", price: "R$ 1.497/mês", limits: { contracts: 20, users: 10 }, color: "bg-blue-100 text-blue-800" },
      pro: { name: "Pro", price: "Sob consulta", limits: { contracts: "∞", users: "∞" }, color: "bg-purple-100 text-purple-800" },
      demo: { name: "Demonstração", price: "7 dias grátis", limits: { contracts: 5, users: 5 }, color: "bg-yellow-100 text-yellow-800" },
      none: { name: "Nenhum plano", price: "Escolha um plano", limits: { contracts: 0, users: 0 }, color: "bg-muted text-muted-foreground" }
    };
    return plans[effectivePlan || 'none'];
  };

  if (!user) {
    return (
      <div className="p-8 flex justify-center">
        <div className="text-center">
          {loadError ? (
            <>
              <p className="text-muted-foreground mb-3">Não foi possível carregar o perfil.</p>
              <Button onClick={loadAllData}>Tentar novamente</Button>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando perfil...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const planInfo = getPlanInfo();
  const taxRegimeLabels = {
    simples_nacional: "Simples Nacional",
    lucro_presumido: "Lucro Presumido",
    lucro_real: "Lucro Real",
    outros: "Outros"
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
       <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Perfil da Empresa</h1>
        <p className="text-muted-foreground">Gerencie suas informações e acompanhe o uso do seu plano</p>
      </div>
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Crown className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <span className="text-xl font-bold text-foreground">Plano {planInfo.name}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${planInfo.color}`}>
                    {planInfo.price}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">
                  Limite: {planInfo.limits.contracts} contratos • {planInfo.limits.users} usuários
                </p>
              </div>
            </div>
            {user.department === 'admin' && (
              <Button
                onClick={() => navigate(createPageUrl("PricingPage"))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Upgrade de Plano
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contratos em uso</p>
                <p className="text-3xl font-bold text-blue-600">
                  {stats.contracts} / {planInfo.limits.contracts}
                </p>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${planInfo.limits.contracts === "∞" ? 20 : (stats.contracts / planInfo.limits.contracts) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuários do Sistema</p>
                <p className="text-3xl font-bold text-green-600">
                  {stats.actualUsers} / {planInfo.limits.users}
                </p>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${planInfo.limits.users === "∞" ? 20 : (stats.actualUsers / planInfo.limits.users) * 100}%`
                    }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Admins + Gestores + RH + Financeiro</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Funcionários Cadastrados</p>
                <p className="text-3xl font-bold text-purple-600">
                  {stats.employees}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Não limitado pelo plano</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">∞</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              👤
            </div>
            Informações do Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-4">Foto de Perfil</h3>
              <div className="flex items-center space-x-6">
                <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                  <AvatarImage src={user.photo_url} />
                  <AvatarFallback className="text-3xl bg-blue-100 text-blue-700">
                    {user.full_name?.charAt(0) || <Camera className="w-8 h-8" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="photo_url" className="cursor-pointer">
                    <div className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors">
                      <Camera className="w-4 h-4" />
                      <span>{isUploading ? "Enviando..." : "Alterar Foto"}</span>
                    </div>
                  </Label>
                  <Input id="photo_url" type="file" className="hidden" onChange={(e) => handleFileChange(e, 'profile')} accept="image/*" disabled={isUploading} />
                  <p className="text-sm text-muted-foreground mt-2">PNG, JPG, WEBP até 5MB</p>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-lg">
              <h3 className="font-semibold text-indigo-900 mb-4">Logo da Empresa *</h3>
              <div className="flex items-center space-x-6">
                {formData.company_logo_url ? (
                  <img src={formData.company_logo_url} alt="Logo da empresa" className="w-32 h-auto object-contain bg-card p-2 rounded-md border border-border" />
                ) : (
                  <div className="w-32 h-24 border-2 border-dashed border-border rounded-md flex items-center justify-center text-muted-foreground">
                    Sem logo
                  </div>
                )}
                <div>
                  <Label htmlFor="company_logo_url" className="cursor-pointer">
                    <div className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>{isUploadingLogo ? "Enviando..." : "Alterar Logo"}</span>
                    </div>
                  </Label>
                  <Input id="company_logo_url" type="file" className="hidden" onChange={(e) => handleFileChange(e, 'logo')} accept="image/*" disabled={isUploadingLogo} />
                  <p className="text-sm text-muted-foreground mt-2">Obrigatório para gerar relatórios e recibos</p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-6 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-4">Informações Empresariais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="company_name" className="text-sm font-medium text-foreground">Nome da Empresa *</Label>
                  <Input id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} required className="mt-1" placeholder="Nome da sua empresa" />
                </div>
                <div>
                  <Label htmlFor="cnpj" className="text-sm font-medium text-foreground">CNPJ *</Label>
                  <CnpjLookupInput
                    id="cnpj"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleChange}
                    onFound={(data) => setFormData((prev) => ({
                      ...prev,
                      company_name: prev.company_name || data.nome || prev.company_name,
                      company_address: prev.company_address || data.endereco || prev.company_address,
                    }))}
                    required
                    className="mt-1"
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="company_address" className="text-sm font-medium text-foreground">Endereço da Empresa *</Label>
                  <Input id="company_address" name="company_address" value={formData.company_address} onChange={handleChange} required className="mt-1" placeholder="Endereço completo" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">Regime Tributário *</Label>
                  <Select value={formData.tax_regime} onValueChange={(v) => handleSelectChange("tax_regime", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o regime" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(taxRegimeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-4">Informações Pessoais e de Assinatura</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="full_name" className="text-sm font-medium text-foreground">Nome Completo *</Label>
                  <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} required className="mt-1" placeholder="Seu nome completo" />
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                  <Input id="email" value={user.email} disabled className="mt-1 bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">Email não pode ser alterado</p>
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground">Telefone *</Label>
                  <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required className="mt-1" placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <Label htmlFor="cargo" className="text-sm font-medium text-foreground">Cargo / Função *</Label>
                  <Input id="cargo" name="cargo" value={formData.cargo} onChange={handleChange} required className="mt-1" placeholder="Ex: Diretor de Contratos" />
                </div>
                <div>
                  <Label htmlFor="matricula" className="text-sm font-medium text-foreground">Matrícula Funcional *</Label>
                  <Input id="matricula" name="matricula" value={formData.matricula} onChange={handleChange} required className="mt-1" placeholder="Ex: 001234" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">Nível de Acesso</Label>
                  <Input value={user.department?.toUpperCase() || 'ADMIN'} disabled className="mt-1 bg-muted capitalize" />
                </div>
              </div>
            </div>
            
             <div className="bg-muted/30 p-6 rounded-lg">
              <h3 className="font-semibold text-foreground mb-4">Informações do Sistema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-foreground">Data de Cadastro</Label>
                  <Input value={user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'Não disponível'} disabled className="mt-1 bg-muted" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">Última Atualização</Label>
                  <Input value={user.updated_at ? new Date(user.updated_at).toLocaleDateString('pt-BR') : 'Não disponível'} disabled className="mt-1 bg-muted" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t">
              <Button type="submit" disabled={isSaving} className={`px-8 py-3 ${saveSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSaving ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Salvando...</>) : saveSuccess ? (<><CheckCircle className="w-4 h-4 mr-2" />Salvo com Sucesso!</>) : (<><Save className="w-4 h-4 mr-2" />Salvar Alterações</>)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Meus Dados (LGPD) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldCheck className="w-6 h-6 mr-3 text-blue-600" />
            Meus Dados (LGPD)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nos termos da LGPD (Lei nº 13.709/2018), você pode exportar uma cópia dos seus dados pessoais
            ou solicitar a exclusão da sua conta. Consulte também a{" "}
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Política de Privacidade
            </a>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExportMyData} disabled={isExportingData} className="gap-2">
              <DownloadCloud className="w-4 h-4" />
              {isExportingData ? "Exportando..." : "Exportar meus dados"}
            </Button>
            <Button variant="outline" onClick={handleRequestDeletion} disabled={isRequestingDeletion} className="gap-2 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30">
              <Trash2 className="w-4 h-4" />
              {isRequestingDeletion ? "Enviando..." : "Solicitar exclusão da minha conta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Outros CNPJs (solicitações e acessos concedidos) */}
      {(myCnpjRequests.length > 0 || myCnpjAccess.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShieldCheck className="w-6 h-6 mr-3 text-blue-600" />
              Outros CNPJs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myCnpjAccess.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Acessos concedidos</h4>
                <div className="flex flex-wrap gap-2">
                  {myCnpjAccess.map((a) => (
                    <Badge key={a.id} className="bg-green-100 text-green-800">{a.cnpj}</Badge>
                  ))}
                </div>
              </div>
            )}
            {myCnpjRequests.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Minhas solicitações</h4>
                <div className="space-y-2">
                  {myCnpjRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                      <span className="text-foreground">{req.cnpj}</span>
                      <div className="flex items-center gap-2">
                        <Badge className={
                          req.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                          req.status === 'rejeitado' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }>
                          {req.status || 'pendente'}
                        </Badge>
                        {user.department === 'admin' && (!req.status || req.status === 'pendente') && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Aprovar"
                            onClick={() => handleApproveCnpjRequest(req)}
                            className="h-7 w-7 text-muted-foreground hover:text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Cancelar solicitação"
                          onClick={() => handleCancelCnpjRequest(req)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Solicitações pendentes precisam ser aprovadas por um administrador em Configurações da Empresa.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Management Card (apenas para admins) */}
      {user.department === 'admin' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <ShieldCheck className="w-6 h-6 mr-3 text-blue-600" />
                Gestão de Usuários
              </CardTitle>
              <Button variant="outline" onClick={() => setIsInviteModalOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Membro
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Convites Pendentes */}
            {pendingInvites.length > 0 && (
                <div className="mb-8">
                    <h4 className="text-lg font-semibold mb-3 text-foreground">Convites Pendentes</h4>
                    <div className="space-y-2">
                        {pendingInvites.map(invite => (
                            <div key={invite.id} className="flex flex-wrap items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200 gap-2">
                                <div>
                                    <p className="font-medium text-yellow-900">{invite.full_name}</p>
                                    <p className="text-sm text-yellow-800">{invite.email}</p>
                                    <p className="text-xs text-yellow-700 mt-1">Expira em: {format(new Date(invite.expires_at), 'dd/MM/yyyy HH:mm')}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const link = `${window.location.origin}/AcceptInvite?code=${invite.invite_code}`;
                                        navigator.clipboard.writeText(link);
                                        alert("Link de convite copiado!");
                                    }}>
                                        <Copy className="w-4 h-4 mr-2" /> Copiar Link
                                    </Button>
                                    <Button size="icon" variant="destructive" onClick={() => handleDeleteInvite(invite.id)} title="Cancelar convite">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Tabela de Membros Ativos */}
            <h4 className="text-lg font-semibold mb-3 text-foreground">Membros da Equipe</h4>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.length > 0 ? (
                    teamMembers.map(member => {
                      const isInactive = member.status === 'inativo' || member.department === 'canceled';
                      const isSelf = member.email === user.email;
                      
                      return (
                        <TableRow key={member.id} className={isInactive ? 'opacity-60 bg-muted/40' : ''}>
                          <TableCell className="font-medium">
                            {member.full_name}
                            {isSelf && <span className="text-xs text-blue-600 ml-2">(Você)</span>}
                          </TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>
                            <Badge variant={isInactive ? "secondary" : "default"} className="capitalize">
                              {isInactive ? 'Cancelado' : (
                                member.department === 'admin' ? 'Administrador' :
                                member.department === 'gestor' ? 'Gestor' :
                                member.department === 'financeiro' ? 'Financeiro' :
                                member.department === 'rh' ? 'RH' :
                                member.department === 'compras' ? 'Compras' :
                                member.department === 'comercial' ? 'Comercial' : 'Comercial'
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={isInactive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                              {isInactive ? 'Inativo' : 'Ativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {!isSelf && !isInactive && (
                                <Select
                                  value={member.department || 'comercial'}
                                  onValueChange={(newDepartment) => handleUpdateMemberRole(member.id, newDepartment)}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="gestor">Gestor</SelectItem>
                                    <SelectItem value="financeiro">Financeiro</SelectItem>
                                    <SelectItem value="rh">RH</SelectItem>
                                    <SelectItem value="compras">Compras</SelectItem>
                                    <SelectItem value="comercial">Comercial</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              
                              {!isSelf && (
                                <div className="flex space-x-1">
                                  {!isInactive ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleCancelUser(member)}
                                      title="Cancelar usuário"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReactivateUser(member)}
                                        title="Reativar usuário"
                                        className="text-green-600 hover:text-green-800"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteMember(member)}
                                        title="Excluir definitivamente"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                              
                              {isSelf && (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        Nenhum membro na equipe.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {user.department === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DownloadCloud className="w-6 h-6 mr-3 text-blue-600" />
              Backup de Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BackupManager user={user} />
          </CardContent>
        </Card>
      )}

      {user.department === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trash className="w-6 h-6 mr-3 text-red-600" />
              Ferramentas de Administração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Trash className="w-4 h-4 mr-2" />
                  Lixeira de Posts
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Gerenciador de Lixeira</DialogTitle>
                </DialogHeader>
                <TrashManager user={user} />
              </DialogContent>
            </Dialog>

            {/* Novo: Recuperação de Dados (Contratos) */}
            <div className="mt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Database className="w-4 h-4 mr-2" />
                    Recuperar Dados (Contratos)
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Recuperar Dados de Contratos</DialogTitle>
                  </DialogHeader>
                  <DataRecovery user={user} />
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Dicas para seu Perfil</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• Mantenha suas informações sempre atualizadas</li>
                <li>• O logo da empresa é obrigatório para gerar relatórios e recibos</li>
                <li>• O regime tributário correto é importante para os cálculos</li>
                <li>• Acompanhe o uso do seu plano para evitar atingir os limites</li>
                <li>• Em caso de dúvidas, consulte nossa central de ajuda</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <UserInviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          currentUser={user}
          onSuccess={loadAllData}
      />
    </div>
  );
}