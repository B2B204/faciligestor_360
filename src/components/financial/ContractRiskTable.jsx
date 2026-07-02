import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function ContractRiskTable({ contracts=[], measurements=[], entries=[] }) {
  const risks = useMemo(() => {
    const byContract = {};
    contracts.forEach(c=>byContract[c.id]={ name:c.name, id:c.id, riskScore:0, risk:"Baixo" });

    // margens negativas recorrentes
    const negMap = {};
    entries.forEach(e=>{
      if (!negMap[e.contract_id]) negMap[e.contract_id]=0;
      if ((e.final_result||0) < 0) negMap[e.contract_id] += 1;
    });

    const lateMeasures = {};
    measurements.forEach(m=>{
      const isLate = m.status!=="Aprovada" && m.due_date && new Date(m.due_date) < new Date();
      if (isLate) lateMeasures[m.contract_id] = (lateMeasures[m.contract_id]||0)+1;
      const lowExec = (m.execution_percentage||0) < 70;
      if (lowExec) lateMeasures[m.contract_id] = (lateMeasures[m.contract_id]||0)+1;
      const noDocs = (m.documents_count||0) === 0;
      if (noDocs) lateMeasures[m.contract_id] = (lateMeasures[m.contract_id]||0)+1;
    });

    Object.keys(byContract).forEach(id=>{
      const score = (negMap[id]||0) + (lateMeasures[id]||0);
      let level = "Baixo";
      if (score>=3) level="Alto"; else if (score>=1) level="Médio";
      byContract[id].riskScore = score; byContract[id].risk = level;
    });

    return Object.values(byContract).sort((a,b)=> (b.riskScore)-(a.riskScore));
  }, [contracts, measurements, entries]);

  const color = (r)=> r==="Alto"?"bg-red-100 text-red-800":r==="Médio"?"bg-amber-100 text-amber-800":"bg-green-100 text-green-800";

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader><CardTitle>Risco Contratual</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contrato</TableHead>
              <TableHead>Risco</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map(r=>(
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge className={color(r.risk)}>{r.risk}</Badge></TableCell>
                <TableCell>{r.riskScore}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}