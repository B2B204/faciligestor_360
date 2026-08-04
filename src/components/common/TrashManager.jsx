
import React, { useState, useEffect } from 'react';
import { Contract } from '@/entities/Contract';
import { Employee } from '@/entities/Employee';
import { Post } from '@/entities/Post';
import { Supply } from '@/entities/Supply';
import { Patrimony } from '@/entities/Patrimony';
import { Uniform } from '@/entities/Uniform';
import { UniformDelivery } from '@/entities/UniformDelivery';
import { IndirectCost } from '@/entities/IndirectCost';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertTriangle, RotateCcw, Trash2, FileText, Users, Package, ShieldCheck, Calendar, User, Calculator } from 'lucide-react';
import DeleteConfirmation from './DeleteConfirmation';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { logDataAccess } from '@/lib/lgpdAudit';

const ENTITY_CONFIG = {
  posts: {
    name: 'Posts/Recados',
    entity: Post,
    icon: FileText,
    displayFields: ['content', 'created_by', 'deleted_by', 'deleted_at'],
    searchField: 'content'
  },
  contracts: {
    name: 'Contratos',
    entity: Contract,
    icon: FileText,
    displayFields: ['name', 'contract_number', 'client_name', 'deleted_by', 'deleted_at'],
    searchField: 'name'
  },
  employees: {
    name: 'Funcionários',
    entity: Employee,
    icon: Users,
    displayFields: ['name', 'cpf', 'role', 'deleted_by', 'deleted_at'],
    searchField: 'name'
  },
  supplies: {
    name: 'Suprimentos',
    entity: Supply,
    icon: Package,
    displayFields: ['organization', 'delivery_date', 'deleted_by', 'deleted_at'],
    searchField: 'organization'
  },
  patrimony: {
    name: 'Patrimônio',
    entity: Patrimony,
    icon: ShieldCheck,
    displayFields: ['equipment_name', 'serial_number', 'deleted_by', 'deleted_at'],
    searchField: 'equipment_name'
  },
  uniforms: {
    name: 'Uniformes',
    entity: Uniform,
    icon: Package,
    displayFields: ['item_name', 'size', 'category', 'deleted_by', 'deleted_at'],
    searchField: 'item_name'
  },
  uniform_deliveries: {
    name: 'Entregas de Uniformes',
    entity: UniformDelivery,
    icon: Package,
    displayFields: ['delivery_date', 'quantity', 'deleted_by', 'deleted_at'],
    searchField: 'delivery_date'
  },
  indirect_costs: {
    name: 'Custos Indiretos',
    entity: IndirectCost,
    icon: Calculator,
    displayFields: ['description', 'cost_type', 'monthly_value', 'deleted_by', 'deleted_at'],
    searchField: 'description'
  }
};

