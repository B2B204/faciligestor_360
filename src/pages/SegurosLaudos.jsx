
import React, { useState, useEffect } from 'react';
import { User } from '@/entities/User';
import { Contract } from '@/entities/Contract';
import { Seguro } from '@/entities/Seguro';
import { Laudo } from '@/entities/Laudo';
import { UploadFile } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea component
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, FileText, ShieldCheck, Download, ExternalLink, AlertTriangle, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, isAfter, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { canManageSegurosLaudos } from '@/components/permissions';

export default function SegurosLaudosPage() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [seguros, setSeguros] = useState([]);
  const [laudos, setLaudos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSeguroFormOpen, setIsSeguroFormOpen] = useState(false);
  const [isLaudoFormOpen, setIsLaudoFormOpen] = useState(false);

  const [editingSeguro, setEditingSeguro] = useState(null);
  const [editingLaudo, setEditingLaudo] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const [contractsData, segurosData, laudosData] = await Promise.all([
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' }),
        Seguro.filter({ cnpj: currentUser.cnpj }, "-created_date"),
        Laudo.filter({ cnpj: currentUser.cnpj }, "-created_date"),
      ]);
      setContracts(contractsData);
      setSeguros(segurosData);
      setLaudos(laudosData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setIsLoading(false);
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const formatDate = (date) => date ? format(new Date(date), 'dd/MM/yyyy') : '-';

  // Verificar permissões
  const canManage = canManageSegurosLaudos(user?.department);

  // Handlers para Seguro
  const handleSaveSeguro = async (formData) => {
    if (!canManage) {
      alert("Você não tem permissão para realizar esta ação. Apenas Administradores e Gestores Contratuais podem gerenciar seguros e laudos.");
      return;
    }

    try {
      const dataToSave = { ...formData, cnpj: user.cnpj };
      if (editingSeguro) {
        await Seguro.update(editingSeguro.id, dataToSave);
      } else {
        await Seguro.create(dataToSave);
      }
      loadData();
      setIsSeguroFormOpen(false);
      setEditingSeguro(null);
    } catch (error) {
      console.error("Erro ao salvar seguro:", error);
    }
  };

  const handleDeleteSeguro = async (id) => {
    if (!canManage) {
      alert("Você não tem permissão para realizar esta ação. Apenas Administradores e Gestores Contratuais podem gerenciar seguros e laudos.");
      return;
    }

    if (window.confirm("Tem certeza?")) {
      await Seguro.delete(id);
      loadData();
    }
  };

  // Handlers para Laudo
  const handleSaveLaudo = async (formData) => {
    if (!canManage) {
      alert("Você não tem permissão para realizar esta ação. Apenas Administradores e Gestores Contratuais podem gerenciar seguros e laudos.");
      return;
    }

    try {
      const dataToSave = { ...formData, cnpj: user.cnpj };
      if (editingLaudo) {
        await Laudo.update(editingLaudo.id, dataToSave);
      } else {
        await Laudo.create(dataToSave);
      }
      loadData();
      setIsLaudoFormOpen(false);
      setEditingLaudo(null);
    } catch (error) {
      console.error("Erro ao salvar laudo:", error);
    }
  };

  const handleDeleteLaudo = async (id) => {
    if (!canManage) {
      alert("Você não tem permissão para realizar esta ação. Apenas Administradores e Gestores Contratuais podem gerenciar seguros e laudos.");
      return;
    }

    if (window.confirm("Tem certeza?")) {
      await Laudo.delete(id);
      loadData();
    }
  };

  // Formulário de Seguro
  const SeguroForm = ({ onSave, onCancel, seguro }) => {
    const [formData, setFormData] = useState({
      contract_id: seguro?.contract_id || '',
      seguradora: seguro?.seguradora || '',
      apolice: seguro?.apolice || '',
      motivo_garantia: seguro?.motivo_garantia || '', // New field
      inicio_vigencia: seguro?.inicio_vigencia || '', // Replaces 'vigencia'
      termino_vigencia: seguro?.termino_vigencia || '', // New field
      valor_garantido: seguro?.valor_garantido || 0,
      observacoes: seguro?.observacoes || '' // New field
    });

    const handleChange = (e) => {
      const { name, value, type } = e.target;
      if (type === 'date' && value) {
        if (value.split('-')[0].length > 4) {
          alert("Ano inválido. Digite um ano com 4 dígitos.");
          return;
        }
      }
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Contrato *</Label>
            <Select value={formData.contract_id} onValueChange={(v) => setFormData(p => ({...p, contract_id: v}))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="seguradora">Seguradora *</Label>
            <Input id="seguradora" name="seguradora" value={formData.seguradora} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="apolice">Apólice *</Label>
            <Input id="apolice" name="apolice" value={formData.apolice} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="valor_garantido">Valor Garantido (R$) *</Label>
            <Input type="number" id="valor_garantido" name="valor_garantido" value={formData.valor_garantido} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="inicio_vigencia">Início da Vigência *</Label>
            <Input type="date" id="inicio_vigencia" name="inicio_vigencia" value={formData.inicio_vigencia} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="termino_vigencia">Término da Vigência *</Label>
            <Input type="date" id="termino_vigencia" name="termino_vigencia" value={formData.termino_vigencia} onChange={handleChange} required />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="motivo_garantia">Motivo da Garantia *</Label>
            <Textarea id="motivo_garantia" name="motivo_garantia" value={formData.motivo_garantia} onChange={handleChange} required placeholder="Descreva o motivo da garantia..." />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" name="observacoes" value={formData.observacoes} onChange={handleChange} placeholder="Observações adicionais..." />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit">Salvar Seguro</Button>
        </div>
      </form>
    );
  };

  // Formulário de Laudo
  const LaudoForm = ({ onSave, onCancel, laudo }) => {
    const [formData, setFormData] = useState({
      contract_id: laudo?.contract_id || '',
      orgao: laudo?.orgao || '',
      tipo_laudo: laudo?.tipo_laudo || '',
      vigencia: laudo?.vigencia || '',
      validade: laudo?.validade || '',
      anexo_pdf_url: laudo?.anexo_pdf_url || ''
    });
    const [isUploading, setIsUploading] = useState(false);

    const handleChange = (e) => {
      const { name, value, type } = e.target;
      if (type === 'date' && value) {
        if (value.split('-')[0].length > 4) {
          alert("Ano inválido. Digite um ano com 4 dígitos.");
          return;
        }
      }
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploading(true);
      try {
        const { file_url } = await UploadFile({ file });
        setFormData(prev => ({ ...prev, anexo_pdf_url: file_url }));
      } catch (error) {
        console.error("Upload falhou", error);
        alert("Upload falhou.");
      }
      setIsUploading(false);
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Contrato *</Label>
            <Select value={formData.contract_id} onValueChange={(v) => setFormData(p => ({...p, contract_id: v}))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="orgao">Órgão Emissor *</Label>
            <Input id="orgao" name="orgao" value={formData.orgao} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="tipo_laudo">Tipo de Laudo *</Label>
            <Input id="tipo_laudo" name="tipo_laudo" value={formData.tipo_laudo} onChange={handleChange} required placeholder="Ex: PPRA, PCMSO..." />
          </div>
          <div>
            <Label htmlFor="vigencia">Vigência *</Label>
            <Input type="date" id="vigencia" name="vigencia" value={formData.vigencia} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="validade">Validade *</Label>
            <Input type="date" id="validade" name="validade" value={formData.validade} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="anexo_pdf_url">Anexo (PDF)</Label>
            <div className="flex items-center space-x-2">
              <Input id="anexo_pdf_file" type="file" accept=".pdf" onChange={handleFileChange} className="flex-grow" disabled={isUploading || !canManage} />
              {isUploading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>}
            </div>
            {formData.anexo_pdf_url && (
              <a href={formData.anexo_pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline mt-1 flex items-center">
                <ExternalLink className="w-3 h-3 mr-1" /> Ver anexo atual
              </a>
            )}
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={isUploading || !canManage}>
            {isUploading ? "Enviando..." : "Salvar Laudo"}
          </Button>
        </div>
      </form>
    );
  };

  // Funções do Dashboard
  const calcularMetricas = () => {
    if (!seguros.length && !laudos.length) return { segurosVencerEm30: 0, laudosVencerEm30: 0, segurosVencidos: 0, laudosVencidos: 0 };
    const hoje = new Date();
    const em30Dias = addMonths(hoje, 1);

    const segurosVencerEm30 = seguros.filter(s => {
      const vencimento = new Date(s.termino_vigencia); // Use termino_vigencia
      return isAfter(vencimento, hoje) && isBefore(vencimento, em30Dias);
    }).length;

    const laudosVencerEm30 = laudos.filter(l => {
      const vencimento = new Date(l.validade);
      return isAfter(vencimento, hoje) && isBefore(vencimento, em30Dias);
    }).length;

    const segurosVencidos = seguros.filter(s => isBefore(new Date(s.termino_vigencia), hoje)).length; // Use termino_vigencia
    const laudosVencidos = laudos.filter(l => isBefore(new Date(l.validade), hoje)).length;

    return { segurosVencerEm30, laudosVencerEm30, segurosVencidos, laudosVencidos };
  };

  const prepararDadosGrafico = () => {
    const dadosPorMes = {};

    seguros.forEach(seguro => {
      const vencimento = new Date(seguro.termino_vigencia); // Use termino_vigencia
      const chave = format(vencimento, 'yyyy-MM');
      const mesAno = format(vencimento, 'MMM/yyyy', { locale: pt });
      if (!dadosPorMes[chave]) dadosPorMes[chave] = { mes: mesAno, seguros: 0, laudos: 0 };
      dadosPorMes[chave].seguros++;
    });

    laudos.forEach(laudo => {
      const vencimento = new Date(laudo.validade);
      const chave = format(vencimento, 'yyyy-MM');
      const mesAno = format(vencimento, 'MMM/yyyy', { locale: pt });
      if (!dadosPorMes[chave]) dadosPorMes[chave] = { mes: mesAno, seguros: 0, laudos: 0 };
      dadosPorMes[chave].laudos++;
    });

    // Sort by the yyyy-MM key to ensure chronological order
    const sortedKeys = Object.keys(dadosPorMes).sort();
    return sortedKeys.map(key => dadosPorMes[key]);
  };

  if (isLoading) {
    return (
        <div className="p-8 space-y-6">
            <div className="animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="h-28 bg-muted rounded-lg"></div>
                    <div className="h-28 bg-muted rounded-lg"></div>
                    <div className="h-28 bg-muted rounded-lg"></div>
                    <div className="h-28 bg-muted rounded-lg"></div>
                </div>
                <div className="h-80 bg-muted rounded-lg mb-6"></div>
                <div className="h-40 bg-muted rounded-lg"></div>
            </div>
        </div>
    );
  }

  const metricas = calcularMetricas();
  const dadosGrafico = prepararDadosGrafico();

  return (
    <div className="p-8 space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
              <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-yellow-100 text-sm font-medium">Laudos a Vencer (30d)</p>
                          <p className="text-3xl font-bold">{metricas.laudosVencerEm30}</p>
                      </div>
                      <Clock className="w-8 h-8 text-yellow-200" />
                  </div>
              </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-blue-100 text-sm font-medium">Seguros a Vencer (30d)</p>
                          <p className="text-3xl font-bold">{metricas.segurosVencerEm30}</p>
                      </div>
                      <Clock className="w-8 h-8 text-blue-200" />
                  </div>
              </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
              <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-red-100 text-sm font-medium">Laudos Vencidos</p>
                          <p className="text-3xl font-bold">{metricas.laudosVencidos}</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-200" />
                  </div>
              </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
              <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-red-100 text-sm font-medium">Seguros Vencidos</p>
                          <p className="text-3xl font-bold">{metricas.segurosVencidos}</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-200" />
                  </div>
              </CardContent>
          </Card>
      </div>

      {/* Gráfico */}
      <Card>
          <CardHeader>
              <CardTitle className="flex items-center">
                  <CalendarIcon className="w-5 h-5 mr-2" />
                  Vencimentos por Mês
              </CardTitle>
          </CardHeader>
          <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosGrafico}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="laudos" fill="#f59e0b" name="Laudos" />
                      <Bar dataKey="seguros" fill="#3b82f6" name="Seguros" />
                  </BarChart>
              </ResponsiveContainer>
          </CardContent>
      </Card>

      {/* Abas de Gerenciamento */}
      <Tabs defaultValue="seguros">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="seguros"><ShieldCheck className="w-4 h-4 mr-2" />Gerenciar Seguros e Garantias</TabsTrigger>
          <TabsTrigger value="laudos"><FileText className="w-4 h-4 mr-2" />Gerenciar Laudos Técnicos</TabsTrigger>
        </TabsList>
        <TabsContent value="seguros">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Seguros e Garantias</CardTitle>
                {canManage && (
                  <Dialog open={isSeguroFormOpen} onOpenChange={setIsSeguroFormOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => { setEditingSeguro(null); setIsSeguroFormOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Novo Seguro
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{editingSeguro ? "Editar" : "Novo"} Seguro</DialogTitle>
                      </DialogHeader>
                      <SeguroForm
                        onSave={handleSaveSeguro}
                        onCancel={() => setIsSeguroFormOpen(false)}
                        seguro={editingSeguro}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Seguradora</TableHead>
                    <TableHead>Apólice</TableHead>
                    <TableHead>Motivo</TableHead> {/* New column */}
                    <TableHead>Vigência</TableHead> {/* Updated to reflect start/end */}
                    <TableHead>Valor Garantido</TableHead>
                    {canManage && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seguros.map(seguro => (
                    <TableRow key={seguro.id}>
                      <TableCell>{contracts.find(c => c.id === seguro.contract_id)?.name}</TableCell>
                      <TableCell>{seguro.seguradora}</TableCell>
                      <TableCell>{seguro.apolice}</TableCell>
                      <TableCell className="max-w-xs truncate" title={seguro.motivo_garantia}>
                        {seguro.motivo_garantia}
                      </TableCell> {/* New cell */}
                      <TableCell>
                        {formatDate(seguro.inicio_vigencia)} até {formatDate(seguro.termino_vigencia)}
                      </TableCell> {/* Updated cell */}
                      <TableCell>{formatCurrency(seguro.valor_garantido)}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => { setEditingSeguro(seguro); setIsSeguroFormOpen(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSeguro(seguro.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="laudos">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Laudos Técnicos</CardTitle>
                {canManage && (
                  <Dialog open={isLaudoFormOpen} onOpenChange={setIsLaudoFormOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => { setEditingLaudo(null); setIsLaudoFormOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Novo Laudo
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{editingLaudo ? "Editar" : "Novo"} Laudo</DialogTitle>
                      </DialogHeader>
                      <LaudoForm
                        onSave={handleSaveLaudo}
                        onCancel={() => setIsLaudoFormOpen(false)}
                        laudo={editingLaudo}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Anexo</TableHead>
                    {canManage && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {laudos.map(laudo => (
                    <TableRow key={laudo.id}>
                      <TableCell>{contracts.find(c => c.id === laudo.contract_id)?.name}</TableCell>
                      <TableCell>{laudo.tipo_laudo}</TableCell>
                      <TableCell>{laudo.orgao}</TableCell>
                      <TableCell>{formatDate(laudo.vigencia)}</TableCell>
                      <TableCell>{formatDate(laudo.validade)}</TableCell>
                      <TableCell>
                        {laudo.anexo_pdf_url ? (
                          <a href={laudo.anexo_pdf_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <Download className="w-3 h-3 mr-1" /> Ver PDF
                            </Button>
                          </a>
                        ) : 'N/A'}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => { setEditingLaudo(laudo); setIsLaudoFormOpen(true); }}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteLaudo(laudo.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
