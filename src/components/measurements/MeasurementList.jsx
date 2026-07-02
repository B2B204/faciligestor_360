import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Measurement } from '@/entities/Measurement';

export default function MeasurementList({ measurements, contracts, isLoading, onEdit, onDataChange }) {

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta medição? Esta ação é irreversível.")) {
      try {
        await Measurement.delete(id);
        onDataChange();
      } catch (error) {
        console.error("Erro ao excluir medição:", error);
        alert("Falha ao excluir a medição.");
      }
    }
  };

  const getContractName = (contractId) => {
    return contracts.find(c => c.id === contractId)?.name || 'Contrato não encontrado';
  };
  
  const statusColors = {
    'Em execução': "bg-yellow-100 text-yellow-800",
    'Concluída': "bg-blue-100 text-blue-800",
    'Aprovada': "bg-green-100 text-green-800",
    'Rejeitada': "bg-red-100 text-red-800",
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contrato</TableHead>
            <TableHead>Mês/Ano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>% Executado</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando medições...</TableCell></TableRow>
          ) : measurements.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8">Nenhuma medição encontrada.</TableCell></TableRow>
          ) : (
            measurements.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{getContractName(m.contract_id)}</TableCell>
                <TableCell>{m.measurement_month}</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[m.status]} capitalize`}>{m.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${m.execution_percentage || 0}%` }}></div>
                    </div>
                    <span>{m.execution_percentage || 0}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-500">{m.created_by}</TableCell>
                <TableCell className="text-right">
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onEdit(m)}>
                          <Edit className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(m.id)} className="text-red-500">
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}