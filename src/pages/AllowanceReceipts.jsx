
import React, { useState, useEffect, useCallback } from 'react';
import { Contract } from '@/entities/Contract';
import { Employee } from '@/entities/Employee';
import { AllowanceReceipt } from '@/entities/AllowanceReceipt';
import { User } from '@/entities/User';
import { InvokeLLM } from '@/integrations/Core';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote, FileDown, Loader2, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export default function AllowanceReceiptsPage() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedContract, setSelectedContract] = useState('');
  const [competence, setCompetence] = useState(format(new Date(), 'yyyy-MM'));
  const [receiptType, setReceiptType] = useState('ambos'); // 'va' | 'vt' | 'ambos'

  const [rows, setRows] = useState({}); // { [employeeId]: { va_days, va_daily_rate, vt_days, vt_daily_rate, reembolso, discounts } }
  const [existingReceipts, setExistingReceipts] = useState({}); // { [employeeId]: AllowanceReceipt }
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [rowGenerating, setRowGenerating] = useState({}); // { [employeeId]: boolean }
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        const contractsData = await Contract.filter({ cnpj: currentUser.cnpj, status: 'ativo' });
        setContracts(contractsData);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const loadExistingReceipts = useCallback(async (contractId, month) => {
    if (!user) return;
    const recs = await AllowanceReceipt.filter({ cnpj: user.cnpj, contract_id: contractId, competence_month: month });
    const map = {};
    (recs || []).forEach(r => { map[r.employee_id] = r; });
    setExistingReceipts(map);
  }, [user]);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!selectedContract) {
        setEmployees([]);
        setRows({});
        setExistingReceipts({});
        return;
      }
      setIsLoading(true);
      try {
        const employeesData = await Employee.filter({ contract_id: selectedContract, status: 'ativo' });
        setEmployees(employeesData);
        const initRows = {};
        employeesData.forEach(e => {
          initRows[e.id] = {
            va_days: 22,
            va_daily_rate: Number(e.meal_allowance || 0),
            vt_days: 22,
            vt_daily_rate: Number(e.transport_allowance || 0),
            reembolso: 0,
            discounts: 0
          };
        });
        setRows(initRows);
        await loadExistingReceipts(selectedContract, competence);
      } finally {
        setIsLoading(false);
      }
    };
    loadEmployees();
  }, [selectedContract, competence, loadExistingReceipts]);

  const handleRowChange = (empId, field, value) => {
    setRows(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: Number(value)
      }
    }));
  };

  const computeRowTotals = (row) => {
    const va = (row.va_days || 0) * (row.va_daily_rate || 0);
    const vt = (row.vt_days || 0) * (row.vt_daily_rate || 0);
    const total = va + vt + (row.reembolso || 0) - (row.discounts || 0);
    return { va_total: va, vt_total: vt, final_total: total };
  };

  // Total específico do documento gerado: quando o recibo é só de VA ou
  // só de VT, não soma o benefício que não está sendo emitido nesse recibo.
  const computeReceiptTotal = (row, totals, type) => {
    const base = type === 'va' ? totals.va_total : type === 'vt' ? totals.vt_total : totals.va_total + totals.vt_total;
    return base + (row.reembolso || 0) - (row.discounts || 0);
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const saveReceiptRecord = async (employee, row, totals) => {
    if (!user || !selectedContract || !competence) {
      console.error("Missing data to save receipt record.");
      return;
    }
    await AllowanceReceipt.create({
      contract_id: selectedContract,
      employee_id: employee.id,
      competence_month: competence,
      va_days: row.va_days || 0,
      va_daily_rate: row.va_daily_rate || 0,
      va_total: totals.va_total,
      vt_days: row.vt_days || 0,
      vt_daily_rate: row.vt_daily_rate || 0,
      vt_total: totals.vt_total,
      reembolso: row.reembolso || 0,
      discounts: row.discounts || 0,
      total_value: totals.final_total,
      receipt_type: receiptType,
      cnpj: user.cnpj,
      status: "gerado"
    });
    setExistingReceipts(prev => ({
      ...prev,
      [employee.id]: {
        ...(prev[employee.id] || {}),
        employee_id: employee.id,
        contract_id: selectedContract,
        competence_month: competence,
        total_value: totals.final_total,
        status: "gerado"
      }
    }));
  };

  const handleGenerateForEmployee = async (employee) => {
    if (!user?.company_logo_url) {
      alert("Logo da empresa não encontrada. Adicione uma logo no seu Perfil antes de gerar os recibos.");
      return;
    }
    const contract = contracts.find(c => c.id === selectedContract);
    if (!contract) {
      alert("Contrato não encontrado.");
      return;
    }
    const row = rows[employee.id] || {};
    const calculatedValues = computeRowTotals(row);
    const receiptTotal = computeReceiptTotal(row, calculatedValues, receiptType);

    setRowGenerating(prev => ({ ...prev, [employee.id]: true }));

    const monthFormatted = format(new Date(competence + '-01'), 'MMMM yyyy');
    const benefitLines = [
      receiptType !== 'vt' ? `- VA - Dias: ${row.va_days || 0} | Valor Diário: ${formatCurrency(row.va_daily_rate)} | Total: ${formatCurrency(calculatedValues.va_total)}` : '',
      receiptType !== 'va' ? `- VT - Dias: ${row.vt_days || 0} | Valor Diário: ${formatCurrency(row.vt_daily_rate)} | Total: ${formatCurrency(calculatedValues.vt_total)}` : '',
      (row.reembolso || 0) > 0 ? `- Reembolso: ${formatCurrency(row.reembolso)}` : '',
    ].filter(Boolean).join('\n');

    try {
      const response = await InvokeLLM({
        prompt: `Gere um recibo elegante de entrega de ${receiptTypeLabels[receiptType] || receiptTypeLabels.ambos} em HTML com CSS inline.

DADOS DA EMPRESA:
- Logo: ${user.company_logo_url}
- Nome: ${user.company_name}
- CNPJ: ${user.cnpj}
- Endereço: ${user.company_address || ''}

DADOS DO CONTRATO:
- Nome do Contrato: ${contract?.name || ''}
- Número do Contrato: ${contract?.contract_number || ''}
- Cliente: ${contract?.client_name || ''}
- Unidade: ${employee.unidade || contract?.unidade || ''}

DADOS DO FUNCIONÁRIO:
- Nome: ${employee.name}
- CPF: ${employee.cpf}
- Função: ${employee.role}

DADOS DO RECIBO:
- Competência: ${monthFormatted}
${benefitLines}
- Descontos: ${formatCurrency(row.discounts)}
- Valor Final: ${formatCurrency(receiptTotal)}

ESPECIFICAÇÕES DE LAYOUT:
1. HTML COMPLETO, com CSS inline, pronto para impressão em A4.
2. Cabeçalho com logo e dados da empresa.
3. Seções: Dados do Funcionário, Declaração, Tabela de Valores, Total, Assinatura e Rodapé.
4. Linguagem: português do Brasil.
5. Rodapé deve conter: "Gerado por ${user.email} em ${format(new Date(), 'dd/MM/yyyy HH:mm')}". 

IMPORTANTE: Retorne no formato JSON com a chave html_content contendo o HTML completo.`,
        response_json_schema: { type: "object", properties: { html_content: { type: "string" } } }
      });

      const htmlContent = response.html_content;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recibo_${employee.name.replace(/ /g, '_')}_${competence}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await saveReceiptRecord(employee, row, calculatedValues);

    } catch (error) {
      console.error(`Erro ao gerar recibo para ${employee.name}:`, error);
      alert(`Falha ao gerar recibo de ${employee.name}. Verifique o console para mais detalhes.`);
    }

    setRowGenerating(prev => ({ ...prev, [employee.id]: false }));
  };

  const receiptTypeLabels = {
    va: 'Recibo de Vale Alimentação',
    vt: 'Recibo de Vale Transporte',
    ambos: 'Recibo de Vale Alimentação e Vale Transporte',
  };

  // Gera HTML A4 profissional (sem LLM), pronto para download/impressão.
  // type: 'va' | 'vt' | 'ambos' — controla quais benefícios entram no documento.
  const buildReceiptA4HTML = (employee, row, totals, autoPrint = false, type = 'ambos') => {
    const contract = contracts.find(c => c.id === selectedContract);
    const companyName = user?.company_name || 'Empresa';
    const companyCnpj = user?.cnpj || '';
    const companyAddress = user?.company_address || '';
    const logoUrl = user?.company_logo_url || '';
    const monthFormatted = format(new Date(competence + '-01'), 'MMMM yyyy');

    const formattedVaDailyRate = formatCurrency(row.va_daily_rate);
    const formattedVaTotal = formatCurrency(totals.va_total);
    const formattedVtDailyRate = formatCurrency(row.vt_daily_rate);
    const formattedVtTotal = formatCurrency(totals.vt_total);
    const formattedReembolso = formatCurrency(row.reembolso || 0);
    const formattedDiscounts = formatCurrency(row.discounts || 0);
    const receiptTotal = computeReceiptTotal(row, totals, type);
    const formattedFinalTotal = formatCurrency(receiptTotal);
    const generatedTimestamp = format(new Date(), 'dd/MM/yyyy HH:mm');

    const benefitRows = [
      type !== 'vt' ? `
              <tr>
                <td>Vale Alimentação (VA)</td>
                <td>${row.va_days || 0}</td>
                <td>${formattedVaDailyRate}</td>
                <td>${formattedVaTotal}</td>
              </tr>` : '',
      type !== 'va' ? `
              <tr>
                <td>Vale Transporte (VT)</td>
                <td>${row.vt_days || 0}</td>
                <td>${formattedVtDailyRate}</td>
                <td>${formattedVtTotal}</td>
              </tr>` : '',
      (row.reembolso || 0) > 0 ? `
              <tr>
                <td colspan="3">Reembolso</td>
                <td>${formattedReembolso}</td>
              </tr>` : '',
    ].join('');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Recibo VA/VT - ${employee.name} - ${monthFormatted}</title>
<style>
  @page { size: A4; margin: 20mm; }
  :root { --text:#111827; --muted:#6b7280; --line:#e5e7eb; --brand:#2563eb; }
  html, body { margin:0; padding:0; color:var(--text); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; }
  .page { max-width:21cm; margin:0 auto; background:white; box-shadow:0 0 12px rgba(0,0,0,.08); }
  .wrap { padding:20mm; }
  .letterhead { display:flex; align-items:center; gap:16px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  .logo { width:72px; height:72px; display:flex; align-items:center; justify-content:center; }
  .logo img { max-width:100%; max-height:72px; object-fit:contain; }
  .company { flex:1; }
  .company h1 { font-size:18px; margin:0; line-height:1.2; }
  .company p { margin:2px 0 0; color:var(--muted); font-size:12px; }
  .title { text-align:center; margin:18px 0 6px; font-size:18px; font-weight:700; color:#111827; }
  .subtitle { text-align:center; color:var(--muted); font-size:12px; margin-bottom:18px; }

  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .card { border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .card h3 { margin:0; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid var(--line); font-size:13px; }
  .card .content { padding:12px; font-size:13px; }
  .row-item { display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px dashed var(--line); }
  .row-item:last-child { border-bottom:none; }
  .row-item span { color:var(--muted); }

  table { width:100%; border-collapse:collapse; margin-top:12px; }
  th, td { border:1px solid var(--line); padding:8px; font-size:12px; }
  th { background:#f3f4f6; text-align:left; }
  tfoot td { font-weight:700; }

  .declaration { border:1px solid var(--line); border-radius:10px; padding:12px; margin-top:12px; font-size:13px; color:#374151; background:#fafafa; }
  .signs { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:24px; }
  .sign { text-align:center; margin-top:28px; }
  .sign .line { border-top:1px solid #111827; margin-top:40px; padding-top:6px; font-size:12px; }
  .footer { margin-top:18px; font-size:11px; color:var(--muted); text-align:center; }
  @media print { .page { box-shadow:none; } body { background:white; } }
</style>
</head>
<body>
  <div class="page">
    <div class="wrap">
      <div class="letterhead">
        <div class="logo">${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : ""}</div>
        <div class="company">
          <h1>${companyName}</h1>
          <p>${companyAddress || ""}</p>
          <p>${companyCnpj ? `CNPJ: ${companyCnpj}` : ""}</p>
        </div>
      </div>

      <div class="title">${receiptTypeLabels[type] || receiptTypeLabels.ambos}</div>
      <div class="subtitle">Competência: ${monthFormatted}</div>

      <div class="grid2">
        <div class="card">
          <h3>Dados do Funcionário</h3>
          <div class="content">
            <div class="row-item"><span>Nome:</span><strong>${employee.name}</strong></div>
            <div class="row-item"><span>CPF:</span><strong>${employee.cpf || '—'}</strong></div>
            <div class="row-item"><span>Função:</span><strong>${employee.role || '—'}</strong></div>
            <div class="row-item"><span>Unidade:</span><strong>${employee.unidade || contract?.unidade || '—'}</strong></div>
          </div>
        </div>
        <div class="card">
          <h3>Dados do Contrato</h3>
          <div class="content">
            <div class="row-item"><span>Contrato:</span><strong>${contract?.name || "—"}</strong></div>
            <div class="row-item"><span>Nº Contrato:</span><strong>${contract?.contract_number || "—"}</strong></div>
            <div class="row-item"><span>Cliente:</span><strong>${contract?.client_name || "—"}</strong></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h3>Resumo dos Benefícios</h3>
        <div class="content">
          <table>
            <thead>
              <tr>
                <th>Benefício</th>
                <th>Dias</th>
                <th>Valor Diário</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${benefitRows}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align:right;">Descontos</td>
                <td>${formattedDiscounts}</td>
              </tr>
              <tr>
                <td colspan="3" style="text-align:right;">Valor Final</td>
                <td>${formattedFinalTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="declaration">
        Declaro para os devidos fins que recebi os benefícios descritos acima, referentes à competência ${monthFormatted}, 
        estando ciente dos valores e descontos aplicados.
      </div>

      <div class="signs">
        <div class="sign">
          <div class="line">Assinatura do Funcionário</div>
        </div>
        <div class="sign">
          <div class="line">Assinatura do Responsável</div>
        </div>
      </div>

      <div class="footer">
        Gerado em ${generatedTimestamp} • Documento interno
      </div>
    </div>
  </div>
  ${autoPrint ? `<script>window.addEventListener('load',()=>{try{window.focus();window.print();}catch(e){}});</script>` : ""}
</body>
</html>
`;
    return html;
  };

  const downloadReceiptHTMLA4 = async (employee, type = receiptType) => {
    const row = rows[employee.id] || {};
    const totals = computeRowTotals(row);
    if (!user || !selectedContract || !competence || !employee.id) {
        alert("Dados insuficientes para gerar o recibo.");
        return;
    }
    const html = buildReceiptA4HTML(employee, row, totals, false, type);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = employee.name.replace(/ /g, '_');
    const typeSuffix = type === 'va' ? 'VA' : type === 'vt' ? 'VT' : 'VA_VT';
    link.href = url;
    link.download = `recibo_${typeSuffix}_${safeName}_${competence}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    await saveReceiptRecord(employee, row, totals);
  };

  const printReceiptA4 = async (employee, type = receiptType) => {
    const row = rows[employee.id] || {};
    const totals = computeRowTotals(row);
    if (!user || !selectedContract || !competence || !employee.id) {
        alert("Dados insuficientes para gerar o recibo.");
        return;
    }
    const html = buildReceiptA4HTML(employee, row, totals, true, type);
    const w = window.open('', '_blank');
    if (!w) {
      alert('Permita pop-ups para imprimir o recibo.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    await saveReceiptRecord(employee, row, totals);
  };

  const handleGenerateBatch = async () => {
    if (!user?.company_logo_url) {
      alert("Logo da empresa não encontrada. Adicione uma logo no seu Perfil antes de gerar os recibos.");
      return;
    }
    if (!selectedContract || !competence) {
      alert("Selecione um contrato e a competência antes de gerar em lote.");
      return;
    }
    setIsBatchGenerating(true);
    for (const emp of employees) {
      // The current handleGenerateBatch uses the LLM method by default
      // If A4 batch generation is desired, this would need to be changed
      // to call downloadReceiptHTMLA4(emp); or printReceiptA4(emp);
      await handleGenerateForEmployee(emp);
    }
    setIsBatchGenerating(false);
    alert("Geração em lote concluída.");
  };

  const exportCSV = () => {
    if (!employees.length) {
      alert("Nenhum funcionário para exportar.");
      return;
    }
    const headers = ["Funcionario","CPF","Contrato","Competencia","VA_Dias","VA_Valor_Diario","VA_Total","VT_Dias","VT_Valor_Diario","VT_Total","Reembolso","Descontos","Total_Final"];
    const contractName = contracts.find(c => c.id === selectedContract)?.name || "";
    const rowsCsv = employees.map(emp => {
      const r = rows[emp.id] || {};
      const calc = computeRowTotals(r);
      return [
        `"${emp.name}"`,
        `"${emp.cpf || ''}"`,
        `"${contractName}"`,
        `"${competence}"`,
        r.va_days || 0,
        (r.va_daily_rate || 0).toFixed(2).replace('.', ','),
        calc.va_total.toFixed(2).replace('.', ','),
        r.vt_days || 0,
        (r.vt_daily_rate || 0).toFixed(2).replace('.', ','),
        calc.vt_total.toFixed(2).replace('.', ','),
        (r.reembolso || 0).toFixed(2).replace('.', ','),
        (r.discounts || 0).toFixed(2).replace('.', ','),
        calc.final_total.toFixed(2).replace('.', ',')
      ].join(';');
    });
    const csv = [headers.join(';'), ...rowsCsv].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibos_${contractName.replace(/ /g,'_')}_${competence}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recibos de VA/VT</h1>
        <p className="text-muted-foreground text-sm">Gere e gerencie recibos de Vale Alimentação e Vale Transporte.</p>
      </div>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Banknote className="w-6 h-6 mr-3 text-blue-600" />
            Gerador de Recibos de VA/VT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Contrato</Label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Competência</Label>
              <Input type="month" value={competence} onChange={e => setCompetence(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de Recibo</Label>
              <Select value={receiptType} onValueChange={setReceiptType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambos">VA + VT (combinado)</SelectItem>
                  <SelectItem value="va">Somente VA</SelectItem>
                  <SelectItem value="vt">Somente VT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={exportCSV} disabled={!employees.length || isLoading}>
                <FileDown className="w-4 h-4 mr-2" /> Exportar CSV
              </Button>
              <Button onClick={handleGenerateBatch} disabled={!employees.length || isBatchGenerating || isLoading}>
                {isBatchGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Gerar em Lote
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedContract && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle>Funcionários do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Carregando funcionários...</div>
            ) : employees.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Nenhum funcionário ativo para este contrato.</div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  Edite os valores por linha. Totais são calculados automaticamente.
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="min-w-[120px]">VA (R$)</TableHead>
                      <TableHead>Dias (VA)</TableHead>
                      <TableHead className="min-w-[120px]">VT (R$)</TableHead>
                      <TableHead>Dias (VT)</TableHead>
                      <TableHead className="min-w-[120px]">Reembolso</TableHead>
                      <TableHead className="min-w-[120px]">Descontos</TableHead>
                      <TableHead className="min-w-[140px]">Total</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map(emp => {
                      const r = rows[emp.id] || {};
                      const calc = computeRowTotals(r);
                      const alreadyGenerated = !!existingReceipts[emp.id];
                      return (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div className="font-medium">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">{emp.cpf}</div>
                            {alreadyGenerated && <div className="text-xs text-green-600 mt-1">Recibo já gerado</div>}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={r.va_daily_rate ?? 0}
                              onChange={e => handleRowChange(emp.id, 'va_daily_rate', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={r.va_days ?? 0}
                              onChange={e => handleRowChange(emp.id, 'va_days', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={r.vt_daily_rate ?? 0}
                              onChange={e => handleRowChange(emp.id, 'vt_daily_rate', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={r.vt_days ?? 0}
                              onChange={e => handleRowChange(emp.id, 'vt_days', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={r.reembolso ?? 0}
                              onChange={e => handleRowChange(emp.id, 'reembolso', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={r.discounts ?? 0}
                              onChange={e => handleRowChange(emp.id, 'discounts', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="font-semibold text-blue-700">
                            {formatCurrency(calc.final_total)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" disabled={!!rowGenerating[emp.id]}>
                                    {rowGenerating[emp.id] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                    Recibo
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={async () => {
                                    setRowGenerating(prev => ({ ...prev, [emp.id]: true }));
                                    await downloadReceiptHTMLA4(emp);
                                    setRowGenerating(prev => ({ ...prev, [emp.id]: false }));
                                  }}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Baixar HTML A4 ({receiptType === 'va' ? 'VA' : receiptType === 'vt' ? 'VT' : 'VA+VT'})
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={async () => {
                                    setRowGenerating(prev => ({ ...prev, [emp.id]: true }));
                                    await printReceiptA4(emp);
                                    setRowGenerating(prev => ({ ...prev, [emp.id]: false }));
                                  }}>
                                    <Printer className="w-4 h-4 mr-2" />
                                    Imprimir / Salvar PDF ({receiptType === 'va' ? 'VA' : receiptType === 'vt' ? 'VT' : 'VA+VT'})
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={async () => {
                                    setRowGenerating(prev => ({ ...prev, [emp.id]: true }));
                                    await handleGenerateForEmployee(emp);
                                    setRowGenerating(prev => ({ ...prev, [emp.id]: false }));
                                  }}>
                                    <Banknote className="w-4 h-4 mr-2" />
                                    Gerar (IA - modelo clássico)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
