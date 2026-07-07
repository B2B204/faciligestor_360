import React, { useState, useEffect, useCallback } from 'react';
import { Uniform } from '@/entities/Uniform';
import { UniformDelivery } from '@/entities/UniformDelivery';
import { Contract } from '@/entities/Contract';
import { Employee } from '@/entities/Employee';
import { User } from '@/entities/User';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Package, Plus, Search, CheckCircle, Receipt, Trash2, Truck,
  AlertTriangle, ArrowUpCircle, Warehouse, TrendingDown, BoxSelect,
  Minus, MapPin, ShieldAlert
} from 'lucide-react';
import UniformForm from '../components/uniforms/UniformForm';
import UniformDeliveryForm from '../components/uniforms/UniformDeliveryForm';
import UniformList from '../components/uniforms/UniformList';
import UniformDashboard from '../components/uniforms/UniformDashboard';
import { canPerformAction } from '@/components/permissions';

export default function UniformsPage() {
  const [user, setUser] = useState(null);
  const [uniforms, setUniforms] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    totalUniforms: 0,
    totalCost: 0,
    expiringItems: 0,
    pendingEmployees: 0,
    pendingEmployeesEpi: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUniformFormOpen, setIsUniformFormOpen] = useState(false);
  const [isDeliveryFormOpen, setIsDeliveryFormOpen] = useState(false);
  const [isStockEntryOpen, setIsStockEntryOpen] = useState(false);
  const [stockEntryUniform, setStockEntryUniform] = useState(null);
  const [stockEntryQty, setStockEntryQty] = useState(1);
  const [stockEntryType, setStockEntryType] = useState('entrada'); // 'entrada' | 'saida' | 'ajuste'
  const [stockSaving, setStockSaving] = useState(false);
  const [selectedUniform, setSelectedUniform] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const userRole = user?.department || 'operador';

  const calculateDashboard = useCallback((uniformsData, deliveriesData, employeesData) => {
    const totalUniforms = deliveriesData.reduce((sum, d) => sum + (d.quantity || 0), 0);
    const totalCost = deliveriesData.reduce((sum, d) => sum + (d.total_cost || 0), 0);

    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    const expiringItems = deliveriesData.filter(d => {
      if (!d.expiry_date || d.status !== 'em_uso') return false;
      const expiryDate = new Date(d.expiry_date);
      return expiryDate <= thirtyDaysFromNow && expiryDate >= today;
    }).length;

    const employeesWithUniforms = new Set(deliveriesData.map(d => d.employee_id));
    const pendingEmployees = employeesData.filter(e => !employeesWithUniforms.has(e.id)).length;

    const epiUniformIds = new Set(uniformsData.filter(u => u.category === 'epi').map(u => u.id));
    const employeesWithEpi = new Set(
      deliveriesData.filter(d => d.status === 'em_uso' && epiUniformIds.has(d.uniform_id)).map(d => d.employee_id)
    );
    const pendingEmployeesEpi = employeesData.filter(e => !employeesWithEpi.has(e.id)).length;

    setDashboardData({
      totalUniforms,
      totalCost,
      expiringItems,
      pendingEmployees,
      pendingEmployeesEpi
    });
  }, [setDashboardData]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      const [uniformsData, deliveriesData, contractsData, employeesData] = await Promise.all([
        Uniform.filter({ cnpj: currentUser.cnpj }, '-created_date'),
        UniformDelivery.filter({ cnpj: currentUser.cnpj }, '-created_date'),
        Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' }),
        Employee.filter({ cnpj: currentUser.cnpj, status: 'ativo' })
      ]);

      setUniforms(uniformsData);
      setDeliveries(deliveriesData);
      setContracts(contractsData);
      setEmployees(employeesData);
      calculateDashboard(uniformsData, deliveriesData, employeesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setIsLoading(false);
  }, [calculateDashboard, setUser, setUniforms, setDeliveries, setContracts, setEmployees, setIsLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUniformSave = async (formData) => {
    try {
      const dataToSave = { ...formData, cnpj: user.cnpj };

      if (selectedUniform) {
        await Uniform.update(selectedUniform.id, dataToSave);
      } else {
        await Uniform.create(dataToSave);
      }

      await loadData();
      setIsUniformFormOpen(false);
      setSelectedUniform(null);
    } catch (error) {
      console.error('Erro ao salvar uniforme:', error);
      alert('Erro ao salvar uniforme. Verifique os dados.');
    }
  };

  const handleDeliverySave = async (formData) => {
    try {
      const uniform = uniforms.find(u => u.id === formData.uniform_id);
      const totalCost = (formData.quantity || 0) * (uniform?.unit_cost || 0);

      // Calcular data de vencimento
      const deliveryDate = new Date(formData.delivery_date);
      const expiryDate = new Date(deliveryDate);
      expiryDate.setMonth(expiryDate.getMonth() + (uniform?.validity_months || 12));

      const dataToSave = {
        ...formData,
        total_cost: totalCost,
        expiry_date: expiryDate.toISOString().split('T')[0],
        cnpj: user.cnpj
      };

      await UniformDelivery.create(dataToSave);
      await loadData();
      setIsDeliveryFormOpen(false);
    } catch (error) {
      console.error('Erro ao registrar entrega:', error);
      alert('Erro ao registrar entrega. Verifique os dados.');
    }
  };

  const handleOpenForm = (type) => {
    if (type === 'uniform') {
      setSelectedUniform(null); // Ensure no uniform is selected for new form
      setIsUniformFormOpen(true);
    } else if (type === 'delivery') {
      setIsDeliveryFormOpen(true);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const generateReceiptPDF = async (receiptDeliveries) => {
    try {
      if (!receiptDeliveries?.length) {
        alert('Nenhum item para gerar recibo.');
        return;
      }

      const first = receiptDeliveries[0];
      const isEpiReceipt = receiptDeliveries.some(d => d.is_epi);
      const employee = employees.find(e => e.id === first.employee_id);
      const contract = contracts.find(c => c.id === first.contract_id);
      const companyName = user?.company_name || 'Empresa';
      const companyCnpj = user?.cnpj || '';
      const companyAddress = user?.company_address || '';
      const logo = user?.company_logo_url || '';
      const issuerName = user?.full_name || '';
      const issuerCargo = user?.cargo || '';
      const issuerMatricula = user?.matricula || '';

      const formatDateBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
      const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

      const itemsRows = receiptDeliveries.map(d => {
        const uniform = uniforms.find(u => u.id === d.uniform_id);
        const unitCost = uniform?.unit_cost || 0;
        return `
          <tr>
            <td>${uniform?.item_name || '-'}</td>
            <td>${uniform?.category || '-'}</td>
            ${isEpiReceipt ? `<td>${uniform?.ca_number || '-'}</td>` : ''}
            <td>${uniform?.size || '-'}</td>
            <td>${d.quantity || 0}</td>
            <td>${formatCurrency(unitCost)}</td>
            <td>${formatCurrency(d.total_cost)}</td>
          </tr>`;
      }).join('');

      const total = receiptDeliveries.reduce((s, d) => s + (d.total_cost || 0), 0);
      const receiptCode = first.receipt_id || `REC-${first.id}`;
      const fileName = `Recibo_Uniformes_${employee?.name?.replace(/\s+/g,'_')}_${receiptCode}.html`;

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Recibo de Entrega de Uniformes - ${employee?.name || '-'}</title>
<style>
  @page { size: A4; margin: 2cm; }
  :root { --text:#222; --muted:#6b7280; --line:#e5e7eb; --primary:#1d4ed8; }
  html, body { margin:0; padding:0; color:var(--text); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; }
  .page { max-width:21cm; margin:0 auto; background:white; box-shadow:0 0 10px rgba(0,0,0,.08); }
  .wrap { padding:2cm; }
  .header { display:flex; align-items:center; gap:16px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  .logo { width:72px; height:72px; display:flex; align-items:center; justify-content:center; }
  .logo img { max-width:100%; max-height:72px; object-fit:contain; }
  .company { flex:1; }
  .company h1 { font-size:18px; margin:0; line-height:1.2; letter-spacing:.2px; }
  .company p { margin:2px 0 0; color:var(--muted); font-size:12px; }
  .title { text-align:center; margin:18px 0 6px; font-size:18px; font-weight:700; color:#111827; }
  .subtitle { text-align:center; color:var(--muted); font-size:12px; margin-bottom:18px; }
  .meta { display:flex; justify-content:space-between; gap:16px; font-size:12px; margin-bottom:16px; align-items:baseline; }
  .badge { padding:2px 8px; background:#eef2ff; color:#3730a3; border-radius:999px; font-weight:600; font-size:11px; }
  .card { border:1px solid var(--line); border-radius:10px; overflow:hidden; margin-bottom:14px; }
  .card h3 { margin:0; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid var(--line); font-size:13px; }
  .card .content { padding:12px; font-size:13px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .row { display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed var(--line); }
  .row:last-child { border-bottom:none; }
  .label { color:var(--muted); }
  .value { font-weight:600; color:#111827; }
  .table { width:100%; border-collapse:collapse; font-size:13px; }
  .table th, .table td { border:1px solid var(--line); padding:8px; text-align:left; }
  .table th { background:#f3f4f6; }
  .footer { margin-top:18px; font-size:11px; color:var(--muted); text-align:center; }
  .signs { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:18px; }
  .sign { text-align:center; margin-top:28px; }
  .sign .line { border-top:1px solid #111827; margin-top:40px; padding-top:6px; font-size:12px; }
  @media print { .page { box-shadow:none; } body { background:white; } }
</style>
</head>
<body>
  <div class="page">
    <div class="wrap">
      <div class="header">
        <div class="logo">${logo ? `<img src='${logo}' alt='Logo' />` : ''}</div>
        <div class="company">
          <h1>${companyName}</h1>
          <p>${companyAddress || ''}</p>
          <p>${companyCnpj ? `CNPJ: ${companyCnpj}` : ''}</p>
        </div>
      </div>

      <div class="title">${isEpiReceipt ? 'Ficha de Entrega de EPI' : 'Recibo de Entrega de Uniformes'}</div>
      <div class="subtitle">${isEpiReceipt ? 'Nos termos da NR-6 — comprovante de entrega de Equipamento de Proteção Individual' : 'Comprovante agrupado de itens entregues'}</div>

      <div class="meta">
        <div><strong>Contrato:</strong> ${contract?.name || '-'}</div>
        <div><strong>Data:</strong> ${formatDateBR(first.delivery_date)}</div>
        <div class="badge">Recibo: ${receiptCode}</div>
      </div>

      <div class="card">
        <h3>Dados do Colaborador</h3>
        <div class="content grid">
          <div class="row"><span class="label">Nome</span><span class="value">${employee?.name || '-'}</span></div>
          <div class="row"><span class="label">Função</span><span class="value">${employee?.role || '-'}</span></div>
          <div class="row"><span class="label">CPF</span><span class="value">${employee?.cpf || '-'}</span></div>
          <div class="row"><span class="label">Contrato</span><span class="value">${contract?.name || '-'}</span></div>
        </div>
      </div>

      <div class="card">
        <h3>${isEpiReceipt ? 'EPIs Entregues' : 'Itens Entregues'}</h3>
        <div class="content">
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoria</th>
                ${isEpiReceipt ? '<th>CA</th>' : ''}
                <th>Tamanho</th>
                <th>Quantidade</th>
                <th>Custo Unitário</th>
                <th>Custo Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
              <tr>
                <td colspan="${isEpiReceipt ? 6 : 5}" style="text-align:right; font-weight:700;">Total</td>
                <td style="font-weight:700;">${formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      ${first.delivery_observations ? `
      <div class="card">
        <h3>Observações</h3>
        <div class="content">
          <div>${first.delivery_observations || ''}</div>
        </div>
      </div>` : ''}

      <div class="signs">
        <div class="sign">
          <div class="line">Assinatura do Colaborador</div>
          <div style="font-size:12px; color:var(--muted);">${employee?.name || '-'}</div>
        </div>
        <div class="sign">
          <div class="line">Assinatura da Empresa</div>
          <div style="font-size:12px; color:var(--muted);">${issuerName || companyName}${issuerCargo ? ` • ${issuerCargo}` : ''}${issuerMatricula ? ` • Matrícula: ${issuerMatricula}` : ''}</div>
        </div>
      </div>

      <div class="footer">Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}.</div>
    </div>
  </div>
  <script>
    window.addEventListener('load', () => { try { window.print(); } catch(e) {} });
  </script>
</body>
</html>`;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      }

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Erro ao gerar recibo agrupado:', error);
      alert('Erro ao gerar recibo agrupado.');
    }
  };

  const handleDeleteDelivery = async (deliveryId) => {
    if (window.confirm('Tem certeza que deseja excluir esta entrega de uniforme? Esta ação não pode ser desfeita.')) {
      try {
        await UniformDelivery.delete(deliveryId);
        await loadData();
        alert('Entrega de uniforme excluída com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir entrega:', error);
        alert('Erro ao excluir entrega de uniforme.');
      }
    }
  };

  const handleBaixaFuncional = async (deliveryId) => {
    if (window.confirm('Confirmar baixa funcional deste uniforme? O status será alterado para "devolvido".')) {
      try {
        await UniformDelivery.update(deliveryId, {
          status: 'devolvido',
          return_date: new Date().toISOString().split('T')[0]
        });
        await loadData();
        alert('Baixa funcional registrada com sucesso!');
      } catch (error) {
        console.error('Erro ao registrar baixa funcional:', error);
        alert('Erro ao registrar baixa funcional.');
      }
    }
  };

  // ── Estoque ─────────────────────────────────────────────────────────────
  const getStockInfo = (uniform) => {
    const entregues = deliveries
      .filter(d => d.uniform_id === uniform.id && d.status === 'em_uso')
      .reduce((s, d) => s + (d.quantity || 0), 0);
    const total = uniform.stock_quantity ?? 0;
    const disponivel = total - entregues;
    const minStock = uniform.min_stock ?? 0;
    const status = disponivel <= 0 ? 'critico' : minStock > 0 && disponivel <= minStock ? 'baixo' : 'ok';
    return { total, entregues, disponivel, minStock, status };
  };

  const openStockEntry = (uniform, type = 'entrada') => {
    setStockEntryUniform(uniform);
    setStockEntryType(type);
    setStockEntryQty(type === 'ajuste' ? (uniform.stock_quantity ?? 0) : 1);
    setIsStockEntryOpen(true);
  };

  const handleStockSave = async () => {
    if (!stockEntryUniform) return;
    setStockSaving(true);
    try {
      let newQty = stockEntryUniform.stock_quantity ?? 0;
      if (stockEntryType === 'entrada') newQty += Number(stockEntryQty);
      else if (stockEntryType === 'saida') newQty = Math.max(0, newQty - Number(stockEntryQty));
      else newQty = Number(stockEntryQty);

      await Uniform.update(stockEntryUniform.id, { stock_quantity: newQty });
      await loadData();
      setIsStockEntryOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar estoque.');
    } finally {
      setStockSaving(false);
    }
  };

  const stockItems = uniforms
    .map(u => ({ ...u, ...getStockInfo(u) }))
    .filter(u =>
      !stockSearch ||
      u.item_name?.toLowerCase().includes(stockSearch.toLowerCase()) ||
      u.category?.toLowerCase().includes(stockSearch.toLowerCase())
    );

  const stockCritico = stockItems.filter(u => u.status === 'critico').length;
  const stockBaixo = stockItems.filter(u => u.status === 'baixo').length;
  const totalDisponivel = stockItems.reduce((s, u) => s + u.disponivel, 0);
  const valorEstoque = stockItems.reduce((s, u) => s + (u.disponivel * (u.unit_cost || 0)), 0);
  // ────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Gestão de Uniformes e EPIs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controle o catálogo de itens e as entregas para sua equipe.</p>
        </div>
        <div className="flex gap-2">
          {canPerformAction(userRole, 'create') && (
            <>
              <Button variant="outline" onClick={() => handleOpenForm('delivery')}>
                <Truck className="w-4 h-4 mr-2" /> Nova Entrega
              </Button>
              <Button onClick={() => handleOpenForm('uniform')}>
                <Plus className="w-4 h-4 mr-2" /> Novo Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Uniformes Entregues</p>
            <p className="text-2xl font-bold text-foreground mt-1">{dashboardData.totalUniforms}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Custo Total</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(dashboardData.totalCost)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vencendo em 30d</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{dashboardData.expiringItems}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sem Uniforme</p>
            <p className="text-2xl font-bold text-foreground mt-1">{dashboardData.pendingEmployees}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sem EPI</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{dashboardData.pendingEmployeesEpi}</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isUniformFormOpen} onOpenChange={setIsUniformFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedUniform ? 'Editar Uniforme' : 'Novo Uniforme'}
            </DialogTitle>
          </DialogHeader>
          <UniformForm
            uniform={selectedUniform}
            onSave={handleUniformSave}
            onCancel={() => {
              setIsUniformFormOpen(false);
              setSelectedUniform(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDeliveryFormOpen} onOpenChange={setIsDeliveryFormOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Nova Entrega</DialogTitle>
          </DialogHeader>
          <UniformDeliveryForm
            contracts={contracts}
            employees={employees}
            uniforms={uniforms}
            onSave={handleDeliverySave}
            onCancel={() => setIsDeliveryFormOpen(false)}
          />
        </DialogContent>
      </Dialog>


      {/* Dialog Movimentação de Estoque */}
      <Dialog open={isStockEntryOpen} onOpenChange={setIsStockEntryOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {stockEntryType === 'entrada' && <ArrowUpCircle className="w-5 h-5 text-green-500" />}
              {stockEntryType === 'saida' && <Minus className="w-5 h-5 text-red-500" />}
              {stockEntryType === 'ajuste' && <BoxSelect className="w-5 h-5 text-blue-500" />}
              {stockEntryType === 'entrada' ? 'Entrada de Estoque' : stockEntryType === 'saida' ? 'Saída de Estoque' : 'Ajuste de Estoque'}
            </DialogTitle>
          </DialogHeader>
          {stockEntryUniform && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 border border-border rounded-lg">
                <p className="font-semibold text-foreground">{stockEntryUniform.item_name}</p>
                <p className="text-sm text-muted-foreground">{stockEntryUniform.category} · Tam. {stockEntryUniform.size}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Estoque atual: <span className="font-semibold text-foreground">{stockEntryUniform.stock_quantity ?? 0} unid.</span>
                </p>
              </div>
              <div className="space-y-1">
                <Label>{stockEntryType === 'ajuste' ? 'Nova quantidade total' : 'Quantidade'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={stockEntryQty}
                  onChange={e => setStockEntryQty(e.target.value)}
                  className="bg-background border-border"
                />
                {stockEntryType !== 'ajuste' && (
                  <p className="text-xs text-muted-foreground">
                    Resultado: {stockEntryType === 'entrada'
                      ? (stockEntryUniform.stock_quantity ?? 0) + Number(stockEntryQty)
                      : Math.max(0, (stockEntryUniform.stock_quantity ?? 0) - Number(stockEntryQty))} unid.
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsStockEntryOpen(false)}>Cancelar</Button>
                <Button
                  className="flex-1"
                  onClick={handleStockSave}
                  disabled={stockSaving || Number(stockEntryQty) < 0}
                >
                  {stockSaving ? 'Salvando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Abas Principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="estoque" className="gap-1">
            <Warehouse className="w-3.5 h-3.5" /> Estoque
            {(stockCritico + stockBaixo) > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {stockCritico + stockBaixo}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="uniforms">Catálogo</TabsTrigger>
          <TabsTrigger value="deliveries">Entregas</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <UniformDashboard
            dashboardData={dashboardData}
            deliveries={deliveries}
            uniforms={uniforms}
            employees={employees}
            contracts={contracts}
          />
        </TabsContent>

        {/* ── ABA ESTOQUE ───────────────────────────────────── */}
        <TabsContent value="estoque" className="mt-6 space-y-6">
          {/* KPIs de estoque */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-card border-border border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Disponível</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totalDisponivel}</p>
                <p className="text-xs text-muted-foreground">unidades em estoque</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border border-l-4 border-l-green-500 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor em Estoque</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(valorEstoque)}</p>
                <p className="text-xs text-muted-foreground">custo total disponível</p>
              </CardContent>
            </Card>
            <Card className={`bg-card border-border border-l-4 ${stockBaixo > 0 ? 'border-l-amber-500' : 'border-l-muted'} shadow-sm`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Estoque Baixo</p>
                <p className={`text-2xl font-bold mt-1 ${stockBaixo > 0 ? 'text-amber-600' : 'text-foreground'}`}>{stockBaixo}</p>
                <p className="text-xs text-muted-foreground">itens abaixo do mínimo</p>
              </CardContent>
            </Card>
            <Card className={`bg-card border-border border-l-4 ${stockCritico > 0 ? 'border-l-red-500' : 'border-l-muted'} shadow-sm`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Crítico / Zerado</p>
                <p className={`text-2xl font-bold mt-1 ${stockCritico > 0 ? 'text-red-600' : 'text-foreground'}`}>{stockCritico}</p>
                <p className="text-xs text-muted-foreground">itens sem estoque</p>
              </CardContent>
            </Card>
          </div>

          {/* Alertas */}
          {(stockCritico + stockBaixo) > 0 && (
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Atenção: itens com estoque baixo</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stockItems.filter(u => u.status !== 'ok').map(u => (
                        <span key={u.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status === 'critico' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {u.item_name} ({u.size}) — {u.disponivel} unid.
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtro */}
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar item..."
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    className="pl-9 bg-background border-border"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de estoque */}
          <Card className="bg-card border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-primary" /> Posição de Estoque
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Em Estoque</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Em Uso</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disponível</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mínimo</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Localização</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Warehouse className="w-6 h-6 text-muted-foreground opacity-50" />
                          </div>
                          <p className="text-muted-foreground text-sm">Nenhum item cadastrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : stockItems.map(u => (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{u.item_name}</p>
                        <p className="text-xs text-muted-foreground">Tam. {u.size}{u.color ? ` · ${u.color}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{u.category}</td>
                      <td className="px-4 py-3 text-center font-semibold text-foreground">{u.total}</td>
                      <td className="px-4 py-3 text-center text-amber-600 font-medium">{u.entregues}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${u.disponivel <= 0 ? 'text-red-600 dark:text-red-400' : u.status === 'baixo' ? 'text-amber-600' : 'text-green-600 dark:text-green-400'}`}>
                          {u.disponivel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{u.minStock || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {u.status === 'ok' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">OK</Badge>}
                        {u.status === 'baixo' && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs gap-1"><TrendingDown className="w-3 h-3" />Baixo</Badge>}
                        {u.status === 'critico' && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Crítico</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {u.stock_location ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{u.stock_location}</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30" onClick={() => openStockEntry(u, 'entrada')}>
                            <ArrowUpCircle className="w-3.5 h-3.5" /> Entrada
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30" onClick={() => openStockEntry(u, 'saida')}>
                            <Minus className="w-3.5 h-3.5" /> Saída
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openStockEntry(u, 'ajuste')}>
                            <BoxSelect className="w-3.5 h-3.5" /> Ajustar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="uniforms" className="mt-6">
          <UniformList
            uniforms={uniforms}
            onEdit={(uniform) => {
              setSelectedUniform(uniform);
              setIsUniformFormOpen(true);
            }}
            onDataChange={loadData}
          />
        </TabsContent>

        <TabsContent value="deliveries" className="mt-6">
          <div className="space-y-4">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por funcionário..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-background border-border"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agrupar entregas por recibo */}
            <div className="grid gap-4">
              {Object.values(
                deliveries.reduce((acc, d) => {
                  const key = d.receipt_id || d.id;
                  if (!acc[key]) acc[key] = { key, list: [] };
                  acc[key].list.push(d);
                  return acc;
                }, {})
              )
                .map(group => {
                  const first = group.list[0];
                  const employee = employees.find(e => e.id === first.employee_id);
                  const contract = contracts.find(c => c.id === first.contract_id);
                  const total = group.list.reduce((s, it) => s + (it.total_cost || 0), 0);
                  const filteredBySearch = employee?.name?.toLowerCase().includes(searchTerm.toLowerCase());
                  if (!filteredBySearch) return null;

                  return (
                    <Card key={group.key} className="bg-card border-border shadow-sm">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-foreground">{employee?.name}</h4>
                          <Badge variant="outline" className="border-border text-muted-foreground">{contract?.name}</Badge>
                          {first.receipt_id && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs">Recibo: {first.receipt_id}</Badge>
                          )}
                          {group.list.some(d => d.is_epi) && (
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs gap-1">
                              <ShieldAlert className="w-3 h-3" /> EPI
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">Entregue: {new Date(first.delivery_date).toLocaleDateString()}</span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left border-b border-border">
                                <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                                <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tam.</th>
                                <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qtd</th>
                                <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Situação</th>
                                <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validade</th>
                                <th className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                                <th className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.list.map((delivery) => {
                                const uniform = uniforms.find(u => u.id === delivery.uniform_id);
                                const isExpiring = delivery.expiry_date && new Date(delivery.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                                return (
                                  <tr key={delivery.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                                    <td className="py-2 pr-4 font-medium text-foreground">{uniform?.item_name}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{uniform?.size}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{delivery.quantity}</td>
                                    <td className="py-2 pr-4 capitalize text-muted-foreground">{(delivery.status || '').replace('_',' ') || '-'}</td>
                                    <td className={`py-2 pr-4 ${isExpiring ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{delivery.expiry_date ? new Date(delivery.expiry_date).toLocaleDateString() : '—'}</td>
                                    <td className="py-2 font-medium text-foreground">{formatCurrency(delivery.total_cost)}</td>
                                    <td className="py-2">
                                      <div className="flex gap-1">
                                        {delivery.status === 'em_uso' && (
                                          <Button variant="outline" size="sm" onClick={() => handleBaixaFuncional(delivery.id)}>
                                            <CheckCircle className="w-3 h-3" />
                                          </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => handleDeleteDelivery(delivery.id)} className="text-red-600 hover:text-red-700">
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="border-t border-border bg-muted/50">
                                <td colSpan={5} className="py-2 pr-4 text-right font-semibold text-muted-foreground text-sm">Total do Recibo</td>
                                <td className="py-2 font-bold text-foreground">{formatCurrency(total)}</td>
                                <td className="py-2">
                                  <Button variant="outline" size="sm" onClick={() => generateReceiptPDF(group.list)} className="gap-1 text-xs">
                                    <Receipt className="w-3 h-3" /> PDF
                                  </Button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Uniformes Entregues</p>
                <p className="text-2xl font-bold text-foreground mt-1">{dashboardData.totalUniforms}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Custo Total</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(dashboardData.totalCost)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vencendo em 30 dias</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{dashboardData.expiringItems}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sem Uniforme</p>
                <p className="text-2xl font-bold text-foreground mt-1">{dashboardData.pendingEmployees}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}