import React, { useState, useEffect } from 'react';
import { Lead } from '@/entities/Lead';
import { Deal } from '@/entities/Deal';
import { CrmActivity } from '@/entities/CrmActivity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Target, DollarSign, TrendingUp, 
  Calendar, Award, AlertCircle, Phone 
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function CrmDashboard({ user }) {
  const [dashboardData, setDashboardData] = useState({
    totalLeads: 0,
    totalDeals: 0,
    totalValue: 0,
    conversionRate: 0,
    wonDeals: 0,
    lostDeals: 0,
    leadsByOrigin: [],
    dealsByStage: [],
    recentActivities: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [leads, deals, activities] = await Promise.all([
        Lead.filter({ cnpj: user.cnpj }),
        Deal.filter({ cnpj: user.cnpj }),
        CrmActivity.filter({ cnpj: user.cnpj }, '-created_date', 10)
      ]);

      // Calcular KPIs
      const totalLeads = leads.length;
      const totalDeals = deals.length;
      const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
      const convertedLeads = leads.filter(l => l.converted_to_deal).length;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
      const wonDeals = deals.filter(d => d.stage === 'fechado_ganho').length;
      const lostDeals = deals.filter(d => d.stage === 'fechado_perdido').length;

      // Leads por origem
      const originCounts = {};
      leads.forEach(lead => {
        const origin = lead.origin || 'outros';
        originCounts[origin] = (originCounts[origin] || 0) + 1;
      });
      const leadsByOrigin = Object.entries(originCounts).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value
      }));

      // Negócios por estágio
      const stageCounts = {};
      deals.forEach(deal => {
        const stage = deal.stage || 'novo_lead';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });
      const dealsByStage = Object.entries(stageCounts).map(([stage, count]) => ({
        stage: stage.replace('_', ' ').toUpperCase(),
        count,
        value: deals.filter(d => d.stage === stage).reduce((sum, d) => sum + (d.value || 0), 0)
      }));

      setDashboardData({
        totalLeads,
        totalDeals,
        totalValue,
        conversionRate,
        wonDeals,
        lostDeals,
        leadsByOrigin,
        dealsByStage,
        recentActivities: activities
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard CRM:', error);
    }
    setIsLoading(false);
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 sm:p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs sm:text-sm font-medium">Total de Leads</p>
                <p className="text-2xl sm:text-3xl font-bold">{dashboardData.totalLeads}</p>
                <div className="flex items-center mt-1 sm:mt-2">
                  <Target className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="text-xs sm:text-sm">Este mês</span>
                </div>
              </div>
              <Target className="w-6 h-6 sm:w-8 sm:h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs sm:text-sm font-medium">Valor em Negócios</p>
                <p className="text-xl sm:text-3xl font-bold">{formatCurrency(dashboardData.totalValue)}</p>
                <div className="flex items-center mt-1 sm:mt-2">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="text-xs sm:text-sm">Pipeline total</span>
                </div>
              </div>
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs sm:text-sm font-medium">Taxa de Conversão</p>
                <p className="text-2xl sm:text-3xl font-bold">{dashboardData.conversionRate.toFixed(1)}%</p>
                <div className="flex items-center mt-1 sm:mt-2">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="text-xs sm:text-sm">Lead → Cliente</span>
                </div>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs sm:text-sm font-medium">Negócios Ganhos</p>
                <p className="text-2xl sm:text-3xl font-bold">{dashboardData.wonDeals}</p>
                <div className="flex items-center mt-1 sm:mt-2">
                  <Award className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="text-xs sm:text-sm">Este mês</span>
                </div>
              </div>
              <Award className="w-6 h-6 sm:w-8 sm:h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base">Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dashboardData.leadsByOrigin}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  fontSize={12}
                >
                  {dashboardData.leadsByOrigin.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base">Pipeline de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dashboardData.dealsByStage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'count' ? `${value} negócio(s)` : formatCurrency(value), 
                    name === 'count' ? 'Quantidade' : 'Valor'
                  ]}
                />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="Quantidade" />
                <Bar dataKey="value" fill="#82ca9d" name="Valor (R$)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Atividades Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm sm:text-base">Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            {dashboardData.recentActivities.length > 0 ? (
              dashboardData.recentActivities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    {activity.type === 'chamada' && <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />}
                    {activity.type === 'reuniao' && <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />}
                    {activity.type === 'email' && <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />}
                    {!['chamada', 'reuniao', 'email'].includes(activity.type) && <Target className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{activity.title}</h4>
                      <Badge variant="outline" className="mt-1 sm:mt-0 self-start">
                        {activity.type}
                      </Badge>
                    </div>
                    {activity.description && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">{activity.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.activity_date).toLocaleDateString('pt-BR')}
                      {activity.activity_time && ` às ${activity.activity_time}`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500">
                <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-sm sm:text-base">Nenhuma atividade recente</p>
                <p className="text-xs sm:text-sm">As atividades do CRM aparecerão aqui</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}