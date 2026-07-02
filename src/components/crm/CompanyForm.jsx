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
    company_name: '',
    cnpj_company: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    industry: '',
    size: 'pequena',
    observations: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        company_name: company.company_name || '',
        cnpj_company: company.cnpj_company || '',
        address: company.address || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        industry: company.industry || '',
        size: company.size || 'pequena',
        observations: company.observations || '',
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
        updated_by: user.email,
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
          <Label htmlFor="company_name">Razão Social *</Label>
          <Input id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="cnpj_company">CNPJ</Label>
          <Input id="cnpj_company" name="cnpj_company" value={formData.cnpj_company} onChange={handleChange} />
        </div>
      </div>
      <div>
        <Label htmlFor="address">Endereço</Label>
        <Input id="address" name="address" value={formData.address} onChange={handleChange} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" value={formData.website} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="industry">Setor</Label>
          <Input id="industry" name="industry" value={formData.industry} onChange={handleChange} />
        </div>
      </div>
      <div>
        <Label htmlFor="size">Porte da Empresa</Label>
        <Select value={formData.size} onValueChange={(v) => handleChange({target: {name: 'size', value: v}})}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pequena">Pequena</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="grande">Grande</SelectItem>
            <SelectItem value="multinacional">Multinacional</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" value={formData.observations} onChange={handleChange} />
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