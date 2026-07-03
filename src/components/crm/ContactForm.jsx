import React, { useState, useEffect } from 'react';
import { CrmContact } from '@/entities/CrmContact';
import { CrmCompany } from '@/entities/CrmCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';

export default function ContactForm({ contact, onSave, onCancel, user }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    company_id: '',
    notes: '',
  });

  const [companies, setCompanies] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const companiesData = await CrmCompany.filter({ cnpj: user.cnpj });
        setCompanies(companiesData);
      } catch (error) {
        console.error("Erro ao buscar empresas:", error);
      }
    }
    fetchCompanies();
  }, [user]);

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || '',
        company_id: contact.company_id || '',
        notes: contact.notes || '',
      });
    }
  }, [contact]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = { ...formData, cnpj: user.cnpj };
      if (contact) {
        await CrmContact.update(contact.id, dataToSave);
      } else {
        await CrmContact.create({ ...dataToSave, created_by: user.email });
      }
      onSave();
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      alert('Erro ao salvar contato');
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
        <div><Label htmlFor="name">Nome *</Label><Input id="name" name="name" value={formData.name} onChange={handleChange} required /></div>
        <div><Label htmlFor="email">E-mail *</Label><Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="phone">Telefone</Label><Input id="phone" name="phone" value={formData.phone} onChange={handleChange} /></div>
        <div><Label htmlFor="role">Cargo</Label><Input id="role" name="role" value={formData.role} onChange={handleChange} /></div>
      </div>
      <div>
        <Label htmlFor="company_id">Empresa</Label>
        <Select value={formData.company_id} onValueChange={(v) => handleChange({ target: { name: 'company_id', value: v } })}>
          <SelectTrigger><SelectValue placeholder="Vincule a uma empresa" /></SelectTrigger>
          <SelectContent>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} />
      </div>
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Salvando...' : 'Salvar Contato'}
        </Button>
      </div>
    </form>
  );
}