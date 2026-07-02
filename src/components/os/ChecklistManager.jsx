
import React, { useEffect, useState, useCallback } from "react";
import { ServiceOrderChecklist } from "@/entities/ServiceOrderChecklist";
import { User } from "@/entities/User";
import { UploadFile } from "@/integrations/Core";
import { getCurrentPosition, mapsLink } from "@/lib/geolocation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, MapPin, Loader2 } from "lucide-react";

export default function ChecklistManager({ serviceOrderId, onChanged }) {
  const [items, setItems] = useState([]);
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!serviceOrderId) return;
    const u = await User.me();
    setUser(u);
    const list = await ServiceOrderChecklist.filter({ cnpj: u.cnpj, service_order_id: serviceOrderId });
    setItems(list);
  }, [serviceOrderId]);

  useEffect(() => { load(); }, [load]);

  const addItem = async () => {
    if (!text.trim()) return;
    await ServiceOrderChecklist.create({ service_order_id: serviceOrderId, item: text.trim(), cnpj: user.cnpj });
    setText("");
    await load();
    onChanged?.();
  };

  const toggle = async (it) => {
    const willBeDone = !it.is_done;
    const patch = { is_done: willBeDone, done_at: willBeDone ? new Date().toISOString() : null, done_by: willBeDone ? user?.email : null };
    if (willBeDone) {
      try {
        const pos = await getCurrentPosition();
        patch.done_lat = pos.lat;
        patch.done_lng = pos.lng;
      } catch {
        // GPS indisponível ou negado — segue sem coordenadas
      }
    } else {
      patch.done_lat = null;
      patch.done_lng = null;
    }
    await ServiceOrderChecklist.update(it.id, patch);
    await load();
    onChanged?.();
  };

  const remove = async (it) => {
    await ServiceOrderChecklist.delete(it.id);
    await load();
    onChanged?.();
  };

  const addPhoto = async (it, file) => {
    if (!file) return;
    setBusyId(it.id);
    try {
      const { file_url } = await UploadFile({ file });
      await ServiceOrderChecklist.update(it.id, { photo_url: file_url });
      await load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Nova etapa do checklist" value={text} onChange={(e)=>setText(e.target.value)} />
        <Button onClick={addItem}>Adicionar</Button>
      </div>
      <div className="space-y-2">
        {items.map(it=>(
          <div key={it.id} className="border rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox checked={!!it.is_done} onCheckedChange={()=>toggle(it)} />
                <span className={it.is_done ? "line-through text-gray-500" : ""}>{it.item}</span>
              </div>
              <button className="text-red-600 text-sm" onClick={()=>remove(it)}>Remover</button>
            </div>
            {it.is_done && (
              <div className="flex flex-wrap items-center gap-3 pl-6 text-xs text-gray-500">
                {(it.done_lat != null && it.done_lng != null) && (
                  <a href={mapsLink(it.done_lat, it.done_lng)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                    <MapPin className="w-3 h-3" /> Local registrado
                  </a>
                )}
                {it.photo_url ? (
                  <a href={it.photo_url} target="_blank" rel="noreferrer">
                    <img src={it.photo_url} alt="Evidência" className="w-10 h-10 object-cover rounded border" />
                  </a>
                ) : (
                  <label className="inline-flex items-center gap-1 cursor-pointer hover:text-gray-700">
                    {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    Anexar foto
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>addPhoto(it, e.target.files?.[0])} disabled={busyId === it.id} />
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">Nenhum item no checklist.</p>}
      </div>
    </div>
  );
}
