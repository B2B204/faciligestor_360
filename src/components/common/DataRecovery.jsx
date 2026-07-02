import React, { useEffect, useState } from "react";
import { Contract } from "@/entities/Contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Database, RotateCcw, AlertTriangle, Shield } from "lucide-react";

export default function DataRecovery({ user }) {
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [report, setReport] = useState({
    totalContracts: 0,
    myNoCnpj: [],
    mySoftDeleted: [],
  });

  const scan = async () => {
    setLoading(true);
    const all = await Contract.list();
    const myNoCnpj = all.filter(
      (c) => (!c.cnpj || c.cnpj === "") && c.created_by === user.email
    );
    const mySoftDeleted = all.filter(
      (c) => c.cnpj === user.cnpj && !!c.deleted_at
    );
    setReport({
      totalContracts: all.length,
      myNoCnpj,
      mySoftDeleted,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (user?.email && user?.cnpj) {
      scan();
    }
  }, [user?.email, user?.cnpj]);

  const assignCnpjToMyContracts = async () => {
    if (!window.confirm("Atribuir seu CNPJ aos contratos sem CNPJ criados por você?")) return;
    setAssigning(true);
    const items = report.myNoCnpj;
    await Promise.all(
      items.map((c) => Contract.update(c.id, { cnpj: user.cnpj, status: c.status || "ativo" }))
    );
    await scan();
    setAssigning(false);
    alert("CNPJ atribuído aos seus contratos sem CNPJ.");
  };

  const restoreSoftDeleted = async () => {
    if (!window.confirm("Restaurar todos os contratos do seu CNPJ que estão na lixeira?")) return;
    setRestoring(true);
    const items = report.mySoftDeleted;
    await Promise.all(
      items.map((c) => Contract.update(c.id, { deleted_at: null, deleted_by: null, status: "ativo" }))
    );
    await scan();
    setRestoring(false);
    alert("Contratos restaurados com sucesso.");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Verificando seus dados…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-gray-800">
            <Database className="w-5 h-5 mr-2 text-blue-600" />
            Diagnóstico de Contratos (somente seus dados)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>CNPJ atual:</strong> {user.cnpj || "-"}</p>
          <p><strong>Total de contratos (no projeto):</strong> {report.totalContracts}</p>
          <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
            <p className="text-blue-800">
              <strong>Contratos sem CNPJ criados por você:</strong> {report.myNoCnpj.length}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Esses contratos podem ter sido criados antes do isolamento por CNPJ. Atribua o seu CNPJ para que voltem a aparecer.
            </p>
            <Button
              onClick={assignCnpjToMyContracts}
              disabled={assigning || report.myNoCnpj.length === 0}
              className="mt-3 bg-blue-600 hover:bg-blue-700"
            >
              {assigning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Atribuindo…</> : "Atribuir meu CNPJ aos contratos sem CNPJ"}
            </Button>
          </div>

          <div className="p-3 bg-green-50 rounded-md border border-green-100 mt-2">
            <p className="text-green-800">
              <strong>Contratos do seu CNPJ na lixeira:</strong> {report.mySoftDeleted.length}
            </p>
            <p className="text-xs text-green-700 mt-1">
              Itens com exclusão suave (soft delete) podem ser restaurados.
            </p>
            <Button
              onClick={restoreSoftDeleted}
              disabled={restoring || report.mySoftDeleted.length === 0}
              className="mt-3 bg-green-600 hover:bg-green-700"
            >
              {restoring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Restaurando…</> : <><RotateCcw className="w-4 h-4 mr-2" />Restaurar contratos excluídos</>}
            </Button>
          </div>

          <div className="p-3 bg-yellow-50 rounded-md border border-yellow-100 mt-2">
            <p className="text-yellow-800 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Segurança
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Esta ferramenta só atua sobre: (1) contratos SEM CNPJ criados por você; (2) contratos do SEU CNPJ que estão com soft delete. Não altera dados de outras empresas.
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-md border border-gray-200 mt-2">
            <p className="text-gray-800 flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Dica
            </p>
            <p className="text-xs text-gray-700 mt-1">
              Caso ainda não encontre seus contratos, confirme se o CNPJ atual é o mesmo utilizado quando os contratos foram criados. Se necessário, contate o suporte para investigação avançada.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}