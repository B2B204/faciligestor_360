
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ServiceOrderMaterial } from "@/entities/ServiceOrderMaterial";
import { ServiceOrder } from "@/entities/ServiceOrder";
import { User } from "@/entities/User";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MaterialsManager({ serviceOrderId, onChanged }) {
  const [list, setList] = useState([]);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ material_name:"", quantity:1, unit:"un", unit_cost:0 });

  const load = useCallback(async () => {
    if (!serviceOrderId) return;
    const u = await User.me(); setUser(u);
    const data = await ServiceOrderMaterial.filter({ cnpj: u.cnpj, service_order_id: serviceOrderId });
    setList(data);
  }, [serviceOrderId]); // serviceOrderId is a dependency of load

  useEffect(() => { 
    load(); 
  }, [load]); // load is now a dependency of useEffect

  const totalMaterials = useMemo(()=> list.reduce((s,m)=> s + (m.total_cost || 0), 0), [list]);

  const add = async () => {
    if (!form.material_name.trim()) return;
    const qty = Number(form.quantity) || 0;
    const cost = Number(form.unit_cost) || 0;
    const total = qty * cost;
    await ServiceOrderMaterial.create({
      service_order_id: serviceOrderId,
      material_name: form.material_name.trim(),
      quantity: qty,
      unit: form.unit,
      unit_cost: cost,
      total_cost: total,
      cnpj: user.cnpj
    });
    setForm({ material_name:"", quantity:1, unit:"un", unit_cost:0 });
    await load();
    // Recalculate total materials cost after adding, based on the *updated* list
    // A fresh load() will update 'list', so totalMaterials should reflect that in the next render cycle.
    // However, if we need to update ServiceOrder immediately, we need the *new* total.
    // The previous calculation `totalMaterials + total` was based on the old `totalMaterials`.
    // It's safer to re-calculate from the *newly loaded* list if `load` is awaited.
    const updatedListAfterAdd = await ServiceOrderMaterial.filter({ cnpj: user.cnpj, service_order_id: serviceOrderId });
    const newTotalAfterAdd = updatedListAfterAdd.reduce((s,m)=> s + (m.total_cost||0), 0);
    await ServiceOrder.update(serviceOrderId, { total_material_cost: newTotalAfterAdd });
    onChanged?.();
  };

  const remove = async (id) => {
    await ServiceOrderMaterial.delete(id);
    const u = await User.me(); // This 'u' is effectively 'user' from state, potentially redundant
    await load(); // Reloads the list
    // Recalculate total materials cost after removing, based on the *updated* list
    const updatedListAfterRemove = await ServiceOrderMaterial.filter({ cnpj: u.cnpj, service_order_id: serviceOrderId });
    const newTotalAfterRemove = updatedListAfterRemove.reduce((s,m)=> s+(m.total_cost||0), 0);
    await ServiceOrder.update(serviceOrderId, { total_material_cost: newTotalAfterRemove });
    onChanged?.();
  };

  const fmt = (v)=> new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Input placeholder="Material/insumo" value={form.material_name} onChange={(e)=>setForm({...form, material_name: e.target.value})} />
        <Input type="number" placeholder="Qtd" value={form.quantity} onChange={(e)=>setForm({...form, quantity: e.target.value})} />
        <Input placeholder="Unid" value={form.unit} onChange={(e)=>setForm({...form, unit: e.target.value})} />
        <Input type="number" step="0.01" placeholder="Custo unit." value={form.unit_cost} onChange={(e)=>setForm({...form, unit_cost: e.target.value})} />
      </div>
      <Button onClick={add}>Adicionar Material</Button>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Material</TableHead><TableHead>Qtd</TableHead><TableHead>Un</TableHead><TableHead>C.Unit</TableHead><TableHead>Total</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {list.map(m=>(
            <TableRow key={m.id}>
              <TableCell>{m.material_name}</TableCell>
              <TableCell>{m.quantity}</TableCell>
              <TableCell>{m.unit}</TableCell>
              <TableCell>{fmt(m.unit_cost)}</TableCell>
              <TableCell className="font-semibold">{fmt(m.total_cost)}</TableCell>
              <TableCell><button className="text-red-600" onClick={()=>remove(m.id)}>Remover</button></TableCell>
            </TableRow>
          ))}
          {list.length===0 && (<TableRow><TableCell colSpan={6} className="text-center text-sm text-gray-500">Sem materiais.</TableCell></TableRow>)}
        </TableBody>
      </Table>
      <div className="text-right font-semibold">Total Materiais: {fmt(totalMaterials)}</div>
    </div>
  );
}
