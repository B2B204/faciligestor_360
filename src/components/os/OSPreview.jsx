import React from "react";

export default function OSPreview({ os }) {
  const fmtMoney = (v)=> new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
  return (
    <div className="p-6 bg-white text-gray-900">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">Ordem de Serviço</h1>
        <p className="text-sm text-gray-600">{os?.os_number}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
        <div><strong>Contrato:</strong> {os?.contract_number || "-"}</div>
        <div><strong>Unidade:</strong> {os?.unit_name}</div>
        <div><strong>Tipo:</strong> {os?.service_type}</div>
        <div><strong>Prioridade:</strong> {os?.priority}</div>
        <div><strong>Abertura:</strong> {os?.opened_at}</div>
        <div><strong>Prazo:</strong> {os?.due_at || "-"}</div>
        <div><strong>Status:</strong> {os?.status}</div>
        <div><strong>Responsável:</strong> {os?.assignee_name || "-"}</div>
      </div>
      <div className="mb-3">
        <h3 className="font-semibold">Descrição</h3>
        <p className="whitespace-pre-wrap">{os?.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div><strong>Materiais:</strong> {fmtMoney(os?.total_material_cost)}</div>
        <div><strong>Horas:</strong> {os?.total_hours || 0}</div>
      </div>
      {(os?.check_in_at || os?.check_out_at) && (
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div><strong>Check-in:</strong> {os?.check_in_at ? new Date(os.check_in_at).toLocaleString('pt-BR') : "-"}</div>
          <div><strong>Check-out:</strong> {os?.check_out_at ? new Date(os.check_out_at).toLocaleString('pt-BR') : "-"}</div>
        </div>
      )}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="text-center">
          {os?.internal_signature_url && <img src={os.internal_signature_url} alt="Assinatura responsável" className="h-16 mx-auto mb-2" />}
          <div className="border-t pt-1">{os?.assignee_name || "Responsável pela execução"}</div>
        </div>
        <div className="text-center">
          {os?.customer_signature_url && <img src={os.customer_signature_url} alt="Assinatura cliente" className="h-16 mx-auto mb-2" />}
          <div className="border-t pt-1">{os?.signed_by_name || "Cliente/Gestor"}</div>
        </div>
      </div>
    </div>
  );
}