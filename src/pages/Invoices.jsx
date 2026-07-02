import React, { useEffect, useState } from 'react';
import { Invoice } from '@/entities/Invoice';
import { AccountsReceivable } from '@/entities/AccountsReceivable';
import { AccountsPayable } from '@/entities/AccountsPayable';
import { User } from '@/entities/User';
import { UploadPrivateFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FilePlus2, FileText, CheckCircle } from 'lucide-react';

function useMe() { const [me,setMe]=useState(null); useEffect(()=>{User.me().then(setMe)},[]); return me; }

function parseXmlInvoice(text){
  try{
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const all = Array.from(doc.getElementsByTagName('*'));
    const firstBy = (names)=>{ const el=all.find(e=>names.includes(e.localName)); return el?.textContent?.trim()||'' };
    const findUnder = (parentNames, childNames)=>{ const p=all.find(e=>parentNames.includes(e.localName)); if(!p) return ''; const el=Array.from(p.getElementsByTagName('*')).find(e=>childNames.includes(e.localName)); return el?.textContent?.trim()||'' };
    const number = firstBy(['nNF','Numero']);
    const series = firstBy(['serie','Serie']);
    const issueRaw = firstBy(['dhEmi','dEmi','DataEmissao']);
    const issue_date = issueRaw?.slice(0,10) || '';
    const totalStr = firstBy(['vNF','ValorServicos']);
    const total_amount = parseFloat((totalStr||'').replace(',', '.')) || 0;
    const cnpj_issuer = findUnder(['emit','Prestador'], ['CNPJ','Cnpj']);
    const cnpj_recipient = findUnder(['dest','Tomador'], ['CNPJ','Cnpj']);
    const issuer_name = findUnder(['emit','Prestador'], ['xNome','RazaoSocial','razaoSocial','Nome']);
    const recipient_name = findUnder(['dest','Tomador'], ['xNome','RazaoSocial','razaoSocial','Nome']);
    const access_key = firstBy(['chNFe','ChaveAcesso']);
    let type = 'nfe';
    if (all.find(e=>['InfNfse','CompNfse','Rps'].includes(e.localName))) type = 'nfse';
    return { type, number, series, issue_date, total_amount, cnpj_issuer, cnpj_recipient, issuer_name, recipient_name, access_key };
  }catch{ return null; }
}

const statusBadgeClass = {
  uploaded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs',
  processado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs',
  erro: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs',
};

