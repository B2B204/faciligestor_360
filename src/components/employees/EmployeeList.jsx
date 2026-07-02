import React, { useState } from "react";
import { Employee } from "@/entities/Employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Phone, ExternalLink, Users } from "lucide-react";
import { format } from "date-fns";
import { canPerformAction } from '@/components/permissions';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import DeleteConfirmation from "@/components/common/DeleteConfirmation";

export default function EmployeeList({ employees, contracts, onEdit, onDataChange, user, isLoading }) {
  const [itemToDelete, setItemToDelete] = useState(null);

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  // Helper function to get contract name
  const getContractName = (contractId, contracts) => {
    const contract = contracts.find(c => c.id === contractId);
    return contract ? contract.name : 'Sem Contrato';
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch (e) {
      console.error("Erro ao formatar data:", dateString, e);
      return 'Data Inválida';
    }
  };

  const handleDelete = async (employee) => {
    try {
      // CORREÇÃO: Soft delete com informações de auditoria
      await Employee.update(employee.id, {
        deleted_at: new Date().toISOString(),
        deleted_by: user?.email || 'unknown_user',
        status: 'inativo'
      });

      onDataChange();
      alert(`Funcionário "${employee.name}" foi excluído com sucesso.`);
    } catch (error) {
      console.error("❌ Erro ao excluir funcionário:", error);
      alert(`❌ Erro ao excluir funcionário: ${error.message || 'Tente novamente.'}`);
    }
  };

  // Filter out employees that have been soft-deleted (deleted_at is not null)
  const activeEmployees = employees.filter(emp => !emp.deleted_at);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando funcionários...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lista de Funcionários ({activeEmployees.length})</span>
            {activeEmployees.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                {activeEmployees.filter(emp => emp.status === 'ativo').length} ativos
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Nenhum funcionário encontrado</p>
              <p>Os funcionários cadastrados aparecerão aqui.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome & Função</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Salário Base</TableHead>
                    <TableHead>Custo Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeEmployees.map((employee) => (
                    <TableRow key={employee.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={employee.photo_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-700">
                              {employee.name?.charAt(0)?.toUpperCase() || 'F'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{employee.name}</p>
                            <p className="text-sm text-gray-500">{employee.role}</p>
                            {employee.email && (
                              <p className="text-xs text-gray-400">{employee.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {employee.cpf || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {getContractName(employee.contract_id, contracts)}
                          </p>
                          <p className="text-gray-500">
                            Admissão: {formatDate(employee.admission_date)}
                          </p>
                          {employee.dismissal_date && (
                            <p className="text-red-500">
                              Demissão: {formatDate(employee.dismissal_date)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {employee.unidade || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {formatCurrency(employee.base_salary)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-red-600">
                          {formatCurrency(employee.total_cost)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${employee.status === 'ativo' ? 'bg-green-100 text-green-800' : employee.status === 'ferias' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canPerformAction(user?.department || 'operador', 'edit') && (
                              <DropdownMenuItem onClick={() => onEdit(employee)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {employee.whatsapp && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={`https://wa.me/55${employee.whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center w-full"
                                >
                                  <Phone className="w-4 h-4 mr-2" />
                                  WhatsApp
                                </a>
                              </DropdownMenuItem>
                            )}
                            {employee.useful_link && (
                              <DropdownMenuItem asChild>
                                <a href={employee.useful_link} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center w-full"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Link Útil
                                </a>
                              </DropdownMenuItem>
                            )}
                            {canPerformAction(user?.department || 'operador', 'delete') && (
                              <DropdownMenuItem
                                onClick={() => setItemToDelete(employee)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Soft Delete */}
      {itemToDelete && (
        <DeleteConfirmation
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={() => {
            handleDelete(itemToDelete);
            setItemToDelete(null);
          }}
          title="Excluir Funcionário?"
          description="O funcionário será marcado como excluído e poderá ser restaurado posteriormente da lixeira."
          itemName={itemToDelete.name}
          isPermanent={false}
        />
      )}
    </>
  );
}