import React, { useState, useEffect } from 'react';
import { Deal } from '@/entities/Deal';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

export default function DealForm({ deal, onSave, onCancel, user }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    value: 0,
    stage: 'qualificacao',
    probability: 25,
    expected_close_date: '',
    assigned_to: user?.email || '',
  });

  const [users, setUsers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const usersData = await User.filter({ cnpj: user.cnpj });
        setUsers(usersData);
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
      }
    }
    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        description: deal.description || '',
        value: deal.value || 0,
        stage: deal.stage || 'qualificacao',
        probability: deal.probability || 25,
        expected_close_date: deal.expected_close_date ? deal.expected_close_date.split('T')[0] : '',
        assigned_to: deal.assigned_to || user?.email || '',
      });
    }
  }, [deal, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const dataToSave = {
        ...formData,
        value: Number(formData.value),
        probability: Number(formData.probability),
        cnpj: user.cnpj,
        updated_by: user.email,
      };

      if (deal) {
        await Deal.update(deal.id, dataToSave);
      } else {
        await Deal.create({
          ...dataToSave,
          created_by: user.email,
        });
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar negócio:', error);
      alert('Erro ao salvar negócio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Título do Negócio *</Label>
          <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="value">Valor Previsto (R$) *</Label>
          <Input id="value" name="value" type="number" value={formData.value} onChange={handleChange} required />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stage">Estágio</Label>
          <Select value={formData.stage} onValueChange={(v) => handleSelectChange('stage', v)}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="qualificacao">Qualificação</SelectItem>
              <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
              <SelectItem value="negociacao">Negociação</SelectItem>
              <SelectItem value="fechado_ganho">Fechado Ganho</SelectItem>
              <SelectItem value="fechado_perdido">Fechado Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="probability">Probabilidade (%)</Label>
          <Input id="probability" name="probability" type="number" min="0" max="100" value={formData.probability} onChange={handleChange} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="expected_close_date">Data Prev. Fechamento</Label>
          <Input id="expected_close_date" name="expected_close_date" type="date" value={formData.expected_close_date} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="assigned_to">Responsável</Label>
          <Select value={formData.assigned_to} onValueChange={(v) => handleSelectChange('assigned_to', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
            <SelectContent>
              {users.map(u => <SelectItem key={u.id} value={u.email}>{u.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : 'Salvar Negócio'}
        </Button>
      </div>
    </form>
  );
}