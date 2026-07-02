import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function formatCurrency(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);}

export default function CashflowForecast({ entries }) {
  const data = useMemo(() => {
    // Agrupa por YYYY-MM
    const map = {};
    entries.forEach(e => {
      if (!e.reference_month) return;
      const k = e.reference_month;
      map[k] = map[k] || { receita:0, custos:0 };
      map[k].receita += e.net_revenue || 0;
      map[k].custos += e.total_costs || 0;
    });
    const months = Object.keys(map).sort();
    const avgMargin = months.length ? months.reduce((s,m)=>s+((map[m].receita-map[m].custos)||0),0)/months.length : 0;

    // Projeção simples: mantém média de margem para próximos 3 meses
    const last = months[months.length-1];
    const [y,m] = last ? last.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth()+1];
    const proj = [];
    for(let i=1;i<=3;i++){
      const d = new Date(y, (m-1)+i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const baseReceita = months.length ? (map[last].receita) : 0;
      proj.push({ key, receita: baseReceita, custos: Math.max(baseReceita-avgMargin,0), proj:true });
    }

    const chart = months.map(k=>({ mes:k, receita: map[k].receita, custos: map[k].custos, proj:false }))
      .concat(proj.map(p=>({ mes:p.key, receita:p.receita, custos:p.custos, proj:true })));
    return chart;
  }, [entries]);

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader><CardTitle>Fluxo de Caixa Preditivo (30/60/90 dias)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip formatter={(v)=>formatCurrency(v)} />
            <Line type="monotone" dataKey="receita" stroke="#16a34a" strokeWidth={3} dot />
            <Line type="monotone" dataKey="custos" stroke="#dc2626" strokeWidth={3} dot strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}