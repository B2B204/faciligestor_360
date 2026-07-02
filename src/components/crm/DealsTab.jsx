import React, { useState, useEffect } from 'react';
import { Deal } from '@/entities/Deal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Plus, Search } from 'lucide-react';
import { canViewAllDeals } from '@/components/permissions';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DealForm from './DealForm';

export default function DealsTab({ user }) {
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);

  const stages = [
    { id: 'qualificacao', title: 'Qualificação', color: 'bg-blue-100' },
    { id: 'proposta_enviada', title: 'Proposta Enviada', color: 'bg-yellow-100' },
    { id: 'negociacao', title: 'Negociação', color: 'bg-orange-100' },
    { id: 'fechado_ganho', title: 'Fechado Ganho', color: 'bg-green-100' },
    { id: 'fechado_perdido', title: 'Fechado Perdido', color: 'bg-red-100' },
  ];

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setIsLoading(true);
    try {
      const canViewAll = canViewAllDeals(user?.department);
      const filter = { cnpj: user.cnpj };
      
      if (!canViewAll) {
        filter.assigned_to = user.email;
      }

      const data = await Deal.filter(filter, '-created_date');
      setDeals(data);
    } catch (error) {
      console.error('Erro ao carregar negócios:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    await loadDeals();
    setIsFormOpen(false);
    setEditingDeal(null);
  };
  
  const handleEdit = (deal) => {
    setEditingDeal(deal);
    setIsFormOpen(true);
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const dealToMove = deals.find(d => d.id === draggableId);
    if (dealToMove.stage !== destination.droppableId) {
      try {
        await Deal.update(draggableId, {
          stage: destination.droppableId,
          updated_by: user.email
        });
        await loadDeals();
      } catch (error) {
        console.error('Erro ao mover negócio:', error);
        alert('Erro ao mover negócio');
      }
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const filteredDeals = deals.filter(deal =>
    deal.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDealsValueByStage = (stageId) => {
    return deals
      .filter(deal => deal.stage === stageId)
      .reduce((sum, deal) => sum + (deal.value || 0), 0);
  };

  return (
    <div className="space-y-6">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Negócios</h2>
            <p className="text-gray-600">Pipeline de vendas e oportunidades</p>
          </div>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingDeal(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Negócio
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDeal ? 'Editar Negócio' : 'Novo Negócio'}</DialogTitle>
          </DialogHeader>
          <DealForm
            deal={editingDeal}
            onSave={handleSave}
            onCancel={() => setIsFormOpen(false)}
            user={user}
          />
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <Input
            placeholder="Buscar negócios..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-600">
          Total no Pipeline: {formatCurrency(deals.reduce((sum, deal) => sum + (deal.value || 0), 0))}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {stages.map((stage) => {
            const stageDeals = filteredDeals.filter(deal => deal.stage === stage.id);
            const stageValue = getDealsValueByStage(stage.id);

            return (
              <div key={stage.id} className="space-y-2">
                <div className={`p-3 rounded-lg ${stage.color}`}>
                  <h3 className="font-medium text-sm">{stage.title}</h3>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-600">{stageDeals.length} negócios</span>
                    <span className="text-xs font-medium">{formatCurrency(stageValue)}</span>
                  </div>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="min-h-[200px] space-y-2 p-1 bg-gray-50/50 rounded-lg"
                    >
                      {stageDeals.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => handleEdit(deal)}
                            >
                              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                                <CardContent className="p-3">
                                  <h4 className="font-medium text-sm mb-1">{deal.title}</h4>
                                  <div className="flex items-center justify-between">
                                    <span className="text-green-600 font-medium text-sm">
                                      {formatCurrency(deal.value)}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {deal.probability}%
                                    </Badge>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    {deal.assigned_to}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}