export default function TrashManager({ user }) {
  const [deletedItems, setDeletedItems] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [selectedEntity, setSelectedEntity] = useState('all');

  useEffect(() => {
    loadAllDeletedItems();
  }, []);

  const loadAllDeletedItems = async () => {
    setIsLoading(true);
    setError(null);
    const items = {};

    try {
      for (const [key, config] of Object.entries(ENTITY_CONFIG)) {
        try {
          console.log(`🗑️ Carregando itens excluídos de ${config.name}...`);
          
          // Buscar itens com deleted_at não nulo
          const deletedData = await config.entity.list();
          const filteredData = deletedData.filter(item => 
            item.deleted_at && 
            item.cnpj === user.cnpj
          );
          
          items[key] = filteredData.map(item => ({
            ...item,
            entityType: key,
            entityName: config.name
          }));
          
          console.log(`✅ ${config.name}: ${items[key].length} itens excluídos encontrados`);
        } catch (err) {
          console.warn(`⚠️ Erro ao carregar ${config.name}:`, err.message);
          items[key] = [];
        }
      }
      
      setDeletedItems(items);
    } catch (err) {
      setError("Erro ao carregar itens da lixeira.");
      console.error("Erro geral na lixeira:", err);
    }
    setIsLoading(false);
  };

  const handleRestore = async (item) => {
    try {
      const config = ENTITY_CONFIG[item.entityType];
      await config.entity.update(item.id, {
        deleted_at: null,
        deleted_by: null
      });
      
      // Recarregar dados
      loadAllDeletedItems();
      alert(`${item.entityName} "${getItemDisplayName(item)}" foi restaurado com sucesso!`);
    } catch (err) {
      alert(`Erro ao restaurar ${item.entityName}.`);
      console.error("Erro ao restaurar:", err);
    }
  };

  const handleDeletePermanently = async () => {
    if (!itemToDelete) return;
    try {
      const config = ENTITY_CONFIG[itemToDelete.entityType];
      await config.entity.delete(itemToDelete.id);
      if (itemToDelete.entityType === 'employees') {
        await logDataAccess({
          user,
          action: 'exclusao',
          resourceType: 'employee',
          resourceId: itemToDelete.id,
          resourceLabel: getItemDisplayName(itemToDelete),
        });
      }
      setItemToDelete(null);
      loadAllDeletedItems();
      alert(`${itemToDelete.entityName} foi excluído permanentemente.`);
    } catch (err) {
      alert("Erro ao excluir permanentemente.");
      console.error("Erro na exclusão permanente:", err);
    }
  };

  const getItemDisplayName = (item) => {
    const config = ENTITY_CONFIG[item.entityType];
    const field = config.searchField;
    return item[field] || `ID: ${item.id}`;
  };

  const getAllDeletedItems = () => {
    return Object.values(deletedItems).flat().sort((a, b) => 
      new Date(b.deleted_at) - new Date(a.deleted_at)
    );
  };

  const getFilteredItems = () => {
    const allItems = getAllDeletedItems();
    if (selectedEntity === 'all') return allItems;
    return allItems.filter(item => item.entityType === selectedEntity);
  };

  const getTotalCount = () => {
    return Object.values(deletedItems).reduce((total, items) => total + items.length, 0);
  };

  const renderItemsByCategory = (categoryKey) => {
    const items = deletedItems[categoryKey] || [];
    const config = ENTITY_CONFIG[categoryKey];
    
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <config.icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nenhum item excluído em {config.name}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map(item => (
          <Card key={`${item.entityType}-${item.id}`} className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <config.icon className="w-4 h-4 text-red-600" />
                    <span className="font-medium text-red-900">
                      {getItemDisplayName(item)}
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      {config.name}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-red-700">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>Excluído por: {item.deleted_by || 'Sistema'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Em: {item.deleted_at ? format(new Date(item.deleted_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt }) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Campos específicos da entidade */}
                  <div className="mt-2 text-xs text-gray-600">
                    {config.displayFields.filter(field => 
                      field !== 'deleted_by' && field !== 'deleted_at' && item[field]
                    ).map(field => (
                      <span key={field} className="mr-4">
                        <strong>{field}:</strong> {
                          typeof item[field] === 'string' && item[field].length > 50 
                            ? item[field].substring(0, 50) + '...'
                            : item[field]
                        }
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleRestore(item)}
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" /> 
                    Restaurar
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setItemToDelete(item)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> 
                    Excluir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600 mr-3" />
        <span className="text-gray-600">Carregando lixeira...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 flex items-center justify-center p-8">
        <AlertTriangle className="mr-2 w-6 h-6" /> 
        {error}
        <Button onClick={loadAllDeletedItems} variant="outline" className="ml-4">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  const totalItems = getTotalCount();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900">🗑️ Lixeira do Sistema</h3>
          <p className="text-sm text-gray-600 mt-1">
            {totalItems} item{totalItems !== 1 ? 's' : ''} excluído{totalItems !== 1 ? 's' : ''} • Empresa: {user.company_name || user.cnpj}
          </p>
        </div>
        <Button onClick={loadAllDeletedItems} variant="outline" size="sm">
          <RotateCcw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {totalItems === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Lixeira Vazia</h4>
            <p className="text-gray-500">Nenhum item foi excluído ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="all" className="text-xs">
              Todos ({totalItems})
            </TabsTrigger>
            {Object.entries(ENTITY_CONFIG).map(([key, config]) => {
              const count = deletedItems[key]?.length || 0;
              return (
                <TabsTrigger key={key} value={key} className="text-xs">
                  {config.name} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trash2 className="w-5 h-5 mr-2" />
                  Todos os Itens Excluídos ({totalItems})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalItems === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhum item excluído encontrado.</p>
                ) : (
                  <div className="space-y-3">
                    {getFilteredItems().map(item => {
                      const config = ENTITY_CONFIG[item.entityType];
                      return (
                        <Card key={`all-${item.entityType}-${item.id}`} className="bg-red-50 border-red-200">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <config.icon className="w-4 h-4 text-red-600" />
                                  <span className="font-medium text-red-900">
                                    {getItemDisplayName(item)}
                                  </span>
                                  <Badge variant="destructive" className="text-xs">
                                    {config.name}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-red-700">
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    <span>Excluído por: {item.deleted_by || 'Sistema'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                      Em: {item.deleted_at ? format(new Date(item.deleted_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt }) : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex gap-2 ml-4">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleRestore(item)}
                                  className="border-green-300 text-green-700 hover:bg-green-50"
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" /> 
                                  Restaurar
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  onClick={() => setItemToDelete(item)}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" /> 
                                  Excluir
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {Object.entries(ENTITY_CONFIG).map(([key, config]) => (
            <TabsContent key={key} value={key} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <config.icon className="w-5 h-5 mr-2" />
                    {config.name} Excluídos ({deletedItems[key]?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderItemsByCategory(key)}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Modal de Confirmação de Exclusão Permanente */}
      {itemToDelete && (
        <DeleteConfirmation
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleDeletePermanently}
          title="Excluir Permanentemente?"
          description="⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL! Todos os dados serão perdidos para sempre."
          itemName={`${itemToDelete.entityName} "${getItemDisplayName(itemToDelete)}"`}
          isPermanent={true}
        />
      )}
    </div>
  );
}
