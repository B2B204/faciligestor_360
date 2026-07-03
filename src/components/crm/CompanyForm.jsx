import React, { useState, useEffect } from 'react';
import { CrmCompany } from '@/entities/CrmCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

export default function CompanyForm({ company, onSave, onCancel, user }) {
  const [formData, setFormData] = useState({
    name: '',
    cnpj_client: '',
    sector: '',
    status: 'ativo',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        cnpj_client: company.cnpj_client || '',
        sector: company.sector || '',
        status: company.status || 'ativo',
        notes: company.notes || '',
      });
    }
  }, [company]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        cnpj: user.cnpj,
      };
      if (company) {
        await CrmCompany.update(company.id, dataToSave);
      } else {
        await CrmCompany.create({ ...dataToSave, created_by: user.email });
      }
      onSave();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
      alert('Erro ao salvar empresa');
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
          <Label htmlFor="name">Razão Social *</Label>
          <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="cnpj_client">CNPJ</Label>
          <Input id="cnpj_client" name="cnpj_client" value={formData.cnpj_client} onChange={handleChange} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sector">Setor</Label>
          <Input id="sector" name="sector" value={formData.sector} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(v) => handleChange({target: {name: 'status', value: v}})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} />
      </div>
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : 'Salvar Empresa'}
        </Button>
      </div>
    </form>
  );
}