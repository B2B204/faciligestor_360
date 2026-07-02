import React, { useState, useEffect } from 'react';
import { Lead } from '@/entities/Lead';
import { Deal } from '@/entities/Deal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Edit, Trash2, ArrowRight, MessageCircle } from 'lucide-react';
import LeadForm from './LeadForm';
import { canViewAllDeals } from '@/components/permissions';

export default function LeadsTab({ user }) {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const canViewAll = canViewAllDeals(user?.department);
      const filter = { cnpj: user.cnpj };
      
      if (!canViewAll) {
        filter.assigned_to = user.email;
      }

      const data = await Lead.filter(filter, '-created_date');
      setLeads(data);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    await loadLeads();
    setIsFormOpen(false);
    setEditingLead(null);
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setIsFormOpen(true);
  };

  const handleDelete = async (leadId) => {
    if (window.confirm('Tem certeza que deseja excluir este lead?')) {
      try {
        await Lead.delete(leadId);
        await loadLeads();
      } catch (error) {
        console.error('Erro ao excluir lead:', error);
        alert('Erro ao excluir lead');
      }
    }
  };

  const handleConvertToDeal = async (lead) => {
    try {
      // Criar negócio a partir do lead
      const dealData = {
        title: `Negócio - ${lead.name}`,
        description: `Convertido do lead: ${lead.name} (${lead.company || 'Sem empresa'})`,
        value: 0, // Valor será definido pelo usuário posteriormente
        stage: 'qualificacao',
        probability: 25,
        lead_id: lead.id,
        assigned_to: lead.assigned_to || user.email,
        cnpj: user.cnpj,
        created_by: user.email
      };

      const newDeal = await Deal.create(dealData);

      // Marcar lead como convertido
      await Lead.update(lead.id, {
        status: 'convertido',
        converted_to_deal: true,
        deal_id: newDeal.id,
        updated_by: user.email
      });

      alert('Lead convertido em negócio com sucesso!');
      await loadLeads();
    } catch (error) {
      console.error('Erro ao converter lead:', error);
      alert('Erro ao converter lead em negócio');
    }
  };

  const handleWhatsApp = (phone) => {
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/55${cleanPhone}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const filteredLeads = leads.filter(lead =>
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    novo: 'bg-blue-100 text-blue-800',
    qualificado: 'bg-yellow-100 text-yellow-800',
    convertido: 'bg-green-100 text-green-800',
    descartado: 'bg-red-100 text-red-800'
  };

  const originLabels = {
    google_ads: 'Google Ads',
    indicacao: 'Indicação',
    orgao_publico: 'Órgão Público',
    site: 'Site',
    redes_sociais: 'Redes Sociais',
    evento: 'Evento',
    outros: 'Outros'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Leads</h2>
          <p className="text-gray-600">Gerencie seus prospects e oportunidades</p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingLead(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
            </DialogHeader>
            <LeadForm
              lead={editingLead}
              onSave={handleSave}
              onCancel={() => setIsFormOpen(false)}
              user={user}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lista de Leads ({filteredLeads.length})</CardTitle>
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Buscar leads..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.company || '-'}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>{lead.phone || '-'}</span>
                      {lead.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWhatsApp(lead.phone)}
                        >
                          <MessageCircle className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {originLabels[lead.origin] || lead.origin}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[lead.status]}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{lead.assigned_to}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(lead)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {!lead.converted_to_deal && lead.status !== 'descartado' && (
                          <DropdownMenuItem onClick={() => handleConvertToDeal(lead)}>
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Converter em Negócio
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => handleDelete(lead.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>Nenhum lead encontrado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}