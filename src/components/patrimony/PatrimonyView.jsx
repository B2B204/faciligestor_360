
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Added import for Button
import { Package, Download, FileText } from 'lucide-react'; // Added Download and FileText icons
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function PatrimonyView({ patrimony, contract, movements = [] }) {
  const statusColors = {
    em_uso: 'bg-green-100 text-green-800',
    devolvido: 'bg-blue-100 text-blue-800',
    pendente: 'bg-yellow-100 text-yellow-800',
    extraviado: 'bg-red-100 text-red-800',
    manutencao: 'bg-orange-100 text-orange-800'
  };

  const statusLabels = {
    em_uso: 'Em Uso',
    devolvido: 'Devolvido',
    pendente: 'Pendente',
    extraviado: 'Extraviado',
    manutencao: 'Manutenção'
  };

  const equipmentTypes = {
    ferramenta: 'Ferramenta',
    maquinario: 'Maquinário',
    epi: 'EPI',
    mobiliario: 'Mobiliário',
    eletronico: 'Eletrônico',
    veiculo: 'Veículo',
    outros: 'Outros'
  };

  const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  return (
    <div className="space-y-6">
      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="w-5 h-5 mr-2" />
            {patrimony.equipment_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Número de Série</p>
              <p className="font-medium">{patrimony.serial_number || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tipo</p>
              <Badge variant="outline">
                {equipmentTypes[patrimony.equipment_type] || patrimony.equipment_type}
              </Badge>
            </div>
          </div>

          {patrimony.qr_code && (
            <div>
              <p className="text-sm text-gray-600">Código de Rastreamento (QR)</p>
              <p className="font-mono font-medium">{patrimony.qr_code}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge className={statusColors[patrimony.status]}>
                {statusLabels[patrimony.status]}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor</p>
              <p className="font-medium text-green-600">{formatCurrency(patrimony.equipment_value)}</p>
            </div>
          </div>

          {patrimony.depreciation_method && patrimony.depreciation_method !== 'none' && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <p className="text-sm text-gray-600">Depreciação Acumulada</p>
                <p className="font-medium text-amber-600">{formatCurrency(patrimony.accumulated_depreciation)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Valor Contábil Atual</p>
                <p className="font-medium">{formatCurrency(patrimony.current_book_value ?? patrimony.equipment_value)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Section */}
      {patrimony.qr_code_url && (
        <Card>
          <CardHeader>
            <CardTitle>QR Code do Patrimônio</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-4">
              <img src={patrimony.qr_code_url} alt="QR Code" className="mx-auto" />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Escaneie para acessar detalhes do equipamento
            </p>
            <div className="space-x-2 flex justify-center"> {/* Added flex and justify-center for button alignment */}
              <Button 
                variant="outline" 
                onClick={() => window.open(patrimony.qr_code_url, '_blank')}
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar QR Code
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = patrimony.qr_code_url;
                  link.download = `qr-code-${patrimony.serial_number}.png`;
                  link.click();
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Salvar PNG
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contrato e Alocação */}
      <Card>
        <CardHeader>
          <CardTitle>Alocação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Contrato Vinculado</p>
            <p className="font-medium">{contract?.name || 'N/A'}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Data de Alocação</p>
              <p className="font-medium">
                {patrimony.allocation_date ? 
                  format(new Date(patrimony.allocation_date), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Devolução Prevista</p>
              <p className="font-medium">
                {patrimony.expected_return_date ? 
                  format(new Date(patrimony.expected_return_date), 'dd/MM/yyyy', { locale: pt }) : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      {patrimony.observations && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{patrimony.observations}</p>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Movimentações */}
      {movements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movements.slice(0, 5).map((movement, index) => (
                <div key={index} className="border-l-2 border-blue-200 pl-4 pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize">
                      {movement.movement_type.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {format(new Date(movement.movement_date), 'dd/MM/yyyy', { locale: pt })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{movement.observations}</p>
                  <p className="text-xs text-gray-500">Por: {movement.responsible_user}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
