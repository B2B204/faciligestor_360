import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { TeamMember } from '@/entities/TeamMember';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Users, Target, Building, Calendar,
  TrendingUp, DollarSign,
  Loader2, AlertCircle
} from 'lucide-react';
import { canAccessCRM } from '@/components/permissions';
import LeadsTab from '@/components/crm/LeadsTab';
import ContactsTab from '@/components/crm/ContactsTab';
import CompaniesTab from '@/components/crm/CompaniesTab';
import DealsTab from '@/components/crm/DealsTab';
import ActivitiesTab from '@/components/crm/ActivitiesTab';
import CrmDashboard from '@/components/crm/CrmDashboard';

export default function CRMPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentUser = await User.me();
      if (!currentUser) {
        throw new Error("Usuário não autenticado");
      }

      // Determinar CNPJ
      let userCnpj = currentUser.cnpj;
      if (!userCnpj) {
        const teamMembers = await TeamMember.filter({ email: currentUser.email });
        if (teamMembers && teamMembers.length > 0) {
          userCnpj = teamMembers[0].cnpj;
        }
      }

      if (!userCnpj) {
        throw new Error("Não foi possível determinar o CNPJ da empresa");
      }

      // Verificar permissão de acesso ao CRM
      if (!canAccessCRM(currentUser.department)) {
        throw new Error("Você não tem permissão para acessar o CRM");
      }

      const userWithCnpj = { ...currentUser, cnpj: userCnpj };
      setUser(userWithCnpj);

    } catch (err) {
      console.error("❌ Erro ao carregar usuário:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-background min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando CRM...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-background min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Erro de Acesso</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = user?.department === 'admin' ? 'Administrador'
    : user?.department === 'gestor' ? 'Gestor'
    : 'Comercial';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie leads, negócios e relacionamento com clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-sm px-3 py-1">
            {roleLabel}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger
            value="dashboard"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Dashboard</span>
            <span className="sm:hidden">Dash</span>
          </TabsTrigger>
          <TabsTrigger
            value="leads"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            <Target className="w-4 h-4 shrink-0" />
            Leads
          </TabsTrigger>
          <TabsTrigger
            value="deals"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Negócios</span>
            <span className="sm:hidden">Neg.</span>
          </TabsTrigger>
          <TabsTrigger
            value="companies"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            <Building className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Empresas</span>
            <span className="sm:hidden">Emp.</span>
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Contatos</span>
            <span className="sm:hidden">Cont.</span>
          </TabsTrigger>
          <TabsTrigger
            value="activities"
            className="flex items-center gap-1.5 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Atividades</span>
            <span className="sm:hidden">Atv.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <CrmDashboard user={user} />
        </TabsContent>

        <TabsContent value="leads" className="space-y-6 mt-4">
          <LeadsTab user={user} />
        </TabsContent>

        <TabsContent value="deals" className="space-y-6 mt-4">
          <DealsTab user={user} />
        </TabsContent>

        <TabsContent value="companies" className="space-y-6 mt-4">
          <CompaniesTab user={user} />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6 mt-4">
          <ContactsTab user={user} />
        </TabsContent>

        <TabsContent value="activities" className="space-y-6 mt-4">
          <ActivitiesTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
