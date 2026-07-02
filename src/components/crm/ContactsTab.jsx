import React, { useState, useEffect } from 'react';
import { CrmContact } from '@/entities/CrmContact';
import { CrmCompany } from '@/entities/CrmCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Edit, Trash2 } from 'lucide-react';
import ContactForm from './ContactForm';

export default function ContactsTab({ user }) {
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contactsData, companiesData] = await Promise.all([
        CrmContact.filter({ cnpj: user.cnpj }, '-created_date'),
        CrmCompany.filter({ cnpj: user.cnpj })
      ]);
      setContacts(contactsData);
      const companiesMap = companiesData.reduce((acc, company) => {
        acc[company.id] = company.company_name;
        return acc;
      }, {});
      setCompanies(companiesMap);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleSave = async () => {
    await loadData();
    setIsFormOpen(false);
    setEditingContact(null);
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleDelete = async (contactId) => {
    if (window.confirm('Tem certeza?')) {
      await CrmContact.delete(contactId);
      await loadData();
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Contatos</h2>
            <p className="text-gray-600">Gerencie seus contatos de pessoas físicas</p>
          </div>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingContact(null)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Contato
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingContact ? 'Editar Contato' : 'Novo Contato'}</DialogTitle></DialogHeader>
          <ContactForm contact={editingContact} onSave={handleSave} onCancel={() => setIsFormOpen(false)} user={user} />
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lista de Contatos ({filteredContacts.length})</CardTitle>
            <div className="relative w-72"><Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" /><Input placeholder="Buscar contatos..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Empresa</TableHead><TableHead>E-mail</TableHead><TableHead>Telefone</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredContacts.map(contact => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{companies[contact.company_id] || '-'}</TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell>{contact.phone || '-'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(contact)}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(contact.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}