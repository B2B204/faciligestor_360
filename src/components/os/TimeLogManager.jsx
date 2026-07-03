
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ServiceOrderTimeLog } from "@/entities/ServiceOrderTimeLog";
import { ServiceOrder } from "@/entities/ServiceOrder";
import { User } from "@/entities/User";
import { Employee } from "@/entities/Employee";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TimeLogManager({ serviceOrderId, onChanged }) {
  const [list, setList] = useState([]);
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employee_id:"", date:"", hours:"", notes:"" });

  const load = useCallback(async () => {
    if (!serviceOrderId) return;
    const u = await User.me(); setUser(u);
    const data = await ServiceOrderTimeLog.filter({ cnpj: u.cnpj, service_order_id: serviceOrderId });
    setList(data);
    const emps = await Employee.filter({ cnpj: u.cnpj });
    setEmployees(emps);
  }, [serviceOrderId]);

  useEffect(() => { load(); }, [load]);

  const totalHours = useMemo(()=> list.reduce((s,t)=> s + (t.hours || 0), 0), [list]);

  const add = async () => {
    const hours = Number(form.hours) || 0;
    const emp = employees.find(e=>e.id===form.employee_id);
    if (!form.employee_id || !form.date || hours <= 0) return;
    await ServiceOrderTimeLog.create({
      service_order_id: serviceOrderId,
      employee_id: form.employee_id,
      employee_name: emp?.name || "",
      date: form.date,
      hours,
      notes: form.notes || "",
      cnpj: user.cnpj
    });
    setForm({ employee_id:"", date:"", hours:"", notes:"" });
    await load();
    await ServiceOrder.update(serviceOrderId, { total_hours: totalHours + hours });
    onChanged?.();
  };

  const remove = async (id) => {
    await ServiceOrderTimeLog.delete(id);
    await load();
    const newHours = list.filter(i=>i.id!==id).reduce((s,t)=> s+(t.hours||0), 0);
    await ServiceOrder.update(serviceOrderId, { total_hours: newHours });
    onChanged?.();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Select value={form.employee_id} onValueChange={(v)=>setForm({...form, employee_id: v})}>
          <SelectTrigger><SelectValue placeholder="Funcionário" /></SelectTrigger>
          <SelectContent>
            {employees.map(e=>(<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Input type="date" value={form.date} onChange={(e)=>setForm({...form, date: e.target.value})} />
        <Input type="number" step="0.1" placeholder="Horas" value={form.hours} onChange={(e)=>setForm({...form, hours: e.target.value})} />
        <Input placeholder="Notas (opcional)" value={form.notes} onChange={(e)=>setForm({...form, notes: e.target.value})} />
      </div>
      <Button onClick={add}>Adicionar Hora</Button>
      <div className="text-sm text-gray-600">Total horas: {totalHours}</div>
      <ul className="space-y-2">
        {list.map(t=>(
          <li key={t.id} className="flex items-center justify-between border rounded p-2">
            <span>{t.date} • {t.employee_name} • {t.hours}h {t.notes ? `• ${t.notes}` : ""}</span>
            <button className="text-red-600" onClick={()=>remove(t.id)}>Remover</button>
          </li>
        ))}
        {list.length===0 && <p className="text-sm text-gray-500">Nenhum registro de horas.</p>}
      </ul>
    </div>
  );
}
