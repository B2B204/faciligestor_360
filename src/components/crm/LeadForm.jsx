import React, { useState, useEffect } from 'react';
import { Lead } from '@/entities/Lead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

export default function LeadForm({ lead, onSave, onCancel, user }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: '',
    status: 'novo',
    notes: '',
    assigned_to: user?.email || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        source: lead.source || '',
        status: lead.status || 'novo',
        notes: lead.notes || '',
        assigned_to: lead.assigned_to || user?.email || '',
      });
    }
  }, [lead, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const dataToSave = {
        ...formData,
        cnpj: user.cnpj,
      };

      if (lead) {
        await Lead.update(lead.id, dataToSave);
      } else {
        await Lead.create({
          ...dataToSave,
          created_by: user.email,
        });
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
      alert('Erro ao salvar lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const sourceOptions = [
    { value: 'google_ads', label: 'Google Ads' },
    { value: 'indicacao', label: 'Indicação' },
    { value: 'orgao_publico', label: 'Órgão Público' },
    { value: 'site', label: 'Site' },
    { value: 'redes_sociais', label: 'Redes Sociais' },
    { value: 'evento', label: 'Evento' },
    { value: 'outros', label: 'Outros' }
  ];

  const statusOptions = [
    { value: 'novo', label: 'Novo' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'convertido', label: 'Convertido' },
    { value: 'descartado', label: 'Descartado' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="email">E-mail *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">WhatsApp/Telefone</Label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(11) 99999-9999"
          />
        </div>
        
        <div>
          <Label htmlFor="company">Empresa</Label>
          <Input
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="source">Origem *</Label>
          <Select name="source" value={formData.source} onValueChange={(value) => handleChange({ target: { name: 'source', value } })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a origem" />
            </SelectTrigger>
            <SelectContent>
              {sourceOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="status">Status</Label>
          <Select name="status" value={formData.status} onValueChange={(value) => handleChange({ target: { name: 'status', value } })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="assigned_to">Responsável</Label>
        <Input
          id="assigned_to"
          name="assigned_to"
          value={formData.assigned_to}
          onChange={handleChange}
          placeholder="email@exemplo.com"
        />
      </div>

      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Observações sobre o lead..."
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : 'Salvar Lead'}
        </Button>
      </div>
    </form>
  );
}