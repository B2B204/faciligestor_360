
import React, { useState } from "react";
import { User } from "@/entities/User";
import { Contract } from "@/entities/Contract";
import { Employee } from "@/entities/Employee";
import { FinancialEntry } from "@/entities/FinancialEntry";
import { IndirectCost } from "@/entities/IndirectCost";
import { Measurement } from "@/entities/Measurement";
import { Patrimony } from "@/entities/Patrimony";
import { Post } from "@/entities/Post";
import { BackupLog } from "@/entities/BackupLog";
import { Supply } from "@/entities/Supply";
import { AccountsReceivable } from "@/entities/AccountsReceivable";
import { Uniform } from "@/entities/Uniform";
import { UniformDelivery } from "@/entities/UniformDelivery";
import { Seguro } from "@/entities/Seguro";
import { Laudo } from "@/entities/Laudo";
import { Repactuacao } from "@/entities/Repactuacao";
import { Oficio } from "@/entities/Oficio";
import { Button } from "@/components/ui/button";
import { DownloadCloud, Loader2, FileDown } from "lucide-react";
import { UploadFile } from "@/integrations/Core";

export default function BackupManager({ user }) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const me = user || await User.me();
      const cnpj = me.cnpj;
      const [contracts, employees, finances, indirects, measurements, patrimonies, posts] = await Promise.all([
        Contract.filter({ cnpj }),
        Employee.filter({ cnpj }),
        FinancialEntry.filter({ cnpj }),
        IndirectCost.filter({ cnpj }),
        Measurement.filter({ cnpj }),
        Patrimony.filter({ cnpj }),
        Post.filter({ cnpj })
      ]);

      const payload = {
        meta: { cnpj, generated_at: new Date().toISOString(), generated_by: me.email },
        contracts, employees, finances, indirects, measurements, patrimonies, posts
      };

      const json = JSON.stringify(payload, null, 2);
      const file = new File([json], `backup_${cnpj}_${Date.now()}.json`, { type: "application/json" });

      const { file_url } = await UploadFile({ file });
      const generated_at = new Date();
      const expires_at = new Date(generated_at.getTime() + 24 * 60 * 60 * 1000);

      const log = await BackupLog.create({
        file_url, generated_by: me.email, cnpj,
        generated_at: generated_at.toISOString(),
        expires_at: expires_at.toISOString(),
        status: "ready"
      });
      setLastBackup({ ...log, file_url });

      // Download imediato
      const a = document.createElement("a");
      a.href = file_url;
      a.download = file.name;
      a.click();

    } finally {
      setIsBackingUp(false);
    }
  };

  // Helpers para Excel (HTML compatível)
  const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  const serializeValue = (val) => {
    if (val === null || val === undefined) return "";
    if (Array.isArray(val) || typeof val === "object") return escapeHtml(JSON.stringify(val));
    return escapeHtml(val);
  };

  const buildTableHtml = (rows) => {
    const allKeys = new Set();
    rows.forEach(r => Object.keys(r || {}).forEach(k => allKeys.add(k)));
    const headers = Array.from(allKeys);
    const thead = `<tr>${headers.map(h => `<th style="background:#eef;border:1px solid #ccc;padding:4px">${escapeHtml(h)}</th>`).join("")}</tr>`;
    const tbody = rows.map(r => `<tr>${headers.map(h => `<td style="border:1px solid #ddd;padding:4px">${serializeValue(r[h])}</td>`).join("")}</tr>`).join("");
    return `<table border="1" cellspacing="0" cellpadding="2">${thead}${tbody}</table>`;
  };

  const buildExcelHtmlWorkbook = (sheets) => {
    const xmlSheets = sheets.map(s => `
      <x:ExcelWorksheet>
        <x:Name>${escapeHtml(s.name)}</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet>
    `).join("");

    const bodies = sheets.map(s => `
      <div style="mso-element:worksheet; mso-name:'${escapeHtml(s.name)}'">
        ${s.tableHtml}
      </div>
    `).join("");

    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]><xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              ${xmlSheets}
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml><![endif]-->
        <style>table,td,th{font-family:Arial,Helvetica,sans-serif;font-size:10pt}</style>
      </head>
      <body>
        ${bodies}
      </body>
      </html>
    `;
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const me = user || await User.me();
      const cnpj = me.cnpj;

      // Coleta de dados por aba (respeita isolamento por CNPJ)
      const [
        contracts, employees, finances, indirects, measurements,
        patrimonies, supplies, receivables, uniforms, uniformDeliveries,
        seguros, laudos, repactuacoes, oficios, posts
      ] = await Promise.all([
        Contract.filter({ cnpj }),
        Employee.filter({ cnpj }),
        FinancialEntry.filter({ cnpj }),
        IndirectCost.filter({ cnpj }),
        Measurement.filter({ cnpj }),
        Patrimony.filter({ cnpj }),
        Supply.filter({ cnpj }),
        AccountsReceivable.filter({ cnpj }),
        Uniform.filter({ cnpj }),
        UniformDelivery.filter({ cnpj }),
        Seguro.filter({ cnpj }),
        Laudo.filter({ cnpj }),
        Repactuacao.filter({ cnpj }),
        Oficio.filter({ cnpj }),
        Post.filter({ cnpj }),
      ]);

      const sheets = [
        { name: "Contratos", rows: contracts },
        { name: "Funcionarios", rows: employees },
        { name: "Financeiro", rows: finances },
        { name: "Custos_Indiretos", rows: indirects },
        { name: "Medicoes", rows: measurements },
        { name: "Patrimonio", rows: patrimonies },
        { name: "Suprimentos", rows: supplies },
        { name: "Contas_Receber", rows: receivables },
        { name: "Uniformes", rows: uniforms },
        { name: "Entregas_Uniformes", rows: uniformDeliveries },
        { name: "Seguros", rows: seguros },
        { name: "Laudos", rows: laudos },
        { name: "Repactuacoes", rows: repactuacoes },
        { name: "Oficios", rows: oficios },
        { name: "Mural_Posts", rows: posts },
      ].map(s => ({ ...s, tableHtml: buildTableHtml(s.rows || []) }));

      const html = buildExcelHtmlWorkbook(sheets);
      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const fileName = `backup_excel_${cnpj}_${new Date().toISOString().slice(0,10)}.xls`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);

    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button onClick={handleBackup} className="bg-blue-600 hover:bg-blue-700" disabled={isBackingUp || !user?.cnpj}>
        {isBackingUp ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando backup...</> : <><DownloadCloud className="w-4 h-4 mr-2" />Baixar backup JSON</>}
      </Button>

      <Button onClick={handleExportExcel} variant="outline" disabled={isExportingExcel || !user?.cnpj}>
        {isExportingExcel ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando Excel...</> : <><FileDown className="w-4 h-4 mr-2" />Baixar Excel (todas as abas)</>}
      </Button>

      {lastBackup && (
        <a href={lastBackup.file_url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">
          Último backup: expira em {new Date(lastBackup.expires_at).toLocaleString()}
        </a>
      )}
    </div>
  );
}
