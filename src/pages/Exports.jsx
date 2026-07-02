import React, { useState } from 'react';
import { Invoice } from '@/entities/Invoice';
import { AccountsPayable } from '@/entities/AccountsPayable';
import { AccountsReceivable } from '@/entities/AccountsReceivable';
import { BankTransaction } from '@/entities/BankTransaction';
import { BankAccount } from '@/entities/BankAccount';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, FileArchive, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

async function fetchData(month){
  const [invoices, pay, recv, bank, accounts] = await Promise.all([
    Invoice.filter({ }, '-created_date', 2000),
    AccountsPayable.filter({ }, '-created_date', 2000),
    AccountsReceivable.filter({ }, '-created_date', 2000),
    BankTransaction.filter({ }, '-created_date', 5000),
    BankAccount.list('-updated_date', 200),
  ]);
  const filt = (rows, field)=> rows.filter(r=> (r[field]||'').startsWith(month));
  return {
    invoices: filt(invoices, 'issue_date'),
    payables: filt(pay, 'due_date'),
    receivables: filt(recv, 'due_date'),
    bank: filt(bank, 'posted_date'),
    accounts
  };
}

function aoa(headers, rows){ return [headers, ...rows]; }

export default function Exports(){
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [working, setWorking] = useState(false);

  const exportExcel = async ()=>{
    setWorking(true);
    const data = await fetchData(month);
    const wb = XLSX.utils.book_new();
    const inv = aoa(['Tipo','Número','Série','Emissão','Valor','Emitente','Destinatário'], data.invoices.map(i=>[i.type,i.number,i.series,i.issue_date,i.total_amount,i.cnpj_issuer,i.cnpj_recipient]));
    const wsInv = XLSX.utils.aoa_to_sheet(inv); XLSX.utils.book_append_sheet(wb, wsInv, 'Notas');
    const pay = aoa(['Documento','Vencimento','Valor','Status','Categoria','Conta'], data.payables.map(p=>[p.document_number,p.due_date,p.face_value,p.status,p.category||'',p.bank_account_id||'']));
    const wsPay = XLSX.utils.aoa_to_sheet(pay); XLSX.utils.book_append_sheet(wb, wsPay, 'Pagar');
    const rec = aoa(['Documento','Vencimento','Valor','Status','Conta'], data.receivables.map(r=>[r.document_number,r.due_date,r.face_value,r.status,r.bank_account_id||'']));
    const wsRec = XLSX.utils.aoa_to_sheet(rec); XLSX.utils.book_append_sheet(wb, wsRec, 'Receber');
    const btx = aoa(['Data','Tipo','Valor','FITID','Nome','Memo'], data.bank.map(b=>[b.posted_date,b.trn_type,b.amount,b.fitid,b.name,b.memo]));
    const wsB = XLSX.utils.aoa_to_sheet(btx); XLSX.utils.book_append_sheet(wb, wsB, 'Banco');
    const bals = aoa(['Banco','Conta','Número','Saldo Atual'], data.accounts.map(a=>[a.bank_name,a.account_name,a.account_number,a.current_balance]));
    const wsBA = XLSX.utils.aoa_to_sheet(bals); XLSX.utils.book_append_sheet(wb, wsBA, 'Saldos');
    const xbuf = XLSX.write(wb, { type:'array', bookType:'xlsx' });
    const blob = new Blob([xbuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `export-${month}.xlsx`; a.click();
    setWorking(false);
  };

  const exportPdf = async ()=>{
    setWorking(true);
    const data = await fetchData(month);
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text(`Resumo Financeiro - ${month}`, 14, 18);
    let y = 28; doc.setFontSize(12);
    const addRow = (label, value)=>{ doc.text(`${label}: ${value}`, 14, y); y += 6; if (y > 280){ doc.addPage(); y = 20; } };
    const totalInv = data.invoices.reduce((s,i)=> s+Number(i.total_amount||0),0);
    const totalPay = data.payables.reduce((s,p)=> s+Number(p.face_value||0),0);
    const totalRec = data.receivables.reduce((s,r)=> s+Number(r.face_value||0),0);
    const credits = data.bank.filter(b=>b.trn_type==='CREDIT').reduce((s,b)=> s+Number(b.amount||0),0);
    const debits = data.bank.filter(b=>b.trn_type==='DEBIT').reduce((s,b)=> s+Number(b.amount||0),0);
    addRow('Notas fiscais (valor total)', `R$ ${totalInv.toFixed(2)}`);
    addRow('Contas a pagar (lançadas)', `R$ ${totalPay.toFixed(2)}`);
    addRow('Contas a receber (lançadas)', `R$ ${totalRec.toFixed(2)}`);
    addRow('Créditos bancários no mês', `R$ ${credits.toFixed(2)}`);
    addRow('Débitos bancários no mês', `R$ ${debits.toFixed(2)}`);
    doc.save(`financeiro-${month}.pdf`);
    setWorking(false);
  };

  const exportZip = async ()=>{
    setWorking(true);
    const data = await fetchData(month);
    const zip = new JSZip();
    const toCsv = (arr)=> arr.map(r=> Object.values(r).map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n');
    zip.file('invoices.csv', toCsv(data.invoices));
    zip.file('payables.csv', toCsv(data.payables));
    zip.file('receivables.csv', toCsv(data.receivables));
    zip.file('bank.csv', toCsv(data.bank));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pacote-contabil-${month}.zip`; a.click();
    setWorking(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" /> Exportações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Exporte dados financeiros mensais em diferentes formatos.</p>
        </div>
      </div>

      <Card className="bg-card border-border shadow-sm max-w-2xl">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base font-semibold text-foreground">Exportações Mensais</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div>
            <Label className="text-sm font-medium text-foreground">Mês de referência</Label>
            <Input
              type="month"
              value={month}
              onChange={e=>setMonth(e.target.value)}
              className="mt-1 bg-background border-border max-w-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={!working ? exportExcel : undefined}>
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium text-foreground text-sm">Excel</span>
                <span className="text-xs text-muted-foreground">Planilha com abas separadas</span>
                <Button onClick={exportExcel} disabled={working} className="w-full mt-1" size="sm">
                  {working ? 'Gerando...' : 'Baixar .xlsx'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={!working ? exportPdf : undefined}>
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <span className="font-medium text-foreground text-sm">PDF</span>
                <span className="text-xs text-muted-foreground">Resumo financeiro do mês</span>
                <Button onClick={exportPdf} disabled={working} variant="outline" className="w-full mt-1 border-border" size="sm">
                  {working ? 'Gerando...' : 'Baixar .pdf'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={!working ? exportZip : undefined}>
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <FileArchive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium text-foreground text-sm">Pacote Contábil</span>
                <span className="text-xs text-muted-foreground">CSVs em arquivo .zip</span>
                <Button onClick={exportZip} disabled={working} variant="outline" className="w-full mt-1 border-border" size="sm">
                  {working ? 'Gerando...' : 'Baixar .zip'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}