import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, DollarSign, AlertTriangle, Users, TrendingUp, Clock, CheckCircle 
} from 'lucide-react';

export default function UniformDashboard({ dashboardData, deliveries, uniforms, employees, contracts }) {
  const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  // Calcular itens vencendo nos próximos 30 dias
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  const expiringItems = deliveries.filter(d => {
    if (!d.expiry_date || d.status !== 'em_uso') return false;
    const expiryDate = new Date(d.expiry_date);
    return expiryDate <= thirtyDaysFromNow && expiryDate >= today;
  });

  // Funcionários sem uniformes
  const employeesWithUniforms = new Set(deliveries.map(d => d.employee_id));
  const employeesWithoutUniforms = employees.filter(e => !employeesWithUniforms.has(e.id));

  // Custos por contrato
  const costsByContract = {};
  deliveries.forEach(delivery => {
    const contractId = delivery.contract_id;
    if (!costsByContract[contractId]) {
      costsByContract[contractId] = 0;
    }
    costsByContract[contractId] += delivery.total_cost || 0;
  });

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Uniformes</p>
                <p className="text-3xl font-bold text-blue-600">
                  {dashboardData.totalUniforms}
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Custo Total</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(dashboardData.totalCost)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vencendo em 30 dias</p>
                <p className={`text-3xl font-bold ${
                  dashboardData.expiringItems > 0 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {dashboardData.expiringItems}
                </p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${
                dashboardData.expiringItems > 0 ? 'text-orange-600' : 'text-green-600'
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sem Uniforme</p>
                <p className={`text-3xl font-bold ${
                  dashboardData.pendingEmployees > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {dashboardData.pendingEmployees}
                </p>
              </div>
              <Users className={`w-8 h-8 ${
                dashboardData.pendingEmployees > 0 ? 'text-red-600' : 'text-green-600'
              }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Pendências */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uniformes Vencendo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-orange-600" />
              Uniformes Vencendo (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringItems.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                Nenhum uniforme vencendo
              </div>
            ) : (
              <div className="space-y-3">
                {expiringItems.slice(0, 5).map((delivery, index) => {
                  const employee = employees.find(e => e.id === delivery.employee_id);
                  const uniform = uniforms.find(u => u.id === delivery.uniform_id);
                  const contract = contracts.find(c => c.id === delivery.contract_id);
                  
                  return (
                    <div key={index} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{employee?.name}</p>
                        <p className="text-xs text-gray-600">{uniform?.item_name} - {contract?.name}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-orange-100 text-orange-800">
                          {new Date(delivery.expiry_date).toLocaleDateString()}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {expiringItems.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{expiringItems.length - 5} outros itens vencendo
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Funcionários Sem Uniformes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-red-600" />
              Funcionários Sem Uniformes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeesWithoutUniforms.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                Todos os funcionários têm uniformes
              </div>
            ) : (
              <div className="space-y-3">
                {employeesWithoutUniforms.slice(0, 5).map((employee, index) => {
                  const contract = contracts.find(c => c.id === employee.contract_id);
                  
                  return (
                    <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{employee.name}</p>
                        <p className="text-xs text-gray-600">{employee.role} - {contract?.name}</p>
                      </div>
                      <Badge className="bg-red-100 text-red-800">
                        Pendente
                      </Badge>
                    </div>
                  );
                })}
                {employeesWithoutUniforms.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{employeesWithoutUniforms.length - 5} outros funcionários
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custos por Contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Custos por Contrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(costsByContract).map(([contractId, cost]) => {
              const contract = contracts.find(c => c.id === contractId);
              const contractDeliveries = deliveries.filter(d => d.contract_id === contractId);
              const totalItems = contractDeliveries.reduce((sum, d) => sum + (d.quantity || 0), 0);
              
              return (
                <div key={contractId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{contract?.name || 'Contrato não encontrado'}</p>
                    <p className="text-sm text-gray-600">{totalItems} uniformes entregues</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(cost)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}