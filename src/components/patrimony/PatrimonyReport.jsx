
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Download, FileText, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function PatrimonyReport({ patrimonies, contracts, movements, user }) {
  const [selectedContract, setSelectedContract] = useState('all');
  const [reportType, setReportType] = useState('summary');

  const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const filteredData = selectedContract === 'all' 
    ? patrimonies 
    : patrimonies.filter(p => p.contract_id === selectedContract);

  const generateSummaryReport = () => {
    const contractSummary = contracts.map(contract => {
      const contractPatrimonies = patrimonies.filter(p => p.contract_id === contract.id);
      const totalValue = contractPatrimonies.reduce((sum, p) => sum + (p.equipment_value || 0), 0);
      const inUse = contractPatrimonies.filter(p => p.status === 'em_uso').length;
      const pendingReturn = contractPatrimonies.filter(p => 
        p.status === 'em_uso' && 
        p.expected_return_date && 
        new Date(p.expected_return_date) < new Date()
      ).length;

      return {
        contract,
        totalEquipments: contractPatrimonies.length,
        totalValue,
        inUse,
        pendingReturn
      };
    });

    return contractSummary;
  };

  const downloadReport = () => {
    const reportData = generateSummaryReport();
    const csvContent = [
      ['Contrato', 'Total de Equipamentos', 'Valor Total', 'Em Uso', 'Devoluções Pendentes'],
      ...reportData.map(item => [
        item.contract.name,
        item.totalEquipments,
        item.totalValue.toFixed(2),
        item.inUse,
        item.pendingReturn
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_patrimonio_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const summaryData = generateSummaryReport();

  return (
    <div className="space-y-6">
      {/* Controles do Relatório */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Relatórios Patrimoniais
            </span>
            <Button onClick={downloadReport} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Filtrar por Contrato</label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Contratos</SelectItem>
                  {contracts.map(contract => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Relatório</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Resumo por Contrato</SelectItem>
                  <SelectItem value="detailed">Detalhado por Equipamento</SelectItem>
                  <SelectItem value="overdue">Devoluções Atrasadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Relatório Resumo por Contrato */}
      {reportType === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Total de Equipamentos</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Em Uso</TableHead>
                  <TableHead>Devoluções Pendentes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.contract.name}</TableCell>
                    <TableCell>{item.totalEquipments}</TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(item.totalValue)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800">
                        {item.inUse} equipamentos
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.pendingReturn > 0 ? (
                        <Badge className="bg-red-100 text-red-800 flex items-center w-fit">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {item.pendingReturn} atrasados
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">Em dia</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Relatório Detalhado */}
      {reportType === 'detailed' && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhado por Equipamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data Alocação</TableHead>
                  <TableHead>Devolução Prevista</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((patrimony) => {
                  const contract = contracts.find(c => c.id === patrimony.contract_id);
                  return (
                    <TableRow key={patrimony.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{patrimony.equipment_name}</div>
                          <div className="text-sm text-gray-500">Nº: {patrimony.serial_number}</div>
                        </div>
                      </TableCell>
                      <TableCell>{contract?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {(patrimony.status || '').replace('_', ' ') || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(patrimony.equipment_value)}
                      </TableCell>
                      <TableCell>
                        {patrimony.allocation_date ? 
                          format(new Date(patrimony.allocation_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {patrimony.expected_return_date ? 
                          format(new Date(patrimony.expected_return_date), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Relatório de Devoluções Atrasadas */}
      {reportType === 'overdue' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-red-900">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Devoluções Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Devolução Prevista</TableHead>
                  <TableHead>Dias em Atraso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData
                  .filter(p => 
                    p.status === 'em_uso' && 
                    p.expected_return_date && 
                    new Date(p.expected_return_date) < new Date()
                  )
                  .map((patrimony) => {
                    const contract = contracts.find(c => c.id === patrimony.contract_id);
                    const daysOverdue = Math.ceil(
                      (new Date() - new Date(patrimony.expected_return_date)) / (1000 * 60 * 60 * 24)
                    );
                    
                    return (
                      <TableRow key={patrimony.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{patrimony.equipment_name}</div>
                            <div className="text-sm text-gray-500">Nº: {patrimony.serial_number}</div>
                          </div>
                        </TableCell>
                        <TableCell>{contract?.name || 'N/A'}</TableCell>
                        <TableCell className="text-red-600 font-medium">
                          {format(new Date(patrimony.expected_return_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-red-100 text-red-800">
                            {daysOverdue} dias
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
            {filteredData.filter(p => 
              p.status === 'em_uso' && 
              p.expected_return_date && 
              new Date(p.expected_return_date) < new Date()
            ).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-green-300" />
                <p>Nenhuma devolução atrasada! 🎉</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
