import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User } from "@/entities/User";
import { AccountsReceivable } from "@/entities/AccountsReceivable";
import { AccountsPayable } from "@/entities/AccountsPayable";
import { BankAccount } from "@/entities/BankAccount";
import { Invoice } from "@/entities/Invoice";
import { BankTransaction } from "@/entities/BankTransaction";
import { FiscalSettings } from "@/entities/FiscalSettings";
import { FinancialEntry } from "@/entities/FinancialEntry";
import MetricCard from "@/components/financial/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, FileText, Landmark, ArrowDownCircle, ArrowUpCircle, CheckCircle, AlertTriangle, BarChart3 } from "lucide-react";

function currency(n){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0); }
function todayStr(){ const d=new Date(); return d.toISOString().slice(0,10); }
function ym(d){ return d.toISOString().slice(0,7); }

export default function FinanceDashboard(){
  const [loading,setLoading]=useState(true);
  const [kpi,setKpi]=useState({
    bankTotal:0, bankCount:0,
    recvOpen:0, recvOverdue:0, recvDueToday:0,
    payOpen:0, payOverdue:0, payDueToday:0,
    invCountMonth:0, invTotalMonth:0,
    unreconciled:0,
    dreRevenue:0, dreCosts:0, dreResult:0,
    fiscalOk:false
  });
  const [topDue, setTopDue] = useState({ receivables: [], payables: [] });

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
      const me = await User.me();
      const cnpj = me?.cnpj;
      const thisMonth = ym(new Date());

      const [bankAccs, recvs, pays, invs, trx, fisc, entries] = await Promise.all([
        BankAccount.filter({ cnpj }),
        AccountsReceivable.filter({ cnpj }),
        AccountsPayable.filter({ cnpj }),
        Invoice.filter({ cnpj }),
        BankTransaction.filter({ cnpj }),
        FiscalSettings.filter({ cnpj }),
        FinancialEntry.filter({ cnpj })
      ]);

      const sum = (arr, f)=> arr.reduce((s,x)=> s + (Number(x[f])||0), 0);
      const isOpenRecv = (s)=> ["aberto","parcial","vencido"].includes(s);
      const isOpenPay = (s)=> ["aberto","parcial","vencido"].includes(s);

      const bankTotal = sum(bankAccs, 'current_balance');
      const bankCount = bankAccs.length;

      const rOpen = recvs.filter(r=> isOpenRecv(r.status));
      const recvOpen = sum(rOpen, 'open_amount');
      const recvOverdue = sum(recvs.filter(r=> r.status==='vencido'), 'open_amount');
      const recvDueToday = sum(rOpen.filter(r=> r.due_date===todayStr()), 'open_amount');

      const pOpen = pays.filter(p=> isOpenPay(p.status));
      const payOpen = sum(pOpen, 'open_amount');
      const payOverdue = sum(pays.filter(p=> p.status==='vencido'), 'open_amount');
      const payDueToday = sum(pOpen.filter(p=> p.due_date===todayStr()), 'open_amount');

      const invMonth = invs.filter(i=> (i.issue_date||'').slice(0,7)===thisMonth);
      const invCountMonth = invMonth.length;
      const invTotalMonth = sum(invMonth, 'total_amount');

      const unreconciled = trx.filter(t=> (t.matched_entity||'none')==='none').length;

      const entriesMonth = entries.filter(e=> (e.reference_month||'').slice(0,7)===thisMonth);
      const dreRevenue = sum(entriesMonth, 'net_revenue');
      const dreCosts = sum(entriesMonth, 'total_costs');
      const dreResult = sum(entriesMonth, 'final_result');

      const fiscalOk = (fisc||[]).length>0;

      const upcomingRecvs = (list)=> list
        .filter(x=> isOpenRecv(x.status))
        .filter(x=> x.due_date)
        .sort((a,b)=> a.due_date.localeCompare(b.due_date))
        .slice(0,5);

      const upcomingPays = (list)=> list
        .filter(x=> isOpenPay(x.status))
        .filter(x=> x.due_date)
        .sort((a,b)=> a.due_date.localeCompare(b.due_date))
        .slice(0,5);

      setTopDue({ receivables: upcomingRecvs(recvs), payables: upcomingPays(pays) });

      setKpi({ bankTotal, bankCount, recvOpen, recvOverdue, recvDueToday, payOpen, payOverdue, payDueToday, invCountMonth, invTotalMonth, unreconciled, dreRevenue, dreCosts, dreResult, fiscalOk });
      } catch (error) {
        console.error("Erro ao carregar dashboard financeiro:", error);
      } finally {
        setLoading(false);
      }
    })();
  },[]);

  if (loading){
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Financeiro</h1>
        <p className="text-muted-foreground text-sm">Visão consolidada das finanças da empresa.</p>
      </div>
      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Saldo Bancário" value={currency(kpi.bankTotal)} subtitle={`${kpi.bankCount} contas`} icon={Landmark} accent="text-blue-700" />
        <MetricCard title="A Receber em Aberto" value={currency(kpi.recvOpen)} subtitle={`Vencidos: ${currency(kpi.recvOverdue)} | Hoje: ${currency(kpi.recvDueToday)}`} icon={ArrowDownCircle} accent="text-green-700" />
        <MetricCard title="A Pagar em Aberto" value={currency(kpi.payOpen)} subtitle={`Vencidos: ${currency(kpi.payOverdue)} | Hoje: ${currency(kpi.payDueToday)}`} icon={ArrowUpCircle} accent="text-red-700" />
        <MetricCard title="Notas (mês)" value={`${kpi.invCountMonth} notas`} subtitle={`Total ${currency(kpi.invTotalMonth)}`} icon={FileText} accent="text-amber-700" />
      </div>

      {/* DRE, Conciliação, Fiscal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle>Resultado do Mês (DRE)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Receita Líquida</div>
                <div className="text-lg font-bold text-green-700">{currency(kpi.dreRevenue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Custos</div>
                <div className="text-lg font-bold text-red-700">{currency(kpi.dreCosts)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Resultado</div>
                <div className={`text-lg font-bold ${kpi.dreResult>=0? 'text-green-700':'text-red-700'}`}>{currency(kpi.dreResult)}</div>
              </div>
            </div>
            <div className="mt-4">
              <Link to="/dre"><Button variant="outline" className="w-full">Abrir DRE</Button></Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle>Conciliação Bancária</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Transações não conciliadas</div>
                <div className="text-2xl font-bold text-amber-700">{kpi.unreconciled}</div>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <div className="mt-4">
              <Link to="/bank-reconciliation"><Button variant="outline" className="w-full">Conciliar Agora</Button></Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle>Configurações Fiscais</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              {kpi.fiscalOk ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Configuração fiscal encontrada</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>Nenhuma configuração fiscal cadastrada</span>
                </>
              )}
            </div>
            <div className="mt-4">
              <Link to="/fiscal"><Button variant="outline" className="w-full">Abrir Configurações</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximos vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Próximos Vencimentos - Receber</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Em Aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDue.receivables.map((r)=> (
                    <TableRow key={r.id}>
                      <TableCell>{r.customer_name||'-'}</TableCell>
                      <TableCell>{r.document_number||'-'}</TableCell>
                      <TableCell>{r.due_date||'-'}</TableCell>
                      <TableCell className="text-right">{currency(r.open_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 text-right">
              <Link to="/AccountsReceivable"><Button variant="link">Ver Contas a Receber</Button></Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Próximos Vencimentos - Pagar</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Em Aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDue.payables.map((p)=> (
                    <TableRow key={p.id}>
                      <TableCell>{p.supplier_name||'-'}</TableCell>
                      <TableCell>{p.document_number||'-'}</TableCell>
                      <TableCell>{p.due_date||'-'}</TableCell>
                      <TableCell className="text-right">{currency(p.open_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 text-right">
              <Link to="/accounts-payable"><Button variant="link">Ver Contas a Pagar</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acesso rápido */}
      <Card>
        <CardHeader><CardTitle>Acesso Rápido</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Link to="/bank-accounts"><Button variant="outline" className="w-full justify-start"><Landmark className="w-4 h-4 mr-2"/>Contas Bancárias</Button></Link>
            <Link to="/accounts-payable"><Button variant="outline" className="w-full justify-start"><ArrowUpCircle className="w-4 h-4 mr-2"/>A Pagar</Button></Link>
            <Link to="/AccountsReceivable"><Button variant="outline" className="w-full justify-start"><ArrowDownCircle className="w-4 h-4 mr-2"/>A Receber</Button></Link>
            <Link to="/invoices"><Button variant="outline" className="w-full justify-start"><FileText className="w-4 h-4 mr-2"/>Notas</Button></Link>
            <Link to="/bank-reconciliation"><Button variant="outline" className="w-full justify-start"><DollarSign className="w-4 h-4 mr-2"/>Conciliação</Button></Link>
            <Link to="/dre"><Button variant="outline" className="w-full justify-start"><BarChart3 className="w-4 h-4 mr-2"/>DRE</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}