export default function Invoices(){
  const me = useMe();
  const [file, setFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type:'nfe', number:'', series:'', issue_date:'', total_amount:'', cnpj_issuer:'', cnpj_recipient:'', issuer_name:'', recipient_name:'', access_key:'' });
  const [list, setList] = useState([]);

  const load = async ()=>{ const rows = await Invoice.list('-updated_date', 50); setList(rows); };
  useEffect(()=>{ load(); },[]);

  const createFinRecord = async (inv)=>{
    if(!me?.cnpj) return;
    if(inv.cnpj_issuer === me.cnpj){
      await AccountsReceivable.create({
        contract_id: '', customer_name: inv.recipient_name||'', document_number: inv.number||inv.access_key||'NF', status:'aberto', issue_date: inv.issue_date, competence_month: inv.issue_date?.slice(0,7), due_date: inv.issue_date, face_value: inv.total_amount, open_amount: inv.total_amount, cnpj: me.cnpj
      });
    } else if(inv.cnpj_recipient === me.cnpj){
      await AccountsPayable.create({
        supplier_name: inv.issuer_name||'', document_number: inv.number||inv.access_key||'NF', status:'aberto', issue_date: inv.issue_date, competence_month: inv.issue_date?.slice(0,7), due_date: inv.issue_date, face_value: inv.total_amount, open_amount: inv.total_amount, cnpj: me.cnpj, invoice_id: inv.id
      });
    }
  };

  const handleUpload = async () => {
    if(!file) return;
    setCreating(true);
    const text = await file.text();
    const parsed = parseXmlInvoice(text) || {};
    const { file_uri } = await UploadPrivateFile({ file });
    const payload = { ...parsed, total_amount: Number(parsed.total_amount)||0, xml_file_uri: file_uri, status: 'uploaded', environment: 'homologacao', cnpj: me?.cnpj };
    const inv = await Invoice.create(payload);
    await createFinRecord(inv);
    setFile(null); setCreating(false); await load();
  };

  const handleCreateManual = async (e)=>{
    e.preventDefault(); setCreating(true);
    const inv = await Invoice.create({ ...form, total_amount: Number(form.total_amount)||0, environment:'homologacao', cnpj: me?.cnpj });
    await createFinRecord(inv);
    setForm({ type:'nfe', number:'', series:'', issue_date:'', total_amount:'', cnpj_issuer:'', cnpj_recipient:'', access_key:'' });
    setCreating(false); await load();
  };

  const fmt = (val) => Number(val||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Notas Fiscais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Importe XML ou lance manualmente NF-e e NFS-e</p>
        </div>
      </div>

      {/* XML Upload */}
      <Card className="bg-card border-border border-l-4 border-l-blue-500 shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Upload className="w-5 h-5 text-blue-500" /> Importar XML (NF-e / NFS-e)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1">
              <Label className="text-sm font-medium text-muted-foreground mb-1.5 block">Arquivo XML</Label>
              <Input
                type="file"
                accept=".xml"
                onChange={e=>setFile(e.target.files?.[0]||null)}
                className="bg-background border-border cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground"
              />
            </div>
            <Button
              onClick={handleUpload}
              disabled={!file || creating}
              className="gap-2 shrink-0"
            >
              <Upload className="w-4 h-4" />
              {creating ? 'Processando...' : 'Fazer upload e importar'}
            </Button>
          </div>
          {file && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" /> Arquivo selecionado: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Manual form */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <FilePlus2 className="w-5 h-5 text-primary" /> Lançamento Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleCreateManual} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Tipo</Label>
              <Select value={form.type} onValueChange={(v)=>setForm(s=>({...s,type:v}))}>
                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfe">NF-e</SelectItem>
                  <SelectItem value="nfse">NFS-e</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Número</Label>
              <Input value={form.number} onChange={e=>setForm(s=>({...s,number:e.target.value}))} className="bg-background border-border" placeholder="Número da nota" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Série</Label>
              <Input value={form.series} onChange={e=>setForm(s=>({...s,series:e.target.value}))} className="bg-background border-border" placeholder="Ex: 1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Data Emissão</Label>
              <Input type="date" value={form.issue_date} onChange={e=>setForm(s=>({...s,issue_date:e.target.value}))} className="bg-background border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Valor Total (R$)</Label>
              <Input type="number" step="0.01" value={form.total_amount} onChange={e=>setForm(s=>({...s,total_amount:e.target.value}))} className="bg-background border-border" placeholder="0,00" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Emitente (CNPJ)</Label>
              <Input value={form.cnpj_issuer} onChange={e=>setForm(s=>({...s,cnpj_issuer:e.target.value}))} className="bg-background border-border" placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Emitente (Nome)</Label>
              <Input value={form.issuer_name} onChange={e=>setForm(s=>({...s,issuer_name:e.target.value}))} className="bg-background border-border" placeholder="Razão social" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Destinatário (CNPJ)</Label>
              <Input value={form.cnpj_recipient} onChange={e=>setForm(s=>({...s,cnpj_recipient:e.target.value}))} className="bg-background border-border" placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Destinatário (Nome)</Label>
              <Input value={form.recipient_name} onChange={e=>setForm(s=>({...s,recipient_name:e.target.value}))} className="bg-background border-border" placeholder="Razão social" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Chave de Acesso</Label>
              <Input value={form.access_key} onChange={e=>setForm(s=>({...s,access_key:e.target.value}))} className="bg-background border-border font-mono text-xs" placeholder="44 dígitos" />
            </div>
            <div className="md:col-span-3 flex justify-end pt-2">
              <Button type="submit" disabled={creating} className="gap-2">
                <FilePlus2 className="w-4 h-4" />
                {creating ? 'Salvando...' : 'Criar Nota Fiscal'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" /> Últimas Notas Importadas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-muted-foreground opacity-60" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma nota fiscal</h3>
              <p className="text-muted-foreground text-sm mb-4">Importe um XML ou crie um lançamento manual acima</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Tipo</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Número</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Série</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Emissão</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Total</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(r => (
                    <TableRow key={r.id} className="border-border hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs font-mono">
                          {r.type?.toUpperCase() || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground font-mono">{r.number || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.series || '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.issue_date || '-'}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                        R$ {fmt(r.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass[r.status] || 'bg-muted text-muted-foreground border-0 text-xs'}>
                          {r.status || '-'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
