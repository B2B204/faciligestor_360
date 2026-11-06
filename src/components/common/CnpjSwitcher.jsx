import React, { useEffect, useState } from "react";
import { UserCnpjAccess } from "@/entities/UserCnpjAccess";
import { supabase } from "@/api/supabaseClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import RequestCnpjDialog from "./RequestCnpjDialog";

export default function CnpjSwitcher({ user, onChanged }) {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [value, setValue] = useState(user?.cnpj || "");
  const [switching, setSwitching] = useState(false);

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
  }, [user?.email, user?.cnpj]);

  useEffect(() => {
    // O CnpjSwitcher vive no Layout, fora das páginas onde o acesso a um
    // CNPJ é concedido (Perfil, Configurações da Empresa) — sem esse
    // evento, a lista só atualizaria depois de um F5 manual.
    window.addEventListener('cnpj-access-changed', load);
    return () => window.removeEventListener('cnpj-access-changed', load);
     
  }, [user?.email, user?.cnpj]);

  // Garante que o cnpj selecionado sempre tenha um SelectItem correspondente
  // já renderizado, mesmo no primeiro paint (antes de load() resolver) —
  // sem isso o Radix Select define o valor mas não acha o item para exibir
  // o texto, e o seletor fica em branco.
  const displayList = value && !list.includes(value) ? [...list, value] : list;

  const handleChange = async (cnpj) => {
    if (cnpj === value || switching) return;
    const previousValue = value;

    // Não confia somente no valor enviado pelo Select. O alvo precisa estar
    // entre os acessos que acabaram de ser carregados para o usuário.
    if (!displayList.includes(cnpj)) {
      toast({ title: "Acesso negado", description: "Este CNPJ não está autorizado para seu usuário.", variant: "destructive" });
      return;
    }

    setSwitching(true);
    setValue(cnpj);
    try {
      // A função do banco valida o acesso, preserva o CNPJ anterior na lista
      // e atualiza o perfil em uma única transação. Isso evita estado parcial
      // quando a RLS impede inserções diretas em user_cnpj_access.
      const { error } = await supabase.rpc('switch_active_cnpj', { p_cnpj: cnpj });
      if (error) throw error;

      await onChanged?.();
      window.location.reload();
    } catch (error) {
      console.error('Erro ao trocar CNPJ:', error);
      setValue(previousValue);
      setSwitching(false);
      toast({
        title: "Não foi possível trocar o CNPJ",
        description: error?.message?.includes('switch_active_cnpj')
          ? "A atualização de banco para troca de CNPJ ainda não foi aplicada."
          : (error?.message || "Verifique seu acesso e tente novamente."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={handleChange} disabled={switching || displayList.length < 2}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder={switching ? "Trocando..." : "Selecionar CNPJ"} />
        </SelectTrigger>
        <SelectContent>
          {displayList.map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <RequestCnpjDialog user={user} onSubmitted={load} />
    </div>
  );
}
