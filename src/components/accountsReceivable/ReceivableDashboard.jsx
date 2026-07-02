import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { DollarSign, AlertCircle, CheckCircle, TrendingUp, Clock, Percent, Users, Frown } from 'lucide-react';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#dc2626'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border rounded shadow-lg">
        <p className="label font-bold">{`${label}`}</p>
        <p className="intro" style={{ color: payload[0].color }}>{`${payload[0].name} : ${payload[0].value} contas`}</p>
      </div>
    );
  }
  return null;
};

export default function ReceivableDashboard({ data }) {
  if (!data) return null;

  const { kpis, trendData, topOverdue, overdueByRange } = data;

  return (
    <div className="space-y-6 mb-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalAReceber)}</div>
            <p className="text-xs text-muted-foreground">Contas em aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{formatCurrency(kpis.totalVencido)}</div>
            <p className="text-xs text-muted-foreground">Soma em aberto de contas vencidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{formatCurrency(kpis.totalRecebido)}</div>
            <p className="text-xs text-muted-foreground">Soma de contas liquidadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo Médio Receb.</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.prazoMedioPagamento.toFixed(1)} dias</div>
            <p className="text-xs text-muted-foreground">Média do vencimento ao pagamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% Pontualidade</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.pontualidade.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Contas pagas até o vencimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos e Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Tendência de Recebimentos (Últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="Valor Recebido" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center text-sm">
                    <Users className="w-4 h-4 mr-2" />
                    Top 5 Clientes em Atraso
                </CardTitle>
                </CardHeader>
                <CardContent>
                <ul className="space-y-2">
                    {topOverdue.length > 0 ? topOverdue.map((client, index) => (
                    <li key={index} className="flex justify-between items-center text-sm">
                        <span className="font-medium truncate pr-2">{client.name}</span>
                        <Badge variant="destructive">{formatCurrency(client.value)}</Badge>
                    </li>
                    )) : (
                        <div className="text-center text-sm text-gray-500 py-4">
                            <CheckCircle className="mx-auto w-8 h-8 text-green-500 mb-2"/>
                            <p>Nenhum cliente com débitos vencidos.</p>
                        </div>
                    )}
                </ul>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center text-sm">
                        <Frown className="w-4 h-4 mr-2"/>
                        Atrasos por Faixa de Dias
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={overdueByRange} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" width={60} fontSize={12} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="Contas" name="Contas" barSize={20}>
                                {overdueByRange.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}