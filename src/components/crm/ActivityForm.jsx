import React, { useState, useEffect } from 'react';
import { CrmActivity } from '@/entities/CrmActivity';
import { Deal } from '@/entities/Deal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

export default function ActivityForm({ activity, onSave, onCancel, user }) {
  const [formData, setFormData] = useState({
    type: 'chamada',
    title: '',
    description: '',
    activity_date: '',
    activity_time: '',
    deal_id: '',
    status: 'planejada',
  });
  const [deals, setDeals] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchDeals() {
      try {
        const dealsData = await Deal.filter({ cnpj: user.cnpj });
        setDeals(dealsData);
      } catch (error) {
        console.error("Erro ao buscar negócios:", error);
      }
    }
    fetchDeals();
  }, [user]);

  useEffect(() => {
    if (activity) {
      setFormData({
        type: activity.type || 'chamada',
        title: activity.title || '',
        description: activity.description || '',
        activity_date: activity.activity_date ? activity.activity_date.split('T')[0] : '',
        activity_time: activity.activity_time || '',
        deal_id: activity.deal_id || '',
        status: activity.status || 'planejada',
      });
    }
  }, [activity]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = { ...formData, cnpj: user.cnpj, updated_by: user.email };
      if (activity) {
        await CrmActivity.update(activity.id, dataToSave);
      } else {
        await CrmActivity.create({ ...dataToSave, created_by: user.email });
      }
      onSave();
    } catch (error) {
      console.error('Erro ao salvar atividade:', error);
      alert('Erro ao salvar atividade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Tipo *</Label>
          <Select value={formData.type} onValueChange={(v) => handleChange({ target: { name: 'type', value: v } })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="chamada">Chamada</SelectItem>
              <SelectItem value="reuniao">Reunião</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="visita">Visita</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="proposta">Proposta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="activity_date">Data *</Label><Input id="activity_date" name="activity_date" type="date" value={formData.activity_date} onChange={handleChange} required /></div>
        <div><Label htmlFor="activity_time">Hora</Label><Input id="activity_time" name="activity_time" type="time" value={formData.activity_time} onChange={handleChange} /></div>
      </div>
      <div>
        <Label htmlFor="deal_id">Negócio Relacionado</Label>
        <Select value={formData.deal_id} onValueChange={(v) => handleChange({ target: { name: 'deal_id', value: v } })}>
          <SelectTrigger><SelectValue placeholder="Vincule a um negócio" /></SelectTrigger>
          <SelectContent>
            {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
      </div>
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : 'Salvar Atividade'}
        </Button>
      </div>
    </form>
  );
}