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
    try {
      const rows = await UserCnpjAccess.filter({ user_email: user.email });
      const cnpjs = Array.from(new Set([...(rows || []).map(r => r.cnpj), user?.cnpj || ""].filter(Boolean)));
      setList(cnpjs);
      setValue(user?.cnpj || cnpjs[0] || "");
    } catch (error) {
      console.error('Erro ao carregar CNPJs disponíveis:', error);
      setList(user?.cnpj ? [user.cnpj] : []);
      setValue(user?.cnpj || "");
    }
  };

  useEffect(() => {
    load();
    setAggregate(localStorage.getItem("cnpj-aggregate") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEffect(() => {
    // O CnpjSwitcher vive no Layout, fora das páginas onde o acesso a um
    // CNPJ é concedido (Perfil, Configurações da Empresa) — sem esse
    // evento, a lista só atualizaria depois de um F5 manual.
    window.addEventListener('cnpj-access-changed', load);
    return () => window.removeEventListener('cnpj-access-changed', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // Garante que o cnpj selecionado sempre tenha um SelectItem correspondente
  // já renderizado, mesmo no primeiro paint (antes de load() resolver) —
  // sem isso o Radix Select define o valor mas não acha o item para exibir
  // o texto, e o seletor fica em branco.
  const displayList = value && !list.includes(value) ? [...list, value] : list;

  const handleChange = async (cnpj) => {
    if (cnpj === value) return;
    setValue(cnpj);
    const me = await User.me();
    // O CNPJ atual só existe como profile.cnpj (nem sempre tem uma linha
    // própria em user_cnpj_access) — sem guardar um acesso pra ele antes de
    // trocar, ele simplesmente some da lista ao virar o "de antes".
    if (me.cnpj && me.cnpj !== cnpj) {
      const existing = await UserCnpjAccess.filter({ user_email: me.email, cnpj: me.cnpj });
      if (!existing || existing.length === 0) {
        await UserCnpjAccess.create({ user_email: me.email, cnpj: me.cnpj });
      }
    }
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
          {displayList.map(c => (
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