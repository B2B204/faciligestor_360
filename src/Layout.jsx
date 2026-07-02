import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { TeamMember } from "@/entities/TeamMember";
import { BRAND } from "@/components/common/Branding";
import BrandLogo from "@/components/common/BrandLogo";
import { LayoutDashboard, FileText, Users, DollarSign, BarChart3,
  Menu, X, LogOut, Settings, Bell, ChevronDown, Package, Calculator,
  ClipboardCheck, ShoppingCart, ShieldCheck, Banknote, HeartPulse, Mail, Award, HandCoins, UsersRound, LineChart, LifeBuoy, Shirt, SlidersHorizontal, RefreshCw, Wallet, CalendarRange, Star, Landmark, Tags
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AccessBlocked from "./components/AccessBlocked";
import { hasPageAccess } from '@/components/permissions';
import AccessDeniedPage from "./pages/AccessDeniedPage";
import CnpjSwitcher from "./components/common/CnpjSwitcher";
import ThemeToggle from "./components/common/ThemeToggle";

const navItems = [
  { type: "link", title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard },
  { type: "link", title: "Reconhecimentos", url: createPageUrl("Recognitions"), icon: Award },

  {
    type: "group",
    title: "Comercial",
    icon: LineChart,
    subItems: [
      { title: "CRM", url: createPageUrl("CRM"), icon: UsersRound },
      { title: "Contratos", url: createPageUrl("Contracts"), icon: FileText },
      { title: "Reajuste Contratual", url: createPageUrl("ReajusteContratual"), icon: ClipboardCheck },
      { title: "Seguros e Laudos", url: createPageUrl("SegurosLaudos"), icon: HeartPulse },
    ],
  },

  {
    type: "group",
    title: "RH",
    icon: Users,
    subItems: [
      { title: "Funcionários", url: createPageUrl("Employees"), icon: Users },
      { title: "Onboarding/Offboarding", url: "/onboarding", icon: ClipboardCheck },
      { title: "Férias e Ausências", url: "/ferias-ausencias", icon: CalendarRange },
      { title: "Avaliação de Desempenho", url: "/avaliacao-desempenho", icon: Star },
      { title: "Recibos VA/VT", url: createPageUrl("AllowanceReceipts"), icon: Banknote },
    ],
  },

  {
    type: "group",
    title: "Financeiro",
    icon: HandCoins,
    subItems: [
      { title: "Painel Financeiro", url: "/finance-dashboard", icon: BarChart3 },
      { title: "Financeiro", url: createPageUrl("Financial"), icon: DollarSign },
      { title: "Contas Bancárias", url: "/bank-accounts", icon: Banknote },
      { title: "Contas a Pagar", url: "/accounts-payable", icon: Banknote },
      { title: "Contas a Receber", url: createPageUrl("AccountsReceivable"), icon: Banknote },
      { title: "Fluxo de Caixa", url: "/cash-flow", icon: LineChart },
      { title: "Recorrências", url: "/recorrencias", icon: RefreshCw },
      { title: "Orçamento", url: "/orcamento", icon: Wallet },
      { title: "Notas Fiscais", url: "/invoices", icon: FileText },
      { title: "Conciliação Bancária", url: "/bank-reconciliation", icon: Banknote },
      { title: "Exportações", url: "/exports", icon: BarChart3 },
      { title: "Backup Contábil", url: "/accounting-backup", icon: FileText },
      { title: "Configurações Fiscais", url: "/fiscal", icon: Settings },
      { title: "Regras Fiscais", url: "/regras-fiscais", icon: Landmark },
      { title: "Custos Indiretos", url: createPageUrl("IndirectCosts"), icon: Calculator },
      { title: "Centros de Custo", url: "/centros-de-custo", icon: Tags },
    ],
  },

  {
    type: "group",
    title: "Compras",
    icon: ShoppingCart,
    subItems: [
      { title: "Uniformes", url: createPageUrl("Uniforms"), icon: Shirt },
      { title: "Patrimônio", url: createPageUrl("Patrimony"), icon: ShieldCheck },
      { title: "Compras", url: createPageUrl("Supplies"), icon: Package },
    ],
  },


  { type: "link", title: "Ofícios/Comunicados", url: createPageUrl("Oficios"), icon: Mail },
  { type: "link", title: "Medição", url: createPageUrl("Measurements"), icon: ClipboardCheck },

  {
    type: "group",
    title: "Operações",
    icon: CalendarRange,
    subItems: [
      { title: "Ordens de Serviço", url: createPageUrl("OS"), icon: ClipboardCheck },
      { title: "Planejamento por Técnico", url: "/planejamento-tecnico", icon: CalendarRange },
    ],
  },

  {
    type: "group",
    title: "Análise e Outros",
    icon: BarChart3,
    subItems: [
      { title: "Alertas", url: createPageUrl("Alerts"), icon: Bell },
      { title: "Relatórios", url: createPageUrl("Reports"), icon: BarChart3 },
      { title: "DRE", url: "/dre", icon: BarChart3 },
      { title: "Marketplace", url: createPageUrl("Marketplace"), icon: ShoppingCart },
      { title: "Marketing", url: createPageUrl("Marketing"), icon: LineChart },
      { title: "Perfis de Usuário", url: createPageUrl("UserProfiles"), icon: Users },
      { title: "Configurações da Empresa", url: "/company-settings", icon: Settings },
    ],
  },

  { type: "link", title: "Suporte", url: createPageUrl("Support"), icon: LifeBuoy },
];


function CnpjSetupScreen({ user, onSaved }) {
  const [cnpj, setCnpj] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [companyAddress, setCompanyAddress] = React.useState('');
  const [lookingUp, setLookingUp] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [rfInfo, setRfInfo] = React.useState(null);

  const formatCnpj = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const handleCnpjChange = async (raw) => {
    const formatted = formatCnpj(raw);
    setCnpj(formatted);
    setRfInfo(null);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 14) {
      setLookingUp(true);
      setError('');
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        if (!res.ok) throw new Error('CNPJ não encontrado');
        const data = await res.json();
        const nome = data.nome_fantasia?.trim() || data.razao_social || '';
        const endereco = [data.logradouro, data.numero, data.municipio, data.uf].filter(Boolean).join(', ');
        setCompanyName(nome);
        setCompanyAddress(endereco);
        setRfInfo({
          situacao: data.descricao_situacao_cadastral,
          abertura: data.data_inicio_atividade,
          atividade: data.cnae_fiscal_descricao,
        });
      } catch (e) {
        setError('CNPJ não encontrado. Preencha os dados manualmente.');
      } finally {
        setLookingUp(false);
      }
    }
  };

  const handleSave = async () => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) { setError('CNPJ deve ter 14 dígitos.'); return; }
    if (!companyName.trim()) { setError('Informe o nome da empresa.'); return; }
    setSaving(true);
    setError('');
    try {
      await User.update(user.id, {
        cnpj: digits,
        company_name: companyName.trim(),
        company_address: companyAddress.trim(),
      });
      onSaved();
    } catch (err) {
      setError('Erro ao salvar. Tente novamente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏢</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Bem-vindo!</h2>
          <p className="text-muted-foreground mt-1 text-sm">Informe o CNPJ da sua empresa para começar.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">CNPJ da Empresa</label>
            <div className="relative">
              <input
                type="text"
                value={cnpj}
                onChange={e => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-10"
              />
              {lookingUp && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {rfInfo && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded text-xs text-green-700 dark:text-green-400">
                ✓ Empresa encontrada — Situação: {rfInfo.situacao} · Desde {rfInfo.abertura}
                {rfInfo.atividade && <span> · {rfInfo.atividade}</span>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome / Razão Social</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Preenchido automaticamente"
              className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Endereço</label>
            <input
              type="text"
              value={companyAddress}
              onChange={e => setCompanyAddress(e.target.value)}
              placeholder="Preenchido automaticamente"
              className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || lookingUp}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-4 py-3 rounded-lg font-medium text-sm transition-colors"
          >
            {saving ? 'Salvando...' : 'Entrar no Sistema'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">Logado como {user?.email}</p>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [openMenu, setOpenMenu] = useState(null);
  const [density, setDensity] = useState('comfortable');

  useEffect(() => {
    // Abrir automaticamente o grupo que contém a página ativa
    const activeMenu = navItems.find(
      (item) => item.subItems && item.subItems.some((sub) => sub.url === location.pathname)
    );
    if (activeMenu) setOpenMenu(activeMenu.title);
  }, [location.pathname]);

  useEffect(() => {
    // Páginas públicas não precisam de autenticação
    const publicPages = ['AcceptInvite'];
    if (publicPages.includes(currentPageName)) {
      setIsLoadingUser(false);
      return;
    }
    loadUser();
  }, [currentPageName]);

  // Densidade da interface (confortável/compacta) com persistência
  useEffect(() => {
    const stored = localStorage.getItem('ui-density');
    if (stored === 'compact') setDensity('compact');
  }, []);
  useEffect(() => {
    localStorage.setItem('ui-density', density);
  }, [density]);

  const loadUser = async () => {
    setIsLoadingUser(true);
    try {
      const currentUser = await User.me();
      console.log("👤 Usuário autenticado no FaciliGestor360:", currentUser);

      // PRIMEIRO: Verificar se é um membro da equipe convidado
      let teamMembers = [];
      try {
        teamMembers = await TeamMember.filter({ email: currentUser.email });
        console.log("🔍 Buscando TeamMembers para:", currentUser.email, "Encontrados:", teamMembers.length);
      } catch (error) {
        console.log("⚠️ Erro ao buscar TeamMembers:", error);
      }

      if (teamMembers.length > 0) {
        // É um membro convidado - verificar se está ativo
        const memberData = teamMembers[0];
        console.log("📋 Dados do TeamMember:", memberData);
        
        if (memberData.status === 'ativo') {
          // Usuário convidado ATIVO - dar acesso direto
          const hybridUser = {
            ...currentUser,
            department: memberData.department,
            cnpj: memberData.cnpj,
            is_team_member: true // Flag para identificar
          };

          setUser(hybridUser);
          setIsSubscriptionActive(true); // ✅ ACESSO DIRETO
          console.log("✅ TeamMember ATIVO encontrado. Acesso concedido automaticamente:", hybridUser.email);
          
        } else {
          // Membro convidado mas INATIVO
          console.log("❌ TeamMember encontrado mas INATivo:", memberData.status);
          setIsSubscriptionActive(false);
          setUser({
            ...currentUser,
            department: memberData.department,
            cnpj: memberData.cnpj,
            is_team_member: true,
            member_status: memberData.status
          });
        }
      } else {
        // É o usuário principal (administrador da conta)
        console.log("👑 Usuário é o proprietário da conta (Admin)");
        setUser(currentUser);
        
        // Para admins, verificar o status do plano normalmente
        if (currentUser?.plan_status === 'active' || currentUser?.plan_status === 'demo') {
          setIsSubscriptionActive(true);
          console.log("✅ Admin com plano ativo:", currentUser.plan_status);
        } else {
          setIsSubscriptionActive(false);
          console.log("❌ Admin sem plano ativo:", currentUser.plan_status);
        }
      }

    } catch (error) {
      console.warn("❌ Sessão expirada. Redirecionando para autenticação.", error);
      
      // Mostrar tela personalizada antes do redirecionamento
      const authOverlay = document.createElement('div');
      authOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      
      authOverlay.innerHTML = `
        <div style="text-align: center; max-width: 400px; padding: 40px;">
          <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="height:56px; margin-bottom:16px; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" />
          <h2 style="font-size: 28px; margin-bottom: 16px;">Sessão Expirada</h2>
          <p style="font-size: 18px; margin-bottom: 24px; opacity: 0.9;">
            Por segurança, você precisa fazer login novamente no ${BRAND.name}.
          </p>
          <p style="font-size: 16px; opacity: 0.8;">
            Redirecionando para área de login...
          </p>
          <div style="margin-top: 30px;">
            <div style="width: 40px; height: 40px; border: 3px solid white; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
          </div>
        </div>
        <style>
          @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
        </style>
      `;
      
      document.body.appendChild(authOverlay);
      
      setTimeout(() => {
        // Substitui redirecionamento externo por método nativo, sem referência a provedores externos
        try {
          const callbackUrl = window.location.href;
          User.loginWithRedirect(callbackUrl);
        } catch (e) {
          // fallback
          window.location.reload();
        }
      }, 2500);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleSubscriptionUpdate = () => {
    setTimeout(() => {
      loadUser();
    }, 500);
  };

  const toggleDensity = () => setDensity(d => d === 'compact' ? 'comfortable' : 'compact');

  const handleLogout = async () => {
    if (window.confirm("Tem certeza que deseja sair do FaciliGestor360?")) {
      try {
        const logoutOverlay = document.createElement('div');
        logoutOverlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        logoutOverlay.innerHTML = `
          <div style="text-align: center; max-width: 500px; padding: 40px; animation: fadeIn 0.5s ease-in;">
            <img src="${BRAND.logoUrl}" alt="${BRAND.name}" style="height:64px; margin-bottom:20px; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" />
            <h2 style="font-size: 28px; margin-bottom: 16px; font-weight: 700;">Até breve!</h2>
            <p style="font-size: 18px; margin-bottom: 24px; opacity: 0.95;">Sua sessão está sendo finalizada com segurança.</p>
            <div style="margin-top: 10px;">
              <div style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
          </div>
          <style>
            @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
            @keyframes fadeIn { 0% { opacity: 0; transform: translateY(20px);} 100% { opacity: 1; transform: translateY(0);} }
          </style>
        `;
        document.body.appendChild(logoutOverlay);
        
        setTimeout(async () => {
          try {
            await User.logout();
          } catch (error) {
            console.error("Processo de logout concluído (com possível erro de comunicação, mas forçando redirecionamento)");
            // Redirecionar para página personalizada mesmo com erro
            window.location.href = window.location.origin + "/logout-success";
          }
          window.location.href = window.location.origin + "/logout-success"; // Always redirect after delay
        }, 3000);
        
      } catch (error) {
        console.error("Erro no processo de logout:", error);
        alert("Erro ao sair do sistema. Sua sessão será encerrada de qualquer forma.");
        // Forçar limpeza local e redirecionamento
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.error("Erro ao limpar armazenamento local/sessão:", e);
        }
        window.location.href = window.location.origin + "/logout-success";
      }
    }
  };

  // Se for página pública, não renderizar o layout principal
  if (['AcceptInvite'].includes(currentPageName)) {
    return <>{children}</>;
  }

  if (isLoadingUser) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <div className="text-center px-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-primary/10 border border-border shadow-lg">
            <BrandLogo className="h-10 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">{BRAND.name}</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground font-medium">Inicializando sistema...</p>
          <p className="text-sm text-muted-foreground mt-2">Carregando seu ambiente personalizado</p>
        </div>
      </div>
    );
  }

  // ✅ BLOQUEIO APENAS SE:
  // - Não tem assinatura ativa E
  // - NÃO é um TeamMember ativo
  if (!isSubscriptionActive) {
    // Se é um TeamMember inativo, mostrar mensagem específica
    if (user?.is_team_member && user?.member_status !== 'ativo') {
      return (
        <div className="w-screen h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full">
            <div className="bg-card border border-border rounded-xl shadow-2xl p-8 text-center border-t-4 border-t-orange-500">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Conta Temporariamente Inativa</h2>
              <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
                <p className="text-orange-800 dark:text-orange-300 mb-2">
                  <strong>Atenção:</strong> Sua conta no FaciliGestor360 foi temporariamente desativada.
                </p>
                <p className="text-orange-700 dark:text-orange-400 text-sm">
                  Entre em contato com o administrador da sua empresa para reativar seu acesso.
                </p>
              </div>
              <Button
                onClick={handleLogout}
                variant="destructive"
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair do Sistema
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                © 2025 {BRAND.name} - Sistema de Gestão de Facilities
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    // Caso contrário, mostrar tela de seleção de plano (apenas para admins sem plano)
    return <AccessBlocked user={user} onSubscriptionUpdate={handleSubscriptionUpdate} />;
  }

  // Bloqueia caso o usuário não tenha CNPJ configurado — mostra formulário inline
  if (user && !user.cnpj) {
    return <CnpjSetupScreen user={user} onSaved={() => loadUser()} />;
  }

  // Verificação de permissão de acesso à página
  if (!hasPageAccess(user?.department, currentPageName)) {
    return <AccessDeniedPage />;
  }

  return (
    <div className={`min-h-screen bg-background flex ${density === 'compact' ? 'density-compact' : 'density-comfortable'}`}>
      {/* CSS global para responsividade avançada */}
      <style>{`
        html { font-size: clamp(14px, 1.1vw + 9px, 16px); }
        :root { --radius: 12px; --container-max: 1440px; }

        .app-content h1 { font-size: clamp(1.6rem, 1.1rem + 2vw, 2.4rem); line-height: 1.2; }
        .app-content h2 { font-size: clamp(1.3rem, 1rem + 1.5vw, 2rem); line-height: 1.25; }
        .app-content h3 { font-size: clamp(1.1rem, 0.9rem + 1vw, 1.5rem); line-height: 1.3; }

        .app-content img, .app-content video, .app-content canvas, .app-content svg {
          max-width: 100%; height: auto; border-radius: var(--radius);
        }

        /* Números/currency: nunca quebrar linha e usar largura tabular */
        .kpi-value, .mono-number { white-space: nowrap; font-variant-numeric: tabular-nums; letter-spacing: 0; }
        .nowrap { white-space: nowrap; }

        /* Tabelas */
        .app-content table { width: 100%; table-layout: auto; border-collapse: separate; border-spacing: 0; }
        .app-content th, .app-content td { vertical-align: middle; white-space: nowrap; }
        .app-content th { font-weight: 600; color: #4b5563; }
        .app-content .badge { white-space: nowrap; }
        .app-content td .cell-wrap { white-space: normal; overflow-wrap: break-word; word-break: normal; }

        .app-shell { padding-inline: clamp(8px, 2vw, 24px); }

        /* Evitar quebras agressivas globais (remove 'anywhere') */
        .app-content { word-break: normal; overflow-wrap: break-word; hyphens: manual; }

        .app-content .overflow-x-auto, .app-content .overflow-auto { -webkit-overflow-scrolling: touch; }

        @media (max-width: 640px) {
          .app-content p, .app-content li, .app-content td, .app-content th { font-size: 0.97rem; }
        }

        .app-content .rounded, .app-content .rounded-md, .app-content .rounded-lg, .app-content .rounded-xl {
          border-radius: var(--radius);
        }

        @media print { .app-content { padding: 0 !important; } }
      `}</style>

      <style>{`
        /* Melhorias globais: cabeçalhos fixos, zebra, hover, densidade e scrollbars */
        html { font-size: clamp(14px, 1.12vw + 8px, 16.5px); }

        /* Densidade */
        .density-compact .app-content table th,
        .density-compact .app-content table td { padding-top: 0.4rem; padding-bottom: 0.4rem; }
        .density-compact .app-shell { padding-inline: clamp(6px, 1.4vw, 16px); }
        .density-comfortable .app-shell { padding-inline: clamp(10px, 2.4vw, 28px); }
        .density-compact .app-content h1 { font-size: clamp(1.4rem, 1rem + 1.6vw, 2.1rem); }

        /* Tabelas com cabeçalho fixo e melhor leitura */
        .app-content table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: hsl(var(--card));
          box-shadow: inset 0 -1px 0 rgba(0,0,0,0.06), 0 1px 0 rgba(0,0,0,0.03);
        }
        .app-content tbody tr:nth-child(even) { background-color: hsl(var(--muted)); }
        .app-content tbody tr:hover { background-color: hsl(var(--accent)); }

        /* Tabs responsivas no mobile */
        @media (max-width: 640px) {
          [role="tablist"] {
            display: flex;
            overflow-x: auto;
            gap: 0.5rem;
            padding: 0.25rem 0.25rem 0.5rem;
            -webkit-overflow-scrolling: touch;
          }
          [role="tablist"] > * { flex: 0 0 auto; }
          [role="tab"] {
            padding-inline: 0.75rem;
            padding-block: 0.4rem;
            font-size: 0.9rem;
          }
        }

        /* Scrollbars suaves (WebKit e Firefox) */
        * { scrollbar-width: thin; scrollbar-color: #c7d2fe transparent; }
        *::-webkit-scrollbar { width: 10px; height: 10px; }
        *::-webkit-scrollbar-thumb {
          background-color: #c7d2fe;
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        *::-webkit-scrollbar-track { background: transparent; }
      `}</style>
      {/* Sidebar Mobile/Desktop */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 sm:w-64 bg-card shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="relative overflow-hidden flex items-center justify-between p-4 sm:p-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 shadow-md">
            {/* Decorative glow accents */}
            <div className="pointer-events-none absolute -top-8 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-8 w-28 h-28 bg-blue-400/20 rounded-full blur-2xl" />

            <div className="relative flex items-center gap-3 min-w-0">
              {/* Replaced img tag with BrandLogo component */}
              <BrandLogo className="h-8 sm:h-9 w-auto bg-white/0" />
              <div className="hidden sm:block min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight truncate">{BRAND.name}</h1>
                <p className="flex items-center gap-1.5 text-xs text-blue-200 font-medium mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Gestão completa
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="relative lg:hidden text-white hover:bg-white/20 shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              if (item.type === "link") {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`flex items-center space-x-3 px-3 sm:px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              }

              // Grupos (menus com subitens)
              const isMenuOpen = openMenu === item.title;
              const isCategoryActive =
                item.subItems && item.subItems.some((sub) => sub.url === location.pathname);

              return (
                <div key={item.title} className="pt-1">
                  <button
                    onClick={() => setOpenMenu(isMenuOpen ? null : item.title)}
                    className={`flex items-center justify-between w-full space-x-3 px-3 sm:px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
                      isCategoryActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isMenuOpen && (
                    <div className="pl-3 sm:pl-4 pt-1 pb-2 space-y-1">
                      {item.subItems.map((sub) => {
                        const isActive = location.pathname === sub.url;
                        return (
                          <Link
                            key={sub.title}
                            to={sub.url}
                            className={`flex items-center space-x-3 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                              isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <sub.icon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{sub.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Profile com branding personalizado */}
          <div className="p-3 sm:p-4 border-t border-border bg-card">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-3 h-auto hover:bg-accent">
                  <div className="flex items-center space-x-3 w-full min-w-0">
                    <Avatar className="w-8 h-8 flex-shrink-0 ring-2 ring-blue-200">
                      <AvatarImage src={user?.photo_url} />
                      <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                        {user?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user?.full_name || 'Usuário'}
                      </p>
                      <p className="text-xs text-primary capitalize truncate font-medium">
                        {user?.department === 'admin' ? '👑 Administrador' :
                                                       user?.department === 'gestor' ? '🎯 Gestor' :
                                                       user?.department === 'financeiro' ? '💰 Financeiro' :
                                                       user?.department === 'rh' ? '👥 RH' :
                                                       user?.department === 'comercial' ? '📈 Comercial' :
                                                       user?.department === 'compras' ? '🛒 Compras' : 'Usuário'}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuItem onClick={() => navigate(createPageUrl("Profile"))}>
                  <Settings className="w-4 h-4 mr-2" />
                  Configurações da Conta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair do {BRAND.name}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Header personalizado */}
        <header className="bg-card shadow-sm border-b border-border px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex-shrink-0"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent truncate">
                  {currentPageName === "Recognitions" ? "Reconhecimentos e Recados" :
                   currentPageName === "Dashboard" ? "Dashboard" :
                   currentPageName === "CRM" ? "CRM - Gestão de Relacionamento" :
                   currentPageName === "Contracts" ? "Contratos" :
                   currentPageName === "ReajusteContratual" ? "Reajustes Contratuais" :
                   currentPageName === "Measurements" ? "Medições" :
                   currentPageName === "Oficios" ? "Ofícios e Comunicados" :
                   currentPageName === "OS" ? "Ordens de Serviço" :
                   currentPageName === "Employees" ? "Funcionários" :
                   currentPageName === "Uniforms" ? "Gestão de Uniformes" :
                   currentPageName === "Patrimony" ? "Gestão Patrimonial" :
                   currentPageName === "SegurosLaudos" ? "Seguros e Laudos" :
                   currentPageName === "Financial" ? "Financeiro" :
                   currentPageName === "AllowanceReceipts" ? "Recibos de VA/VT" :
                   currentPageName === "AccountsReceivable" ? "Contas a Receber" :
                   currentPageName === "Reports" ? "Relatórios" :
                   currentPageName === "Supplies" ? "Gestão de Compras e Recibos" :
                   currentPageName === "IndirectCosts" ? "Custos Indiretos" :
                   currentPageName === "Marketplace" ? "Marketplace de Serviços" :
                   currentPageName === "Alerts" ? "Central de Alertas" :
                   currentPageName === "Marketing" ? "Marketing" :
                   currentPageName === "Support" ? "Suporte" :
                   currentPageName === "RecurringTemplates" ? "Recorrências" :
                   currentPageName === "Budget" ? "Orçamento" :
                   currentPageName === "TechnicianPlanning" ? "Planejamento por Técnico" :
                   currentPageName === "EmployeeOnboarding" ? "Onboarding / Offboarding" :
                   currentPageName === "LeaveCalendar" ? "Férias e Ausências" :
                   currentPageName === "PerformanceReviews" ? "Avaliação de Desempenho" :
                   currentPageName === "FiscalPositions" ? "Regras Fiscais" :
                   currentPageName === "CostCenters" ? "Centros de Custo" :
                   currentPageName === "Profile" ? "Perfil" : currentPageName}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {currentPageName === "CRM" ? "Gerencie leads, negócios e relacionamento com clientes" :
                   currentPageName === "Recognitions" ? "Celebre conquistas e comunique-se com a equipe" :
                   currentPageName === "AllowanceReceipts" ? "Gere e gerencie recibos de vale alimentação e transporte" :
                   currentPageName === "Oficios" ? "Gerencie ofícios e comunicados importantes" :
                   currentPageName === "OS" ? "Abra, acompanhe e encerre Ordens de Serviço por contrato e unidade" :
                   currentPageName === "Patrimony" ? "Gerencie o patrimônio da sua empresa" :
                   currentPageName === "SegurosLaudos" ? "Gerencie seguros e laudos de segurança" :
                   currentPageName === "Employees" ? "Gerencie os dados e informações dos funcionários" :
                   currentPageName === "Uniforms" ? "Controle a distribuição e estoque de uniformes" :
                   currentPageName === "Financial" ? "Gerencie todas as transações financeiras" :
                   currentPageName === "AccountsReceivable" ? "Monitore e gerencie suas contas a receber" :
                   currentPageName === "IndirectCosts" ? "Controle e analise seus custos indiretos" :
                   currentPageName === "Supplies" ? "Gerencie compras e recibos; importe itens de Nota Fiscal com um clique" :
                   currentPageName === "Marketplace" ? "Descubra serviços e produtos para sua gestão" :
                   currentPageName === "Alerts" ? "Gerencie e receba notificações importantes e alertas do sistema" :
                   currentPageName === "Marketing" ? "Crie e gerencie campanhas de marketing" :
                   currentPageName === "Support" ? "Acesse a base de conhecimento e entre em contato com o suporte" :
                   currentPageName === "Reports" ? "Acesse relatórios e análises de desempenho" :
                   currentPageName === "ReajusteContratual" ? "Gerencie e aplique reajustes aos contratos" :
                   currentPageName === "Measurements" ? "Acompanhe e registre as medições dos serviços" :
                   "Gerencie seus contratos de facilities com eficiência"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={toggleDensity} className="hidden sm:inline-flex">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                {density === 'compact' ? 'Compacto' : 'Conforto'}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleDensity} className="sm:hidden">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
              <CnpjSwitcher user={user} onChanged={loadUser} />
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full text-xs"></span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="app-shell">
            <div className="app-content max-w-screen-2xl mx-auto min-h-full">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}