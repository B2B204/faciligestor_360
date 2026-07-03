import React, { useState, useEffect } from 'react';
import { CrmActivity } from '@/entities/CrmActivity';
import { Deal } from '@/entities/Deal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Plus, Edit, Trash2, Calendar, Phone, Mail, User, Briefcase } from 'lucide-react';
import ActivityForm from './ActivityForm';

export default function ActivitiesTab({ user }) {
  const [activities, setActivities] = useState([]);
  const [deals, setDeals] = useState({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [activitiesData, dealsData] = await Promise.all([
        CrmActivity.filter({ cnpj: user.cnpj }, '-date'),
        Deal.filter({ cnpj: user.cnpj })
      ]);
      setActivities(activitiesData);
      const dealsMap = dealsData.reduce((acc, deal) => {
        acc[deal.id] = deal.title;
        return acc;
      }, {});
      setDeals(dealsMap);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    }
  };

  const handleSave = async () => {
    await loadData();
    setIsFormOpen(false);
    setEditingActivity(null);
  };

  const handleEdit = (activity) => {
    setEditingActivity(activity);
    setIsFormOpen(true);
  };

  const handleDelete = async (activityId) => {
    if (window.confirm('Tem certeza?')) {
      await CrmActivity.delete(activityId);
      await loadData();
    }
  };
  
  const typeInfo = {
    chamada: { icon: Phone, color: 'bg-blue-100 text-blue-800' },
    reuniao: { icon: User, color: 'bg-purple-100 text-purple-800' },
    email: { icon: Mail, color: 'bg-red-100 text-red-800' },
    whatsapp: { icon: Phone, color: 'bg-green-100 text-green-800' },
    visita: { icon: Briefcase, color: 'bg-orange-100 text-orange-800' },
    follow_up: { icon: Calendar, color: 'bg-yellow-100 text-yellow-800' },
    proposta: { icon: Briefcase, color: 'bg-indigo-100 text-indigo-800' },
  };

  return (
    <div className="space-y-6">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Atividades</h2>
            <p className="text-gray-600">Registre chamadas, reuniões e follow-ups</p>
          </div>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingActivity(null)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Atividade
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingActivity ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle></DialogHeader>
          <ActivityForm activity={editingActivity} onSave={handleSave} onCancel={() => setIsFormOpen(false)} user={user} />
        </DialogContent>
      </Dialog>
      <div className="space-y-4">
        {activities.map(activity => {
          const Icon = typeInfo[activity.type]?.icon || Calendar;
          return (
            <Card key={activity.id}>
              <CardContent className="p-4 flex items-start space-x-4">
                <div className={`p-3 rounded-full ${typeInfo[activity.type]?.color || 'bg-gray-100'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold capitalize">{activity.type?.replace('_', ' ')}</h3>
                    <Badge variant="outline">{format(new Date(activity.date), 'dd/MM/yyyy HH:mm')}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  {activity.deal_id && deals[activity.deal_id] && (
                    <p className="text-xs text-gray-500 mt-1">Negócio: {deals[activity.deal_id]}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-1">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(activity)}><Edit className="w-4 h-4" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(activity.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}