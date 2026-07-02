import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Timer, CheckCircle2, Clock3, AlertTriangle } from "lucide-react";

export default function OSStats({ totals }) {
  const fmt = (v) => typeof v === "number" ? v.toFixed(1) : v;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between"><span className="text-gray-500 text-sm">Abertas</span><Clock3 className="w-5 h-5 text-blue-500" /></div>
        <div className="text-3xl font-bold">{totals.open || 0}</div>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between"><span className="text-gray-500 text-sm">Em Andamento</span><Timer className="w-5 h-5 text-amber-500" /></div>
        <div className="text-3xl font-bold">{totals.progress || 0}</div>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between"><span className="text-gray-500 text-sm">Concluídas</span><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
        <div className="text-3xl font-bold">{totals.closed || 0}</div>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center justify-between"><span className="text-gray-500 text-sm">SLA Médio (dias)</span><AlertTriangle className="w-5 h-5 text-purple-600" /></div>
        <div className="text-3xl font-bold">{fmt(totals.avgSLA || 0)}</div>
      </CardContent></Card>
    </div>
  );
}