import React, { useEffect, useState } from "react";
import { UserCnpjAccess } from "@/entities/UserCnpjAccess";
import { User } from "@/entities/User";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import RequestCnpjDialog from "./RequestCnpjDialog";

export default function CnpjSwitcher({ user, onChanged }) {
  const [list, setList] = useState([]);
  const [value, setValue] = useState(user?.cnpj || "");
  const [aggregate, setAggregate] = useState(false);

  const load = async () => {
    if (!user?.email) return;
    // Segurança: só entram na lista CNPJs efetivamente aprovados para este usuário
    // (user_cnpj_access) mais o CNPJ atual do próprio perfil — nunca todos os CNPJs
    // ativos do sistema, para não permitir troca livre para dados de outra empresa.
    const rows = await UserCnpjAccess.filter({ user_email: user.email });
    const cnpjs = Array.from(new Set([...(rows || []).map(r => r.cnpj), user?.cnpj || ""].filter(Boolean)));
    setList(cnpjs);
    setValue(user?.cnpj || cnpjs[0] || "");
  };

  useEffect(() => {
    load();
    setAggregate(localStorage.getItem("cnpj-aggregate") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const handleChange = async (cnpj) => {
    setValue(cnpj);
    const me = await User.me();
    await User.update(me.id, { cnpj });
    onChanged?.();
    window.location.reload();
  };

  const toggleAggregate = (v) => {
    setAggregate(v);
    localStorage.setItem("cnpj-aggregate", v ? "1" : "0");
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Selecionar CNPJ" />
        </SelectTrigger>
        <SelectContent>
          {list.map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 px-2">
        <Switch checked={aggregate} onCheckedChange={toggleAggregate} />
        <span className="text-sm text-gray-600">Agregado</span>
      </div>

      <RequestCnpjDialog user={user} onSubmitted={load} />
    </div>
  );
}