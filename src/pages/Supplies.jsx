
import React, { useState, useEffect } from "react";
import { Supply } from "@/entities/Supply";
import { Contract } from "@/entities/Contract";
import { User } from "@/entities/User";
import { InvokeLLM, SendEmail, UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Plus, Package, Download, Search, Trash2, FileText, Mail, Upload, Loader2, Pencil, Printer } from "lucide-react";
import { format } from "date-fns";
import { BRAND } from "@/components/common/Branding";

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [user, setUser] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // NOVOS filtros
  const [filterContract, setFilterContract] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterHasNF, setFilterHasNF] = useState("all"); // all | yes | no
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false); // Used for loading state across all receipt generation/download actions
  const [isDeleting, setIsDeleting] = useState(null); // Para loader do delete
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  // NOVOS estados para importação de NF (múltiplos arquivos)
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFiles, setImportFiles] = useState([]); // alterado de importFile -> importFiles (array)
  const [prefillData, setPrefillData] = useState(null);
  const [editingSupply, setEditingSupply] = useState(null); // NEW: track editing

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const [suppliesData, contractsData] = await Promise.all([
        Supply.filter({ cnpj: currentUser.cnpj }, "-created_date"),
        Contract.filter({ cnpj: currentUser.cnpj }),
      ]);
      setSupplies(suppliesData);
      setContracts(contractsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert(`Erro ao carregar a lista de compras: ${error?.message || error}\n\nSeus dados podem ter sido salvos mesmo assim — verifique diretamente no Supabase antes de tentar salvar novamente.`);
    }
  };

  // Helper: checa se NF (número e/ou chave) já existe em algum recibo do tenant (principal ou nf_imports)
  // Update duplicate helper to optionally exclude a given supply id
  const isNFMetaDuplicate = (nfNumber, accessKey, excludeId = null) => {
    // Only proceed if at least one identifier (number or access key) is provided
    if ((!nfNumber || nfNumber === "") && (!accessKey || accessKey === "")) return false;

    const hasDup = supplies.some((s) => {
      if (excludeId && s.id === excludeId) return false; // Exclude the current supply when editing
      const mainHit =
        (!!nfNumber && s.nf_number && s.nf_number === nfNumber) ||
        (!!accessKey && s.nf_access_key && s.nf_access_key === accessKey);

      // Check NFs within nf_imports array
      const importsHit = (s.nf_imports || []).some((nf) =>
        ((!!nfNumber && nf.nf_number === nfNumber) ||
         (!!accessKey && nf.nf_access_key === accessKey))
      );
      return mainHit || importsHit;
    });
    return hasDup;
  };

  const handleDelete = async (supplyId) => {
    if (window.confirm("Tem certeza que deseja excluir este recibo? Esta ação é irreversível.")) {
      setIsDeleting(supplyId);
      try {
        await Supply.delete(supplyId);
        loadData();
      } catch (error) {
        console.error("Erro ao excluir recibo:", error);
        alert("Falha ao excluir o recibo.");
      }
      setIsDeleting(null);
    }
  };

  const handleOpenEmailModal = (supply) => {
    setSelectedReceipt(supply);
    setEmailModalOpen(true);
  };

  // Profissional: constrói HTML A4 completo (sem LLM), pronto para impressão
  const buildReceiptA4HTML = (supply, autoPrint = false) => {
    const contract = contracts.find(c => c.id === supply.contract_id);
    const companyName = user?.company_name || BRAND.name;
    const companyCnpj = user?.cnpj || "";
    const companyAddress = user?.company_address || "";
    const companyPhone = user?.phone || "";
    const logoUrl = user?.company_logo_url || BRAND.logoUrl;

    const fmtDate = (d) => d ? format(new Date(d), "dd/MM/yyyy") : "N/A";
    const fmtMoney = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

    const hideValues = !!supply.hide_values_on_receipt;

    const itemsRows = (supply.items || []).map((it, idx) => {
      const q = it.quantity || 0;
      const up = it.unit_price || 0;
      const total = it.total_value != null ? it.total_value : (q * up);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${it.description || "-"}</td>
          <td>${q}</td>
          <td>${it.unit || "-"}</td>
          ${hideValues ? "" : `<td>${fmtMoney(up)}</td><td>${fmtMoney(total)}</td>`}
        </tr>
      `;
    }).join("");

    const nfPrimary = (supply.nf_number || supply.nf_access_key) ? `
      <div class="row"><span>Número:</span><strong>${supply.nf_number || "—"}</strong></div>
      <div class="row"><span>Série:</span><strong>${supply.nf_series || "—"}</strong></div>
      <div class="row"><span>Chave de Acesso:</span><strong>${supply.nf_access_key || "—"}</strong></div>
      <div class="row"><span>Emissão:</span><strong>${fmtDate(supply.nf_issue_date)}</strong></div>
    ` : "";

    const nfImports = (supply.nf_imports || []).length > 0 ? `
      <div class="subsection">
        <div class="subsection-title">Notas Fiscais Importadas</div>
        <div class="nf-list">
          ${(supply.nf_imports || []).map(nf => `
            <div class="nf-item">
              <div><span>Número:</span><strong>${nf.nf_number || "—"}</strong></div>
              <div><span>Série:</span><strong>${nf.nf_series || "—"}</strong></div>
              <div><span>Chave:</span><strong>${nf.nf_access_key || "—"}</strong></div>
              <div><span>Emissão:</span><strong>${fmtDate(nf.nf_issue_date)}</strong></div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : "";

    const totalAmount = fmtMoney(supply.total_amount || (supply.items || []).reduce((sum, it) => {
      const q = it.quantity || 0; const up = it.unit_price || 0; const t = it.total_value != null ? it.total_value : q * up;
      return sum + t;
    }, 0));

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Recibo de Entrega de Suprimentos - ${supply.receipt_id || ""}</title>
<style>
  @page { size: A4; margin: 20mm; }
  :root { --text:#111827; --muted:#6b7280; --line:#e5e7eb; --brand:#2563eb; }
  html, body { margin:0; padding:0; color:var(--text); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; }
  .page { max-width:21cm; margin:0 auto; background:white; box-shadow:0 0 12px rgba(0,0,0,.08); }
  .wrap { padding:20mm; }
  .letterhead { display:flex; align-items:center; gap:16px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  .logo { width:72px; height:72px; display:flex; align-items:center; justify-content:center; }
  .logo img { max-width:100%; max-height:72px; object-fit:contain; }
  .company { flex:1; }
  .company h1 { font-size:18px; margin:0; line-height:1.2; }
  .company p { margin:2px 0 0; color:var(--muted); font-size:12px; }
  .title { text-align:center; margin:18px 0 6px; font-size:18px; font-weight:700; color:#111827; }
  .subtitle { text-align:center; color:var(--muted); font-size:12px; margin-bottom:18px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .card { border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .card h3 { margin:0; padding:10px 12px; background:#f3f4f6; border-bottom:1px solid var(--line); font-size:13px; }
  .card .content { padding:12px; font-size:13px; }
  .row { display:flex; justify-content:space-between; gap:12px; padding:6px 0; border-bottom:1px dashed var(--line); }
  .row:last-child { border-bottom:none; }
  .row span { color:var(--muted); }
  .subsection { margin-top:8px; }
  .subsection-title { font-weight:600; margin-bottom:6px; color:#111827; }
  .nf-list { display:grid; gap:8px; }
  .nf-item { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; font-size:12px; }
  table { width:100%; border-collapse:collapse; margin-top:10px; }
  th, td { border:1px solid var(--line); padding:8px; font-size:12px; }
  th { background:#f3f4f6; text-align:left; }
  tfoot td { font-weight:700; }
  .obs { border:1px solid var(--line); border-radius:10px; padding:12px; margin-top:12px; font-size:13px; color:#374151; background:#fafafa; }
  .signs { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:24px; }
  .sign { text-align:center; margin-top:28px; }
  .sign .line { border-top:1px solid #111827; margin-top:40px; padding-top:6px; font-size:12px; }
  .footer { margin-top:18px; font-size:11px; color:var(--muted); text-align:center; }
  @media print { .page { box-shadow:none; } body { background:white; } }
</style>
</head>
<body>
  <div class="page">
    <div class="wrap">
      <div class="letterhead">
        <div class="logo">${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : ""}</div>
        <div class="company">
          <h1>${companyName}</h1>
          <p>${companyAddress || ""}</p>
          <p>${companyCnpj ? `CNPJ: ${companyCnpj}` : ""} ${companyPhone ? ` • Tel: ${companyPhone}` : ""}</p>
        </div>
      </div>

      <div class="title">RECIBO DE ENTREGA DE SUPRIMENTOS ${supply.receipt_id ? `Nº ${supply.receipt_id}` : ""}</div>
      <div class="subtitle">Documento de comprovação de entrega de materiais</div>

      <div class="grid2">
        <div class="card">
          <h3>Dados do Contrato</h3>
          <div class="content">
            <div class="row"><span>Nº do Contrato:</span><strong>${contract?.contract_number || "—"}</strong></div>
            <div class="row"><span>Nome do Contrato:</span><strong>${contract?.name || "—"}</strong></div>
            <div class="row"><span>Cliente:</span><strong>${contract?.client_name || "—"}</strong></div>
            <div class="row"><span>CNPJ do Cliente:</span><strong>${contract?.client_cnpj || "—"}</strong></div>
            <div class="row"><span>Unidade:</span><strong>${contract?.unidade || "—"}</strong></div>
          </div>
        </div>

        <div class="card">
          <h3>Dados da Entrega</h3>
          <div class="content">
            <div class="row"><span>Órgão/Cliente:</span><strong>${supply.organization || "—"}</strong></div>
            <div class="row"><span>Data da Entrega:</span><strong>${fmtDate(supply.delivery_date)}</strong></div>
            <div class="row"><span>Recebedor:</span><strong>${supply.recipient_name || "—"}</strong></div>
          </div>
        </div>
      </div>

      ${(nfPrimary || nfImports) ? `
      <div class="card" style="margin-top:12px;">
        <h3>Dados da Nota Fiscal</h3>
        <div class="content">
          ${nfPrimary}
          ${nfImports}
        </div>
      </div>` : ""}

      <div class="card" style="margin-top:12px;">
        <h3>Itens Entregues</h3>
        <div class="content">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Descrição</th>
                <th>Qtd</th>
                <th>Unid</th>
                ${hideValues ? "" : `<th>Vlr Unit.</th><th>Total</th>`}
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
            ${hideValues ? "" : `
            <tfoot>
              <tr>
                <td colspan="5" style="text-align:right;">Valor Total</td>
                <td>${totalAmount}</td>
              </tr>
            </tfoot>`}
          </table>
        </div>
      </div>

      ${supply.observations ? `<div class="obs"><strong>Observações:</strong><br/>${(supply.observations || "").replace(/\n/g, "<br/>")}</div>` : ""}

      <div class="signs">
        <div class="sign">
          <div class="line">Assinatura do Entregador</div>
        </div>
        <div class="sign">
          <div class="line">Assinatura do Recebedor</div>
        </div>
      </div>

      <div class="footer">
        Gerado por ${companyName} em ${fmtDate(new Date())} • Documento nº ${supply.receipt_id || "—"}
      </div>
    </div>
  </div>
  ${autoPrint ? `<script>window.addEventListener('load',()=>{try{window.focus();window.print();}catch(e){}});</script>` : ""}
</body>
</html>
`;
    return html;
  };

  const downloadReceiptHTMLA4 = async (supply) => {
    setIsGeneratingPDF(true);
    try {
      const html = buildReceiptA4HTML(supply, false);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = supply.delivery_date ? format(new Date(supply.delivery_date), "yyyy-MM-dd") : "data";
      link.href = url;
      link.download = `recibo_${supply.receipt_id || "entrega"}_${dateStr}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar recibo HTML A4:", error);
      alert("Erro ao gerar o recibo HTML A4.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const printReceiptA4 = async (supply) => {
    setIsGeneratingPDF(true);
    try {
      const html = buildReceiptA4HTML(supply, true);
      const w = window.open("", "_blank");
      if (!w) {
        alert("Permita pop-ups para imprimir o recibo.");
        setIsGeneratingPDF(false);
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (error) {
      console.error("Erro ao preparar impressão do recibo:", error);
      alert("Erro ao preparar o recibo para impressão.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };


  // Ensure receipt uses company data (not current operator) in footer
  const generateReceiptHTML = async (supply) => {
    const contract = contracts.find(c => c.id === supply.contract_id);

    const receiptData = {
      // Company data from user profile
      company_name: user?.company_name || BRAND.name,
      company_cnpj: user?.cnpj || '',
      company_address: user?.company_address || '',
      company_phone: user?.phone || '',
      company_logo_url: user?.company_logo_url || BRAND.logoUrl,

      // Receipt data
      receipt_id: supply.receipt_id,
      organization: supply.organization,
      contract_name: contract?.name || 'N/A',
      contract_number: contract?.contract_number || 'N/A',
      client_name: contract?.client_name || 'N/A',
      client_cnpj: contract?.client_cnpj || 'N/A',
      unidade: contract?.unidade || 'N/A',
      delivery_date: format(new Date(supply.delivery_date), 'dd/MM/yyyy'),
      items: supply.items,
      recipient_name: supply.recipient_name || 'Não informado',
      observations: supply.observations || 'Nenhuma observação.',
      total_amount: supply.total_amount || 0,

      // IMPORTANT: generated_by must be company, not current user
      generated_by: user?.company_name || BRAND.name,
      generated_at: format(new Date(), 'dd/MM/yyyy HH:mm:ss'),

      // NF Data (primary NF, if any)
      // Note: If multiple NFs are imported, these fields might be empty or represent the first NF.
      // The `nf_imports` array on `supply` contains details of all imported NFs.
      nf_number: supply.nf_number || 'N/A',
      nf_series: supply.nf_series || 'N/A',
      nf_access_key: supply.nf_access_key || 'N/A',
      nf_issue_date: supply.nf_issue_date ? format(new Date(supply.nf_issue_date), 'dd/MM/yyyy') : 'N/A',
      // Pass the entire nf_imports array if available, for potential future use in the template
      nf_imports: supply.nf_imports || [],
      hide_values_on_receipt: !!supply.hide_values_on_receipt
    };

    const response = await InvokeLLM({
      prompt: `Gere um recibo de entrega de materiais profissional e bem formatado em HTML.
      IMPORTANTE: Se "hide_values_on_receipt" for true, NÃO exiba valores monetários (valor unitário, total por item ou valor total). Mostre apenas descrição, quantidade e unidade.

      DADOS DA EMPRESA (CABEÇALHO):
      - Nome: ${receiptData.company_name}
      - CNPJ: ${receiptData.company_cnpj}
      - Endereço: ${receiptData.company_address}
      - Telefone: ${receiptData.company_phone}
      - Logo: ${receiptData.company_logo_url}

      DADOS DO RECIBO:
      ${JSON.stringify(receiptData)}

      ESTRUTURA OBRIGATÓRIA:
      1. **CABEÇALHO DA EMPRESA:** Logo (se disponível), Nome da Empresa, CNPJ, Endereço e Telefone
      2. **Título Principal:** "RECIBO DE ENTREGA DE SUPRIMENTOS Nº ${receiptData.receipt_id}"
      3. **Dados do Contrato:** Nº do Contrato, Nome do Contrato, Cliente, CNPJ do Cliente e Unidade
      4. **Dados da Entrega:** Data da Entrega, Órgão/Cliente e Nome do Recebedor
      ${receiptData.nf_number !== 'N/A' || receiptData.nf_imports.length > 0 ? `5. **Dados da Nota Fiscal:**` : ''}
      ${receiptData.nf_number !== 'N/A' ? `  - Número: ${receiptData.nf_number}, Série: ${receiptData.nf_series}, Chave de Acesso: ${receiptData.nf_access_key}, Data de Emissão: ${receiptData.nf_issue_date}.` : ''}
      ${receiptData.nf_imports.length > 0 ? `  - NFs Importadas: ${receiptData.nf_imports.map(nf => `NF ${nf.nf_number} (Série: ${nf.nf_series}, Emissão: ${nf.nf_issue_date ? format(new Date(nf.nf_issue_date), 'dd/MM/yyyy') : 'N/A'})`).join('; ')}.` : ''}
      ${receiptData.nf_number !== 'N/A' || receiptData.nf_imports.length > 0 ? `6.` : `5.`} **Tabela de Itens:** Colunas: Descrição, Quantidade, Unidade, Valor Unitário, Valor Total
      ${receiptData.nf_number !== 'N/A' || receiptData.nf_imports.length > 0 ? `7.` : `6.`} **Valor Total:** Em destaque no final da tabela
      ${receiptData.nf_number !== 'N/A' || receiptData.nf_imports.length > 0 ? `8.` : `7.`} **Observações:** Seção para as observações do lançamento
      ${receiptData.nf_number !== 'N/A' || receiptData.nf_imports.length > 0 ? `9.` : `8.`} **Assinaturas:** Linhas para assinatura do Entregador e do Recebedor
      ${receiptData.nf_number !== 'N/A' || receiptData.nf_imports.length > 0 ? `10.` : `9.`} **Rodapé:** "Gerado por ${receiptData.generated_by} em ${receiptData.generated_at}"

      Requisitos de Estilo:
      - Use CSS inline para máxima compatibilidade
      - Fonte dos Títulos: 'Montserrat', sans-serif, peso 600
      - Fonte do Corpo: 'Roboto', sans-serif, peso 400
      - Cores: Use tons de azul (#2563eb) e cinza (#4b5563) para visual corporativo
      `,
      response_json_schema: {
        type: "object",
        properties: { html_content: { type: "string" } }
      }
    });

    return response.html_content;
  };

  const handleSendEmail = async () => {
    if (!selectedReceipt || !user?.email) {
      alert("Usuário não encontrado ou recibo não selecionado. Não é possível enviar o e-mail.");
      return;
    }

    try {
      const htmlContent = await generateReceiptHTML(selectedReceipt); // Função auxiliar para gerar HTML
      await SendEmail({
        to: user.email, // Envia para o e-mail do usuário logado
        from_name: `Recibos - ${user?.company_name || BRAND.name}`,
        subject: `Recibo de Compra Nº ${selectedReceipt.receipt_id}`,
        body: htmlContent
      });

      alert("Recibo enviado para o seu e-mail com sucesso! Você pode encaminhá-lo para o seu cliente.");
      setEmailModalOpen(false);
      setSelectedReceipt(null);
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      alert("Falha ao enviar o e-mail. Verifique se você está logado corretamente.");
    }
  };

  const SupplyForm = ({ prefill, editingSupply }) => {
    const [deliveryData, setDeliveryData] = useState({
      organization: "",
      contract_id: "",
      delivery_date: "",
      recipient_name: "",
      observations: "",
      // Metadados de NF
      nf_number: "",
      nf_series: "",
      nf_access_key: "",
      nf_issue_date: "",
      // NOVO: ocultar valores
      hide_values_on_receipt: false
    });
    const [currentItem, setCurrentItem] = useState({
      description: "",
      quantity: 1,
      unit: "unid",
      unit_price: 0,
      total_value: 0
    });
    const [items, setItems] = useState([]);
    const [importedNFs, setImportedNFs] = React.useState([]); // lista de NFs importadas

    // Prefill from import or when editing an existing supply
    React.useEffect(() => {
      if (editingSupply) {
        setDeliveryData({
          organization: editingSupply.organization || "",
          contract_id: editingSupply.contract_id || "",
          delivery_date: editingSupply.delivery_date || "",
          recipient_name: editingSupply.recipient_name || "",
          observations: editingSupply.observations || "",
          nf_number: editingSupply.nf_number || "",
          nf_series: editingSupply.nf_series || "",
          nf_access_key: editingSupply.nf_access_key || "",
          nf_issue_date: editingSupply.nf_issue_date || "",
          hide_values_on_receipt: !!editingSupply.hide_values_on_receipt
        });
        setItems(editingSupply.items || []);
        setImportedNFs(editingSupply.nf_imports || []);
        return;
      }
      if (prefill) {
        setItems(prefill.items || []);
        setImportedNFs(prefill.nf_imports || []);
        if (prefill.nf_number || (prefill.nf_imports && prefill.nf_imports.length === 1)) {
          const mainNf = prefill.nf_imports && prefill.nf_imports.length === 1 ? prefill.nf_imports[0] : prefill;
          setDeliveryData((prev) => ({
            ...prev,
            nf_number: mainNf.nf_number || "",
            nf_series: mainNf.nf_series || "",
            nf_access_key: mainNf.nf_access_key || "",
            nf_issue_date: mainNf.nf_issue_date || ""
          }));
        }
      }
    }, [prefill, editingSupply]);

    const handleDeliveryChange = (e) => {
      const { name, value } = e.target;
      setDeliveryData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (e) => {
      const { name, value } = e.target;
      const updatedItem = {
        ...currentItem,
        [name]: name === 'quantity' || name === 'unit_price' ? Number(value) || 0 : value
      };

      // Calcular valor total automaticamente
      updatedItem.total_value = updatedItem.quantity * updatedItem.unit_price;

      setCurrentItem(updatedItem);
    };

    const handleAddItem = () => {
      if (currentItem.description && currentItem.quantity > 0) {
        setItems([...items, currentItem]);
        setCurrentItem({
          description: "",
          quantity: 1,
          unit: "unid",
          unit_price: 0,
          total_value: 0
        });
      } else {
        alert("Preencha a descrição e quantidade do item para adicionar.");
      }
    };

    // Editar item inline
    const handleItemFieldChange = (index, field, value) => {
      setItems((prev) => {
        const next = [...prev];
        const newVal = (field === 'quantity' || field === 'unit_price') ? (Number(value) || 0) : value;
        next[index] = { ...next[index], [field]: newVal };
        if (field === 'quantity' || field === 'unit_price') {
          const q = field === 'quantity' ? newVal : (next[index].quantity || 0);
          const up = field === 'unit_price' ? newVal : (next[index].unit_price || 0);
          next[index].total_value = (q || 0) * (up || 0);
        }
        return next;
      });
    };

    const calculateTotalAmount = () => {
      return items.reduce((sum, item) => sum + (item.total_value || 0), 0);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (items.length === 0) {
        alert("Adicione pelo menos um item à compra/recibo.");
        return;
      }

      // Validação de duplicidade NF antes de salvar
      const duplicates = [];
      const excludeId = editingSupply?.id || null;

      // Check for main NF fields
      if ((deliveryData.nf_number && deliveryData.nf_number !== "") || (deliveryData.nf_access_key && deliveryData.nf_access_key !== "")) {
        if (isNFMetaDuplicate(deliveryData.nf_number, deliveryData.nf_access_key, excludeId)) {
          duplicates.push({
            nf_number: deliveryData.nf_number || 'N/A',
            nf_access_key: deliveryData.nf_access_key || 'N/A'
          });
        }
      }
      // Check for NFs in importedNFs array
      (importedNFs || []).forEach((nf) => {
        if (((nf.nf_number && nf.nf_number !== "") || (nf.nf_access_key && nf.nf_access_key !== "")) && isNFMetaDuplicate(nf.nf_number, nf.nf_access_key, excludeId)) {
          duplicates.push({
            nf_number: nf.nf_number || 'N/A',
            nf_access_key: nf.nf_access_key || 'N/A'
          });
        }
      });

      if (duplicates.length > 0) {
        const list = duplicates.map(d => `• NF: ${d.nf_number} | Chave: ${d.nf_access_key}`).join('\n');
        alert(`Não é possível salvar: foram encontradas NFs já registradas no sistema:\n\n${list}\n\nRemova/ajuste as NFs duplicadas e tente novamente.`);
        return;
      }

      try {
        const totalAmount = calculateTotalAmount();

        // Convert empty strings to null — Postgres DATE rejects "" and a "" contract_id
        // violates the foreign key to contracts when nenhum contrato é selecionado
        const sanitizedDelivery = {
          ...deliveryData,
          delivery_date:  deliveryData.delivery_date  || null,
          nf_issue_date:  deliveryData.nf_issue_date  || null,
          contract_id:    deliveryData.contract_id    || null,
        };

        const baseData = {
          ...sanitizedDelivery,
          items,
          total_amount: totalAmount,
          ...(importedNFs && importedNFs.length > 0 ? { nf_imports: importedNFs } : {})
        };

        if (editingSupply) {
          // Update existing receipt (keep same receipt_id and cnpj)
          await Supply.update(editingSupply.id, baseData);
          loadData();
          setIsFormOpen(false);
          setPrefillData(null);
          setEditingSupply(null);
          alert("Recibo atualizado com sucesso!");
          return;
        }

        // Create new receipt
        const receiptId = `REC-${Date.now()}`;
        const fullSupplyData = {
          ...baseData,
          cnpj: user.cnpj,
          receipt_id: receiptId
        };

        await Supply.create(fullSupplyData);

        // Reset form and close dialog BEFORE generating PDF,
        // so a PDF failure never masks a successful save.
        loadData();
        setIsFormOpen(false);
        setPrefillData(null);
        setEditingSupply(null);
        setDeliveryData({
          organization: "",
          contract_id: "",
          delivery_date: "",
          recipient_name: "",
          observations: "",
          nf_number: "",
          nf_series: "",
          nf_access_key: "",
          nf_issue_date: "",
          hide_values_on_receipt: false
        });
        setItems([]);
        setImportedNFs([]);
        setCurrentItem({
          description: "",
          quantity: 1,
          unit: "unid",
          unit_price: 0,
          total_value: 0
        });

        // Generate and download receipt separately — errors here won't
        // show the misleading "Erro ao registrar/atualizar compra" message.
        try {
          await generateReceiptPDF({ ...fullSupplyData, created_by: user.full_name });
          alert("Recibo de compra registrado e gerado!");
        } catch (pdfError) {
          console.error("Erro ao gerar PDF do recibo:", pdfError);
          alert("Compra registrada com sucesso! Porém houve um erro ao gerar o arquivo do recibo. Você pode baixá-lo pela listagem.");
        }
      } catch (error) {
        console.error("Erro ao salvar supply:", error);
        const msg = error?.message || error?.details || JSON.stringify(error);
        if (msg.includes('null value in column "id"')) {
          // Coluna id sem DEFAULT gen_random_uuid() no banco
          alert(`Erro de banco de dados: a coluna "id" da tabela supplies está sem valor padrão.\n\nExecute o SQL abaixo no Supabase (SQL Editor):\n\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\nALTER TABLE supplies ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
        } else if (msg.includes('supplies_contract_id_fkey')) {
          // Contrato selecionado não existe mais (ou foi excluído) na tabela contracts
          alert('Erro ao salvar: o contrato selecionado não foi encontrado (pode ter sido excluído). Selecione outro contrato ou deixe o campo "Contrato Vinculado" em branco e tente novamente.');
        } else if (msg.includes('does not exist') && msg.includes('column')) {
          // Coluna referenciada pelo formulário ainda não existe na tabela
          alert(`Erro de banco de dados: ${msg}\n\nExecute o SQL abaixo no Supabase (SQL Editor):\n\nALTER TABLE supplies\n  ADD COLUMN IF NOT EXISTS hide_values_on_receipt BOOLEAN DEFAULT false,\n  ADD COLUMN IF NOT EXISTS nf_imports JSONB DEFAULT '[]',\n  ADD COLUMN IF NOT EXISTS nf_number TEXT DEFAULT '',\n  ADD COLUMN IF NOT EXISTS nf_series TEXT DEFAULT '',\n  ADD COLUMN IF NOT EXISTS nf_access_key TEXT DEFAULT '',\n  ADD COLUMN IF NOT EXISTS nf_issue_date DATE,\n  ADD COLUMN IF NOT EXISTS receipt_id TEXT DEFAULT '';`);
        } else if (!user) {
          alert("Usuário não carregado. Aguarde a página carregar completamente e tente novamente.");
        } else {
          alert(`Erro ao salvar: ${msg}`);
        }
      }
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados da Compra / Recibo */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-3">🧾 Dados do Recibo de Compra</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="organization">Órgão ou Cliente *</Label>
              <Input
                id="organization"
                name="organization"
                value={deliveryData.organization}
                onChange={handleDeliveryChange}
                required
                placeholder="Ex: Secretaria de Saúde"
              />
            </div>
            <div>
              <Label>Contrato Vinculado</Label>
              <Select
                value={deliveryData.contract_id}
                onValueChange={(v) => setDeliveryData(prev => ({ ...prev, contract_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="delivery_date">Data *</Label>
              <Input
                type="date"
                id="delivery_date"
                name="delivery_date"
                value={deliveryData.delivery_date}
                onChange={handleDeliveryChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="recipient_name">Recebedor</Label>
              <Input
                id="recipient_name"
                name="recipient_name"
                value={deliveryData.recipient_name}
                onChange={handleDeliveryChange}
                placeholder="Nome de quem recebeu (opcional)"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="hide_values_on_receipt"
              type="checkbox"
              checked={deliveryData.hide_values_on_receipt}
              onChange={(e) => setDeliveryData(prev => ({ ...prev, hide_values_on_receipt: e.target.checked }))}
              className="w-4 h-4"
            />
            <Label htmlFor="hide_values_on_receipt">Ocultar valores (preço e total) no recibo</Label>
          </div>
        </div>

        {/* Metadados da Nota Fiscal (Primary/Manual Entry) */}
        <div className="bg-amber-50 p-4 rounded-lg">
          <h3 className="font-semibold text-amber-900 mb-3">📄 Dados da Nota Fiscal (opcional, para NF principal)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="nf_number">Número da NF</Label>
              <Input id="nf_number" name="nf_number" value={deliveryData.nf_number} onChange={handleDeliveryChange} placeholder="Ex: 12345" />
            </div>
            <div>
              <Label htmlFor="nf_series">Série</Label>
              <Input id="nf_series" name="nf_series" value={deliveryData.nf_series} onChange={handleDeliveryChange} placeholder="Ex: 1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="nf_access_key">Chave de Acesso</Label>
              <Input id="nf_access_key" name="nf_access_key" value={deliveryData.nf_access_key} onChange={handleDeliveryChange} placeholder="44 dígitos" />
            </div>
            <div>
              <Label htmlFor="nf_issue_date">Data de Emissão</Label>
              <Input type="date" id="nf_issue_date" name="nf_issue_date" value={deliveryData.nf_issue_date} onChange={handleDeliveryChange} />
            </div>
          </div>
        </div>

        {/* Painel de NFs importadas (se múltiplas) */}
        {importedNFs && importedNFs.length > 0 && (
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h3 className="font-semibold text-indigo-900 mb-2">📄 Notas Fiscais importadas ({importedNFs.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {importedNFs.map((nf, idx) => (
                <div key={idx} className="bg-card border border-border rounded p-3 text-sm">
                  <div className="flex flex-wrap gap-3">
                    <div><span className="text-muted-foreground">NF:</span> <strong>{nf.nf_number || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Série:</span> <strong>{nf.nf_series || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Emissão:</span> <strong>{nf.nf_issue_date ? format(new Date(nf.nf_issue_date), 'dd/MM/yyyy') : '—'}</strong></div>
                  </div>
                  {nf.nf_access_key && (
                    <div className="mt-1 text-xs text-muted-foreground break-all">Chave: {nf.nf_access_key}</div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Obs: Os metadados acima serão salvos no campo "nf_imports" do recibo.</p>
          </div>
        )}

        {/* Itens do Recibo - agora com edição inline */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-900 mb-3">📋 Itens do Recibo</h3>
          <div className="space-y-2">
            {items.length === 0 && <p className="text-muted-foreground text-sm">Nenhum item adicionado ainda.</p>}
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-card p-3 rounded border border-border items-end">
                <div className="md:col-span-4">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={item.description || ""}
                    onChange={(e) => handleItemFieldChange(index, 'description', e.target.value)}
                    placeholder="Descrição do item"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number"
                    value={item.quantity || 0}
                    onChange={(e) => handleItemFieldChange(index, 'quantity', e.target.value)}
                    min="0"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Unidade</Label>
                  <Input
                    value={item.unit || "unid"}
                    onChange={(e) => handleItemFieldChange(index, 'unit', e.target.value)}
                    placeholder="unid, kg, cx..."
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Valor Unit. (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    id="item_unit_price"
                    name="unit_price"
                    value={item.unit_price}
                    onChange={(e) => handleItemFieldChange(index, 'unit_price', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-semibold text-green-700">{formatCurrency(item.total_value || 0)}</div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => {
                    setItems(items.filter((_, i) => i !== index));
                  }} className="ml-2">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 items-end gap-2 mt-4 pt-4 border-t border-border">
            <div className="md:col-span-2">
              <Label htmlFor="item_description">Descrição do Item *</Label>
              <Input
                id="item_description"
                name="description"
                value={currentItem.description}
                onChange={handleItemChange}
                placeholder="Ex: Canetas esferográficas azuis"
              />
            </div>
            <div>
              <Label htmlFor="item_quantity">Qtd *</Label>
              <Input
                type="number"
                id="item_quantity"
                name="quantity"
                value={currentItem.quantity}
                onChange={handleItemChange}
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="item_unit">Unidade</Label>
              <Input
                id="item_unit"
                name="unit"
                value={currentItem.unit}
                onChange={handleItemChange}
                placeholder="Ex: unid, kg"
              />
            </div>
            <div>
              <Label htmlFor="item_unit_price">Valor Unit. (R$)</Label>
              <Input
                type="number"
                step="0.01"
                id="item_unit_price"
                name="unit_price"
                value={currentItem.unit_price}
                onChange={handleItemChange}
              />
            </div>
            <div>
              <Label>Valor Total</Label>
              <div className="p-2 bg-muted border border-border rounded text-center font-semibold text-green-600">
                {formatCurrency(currentItem.total_value)}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
            <Button type="button" onClick={handleAddItem} className="w-auto">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Item
            </Button>
            {items.length > 0 && (
              <div className="text-lg font-bold text-green-700">
                Total do Recibo: {formatCurrency(calculateTotalAmount())}
              </div>
            )}
          </div>
        </div>

        {/* Observações */}
        <div>
          <Label htmlFor="observations">Observações</Label>
          <Textarea
            id="observations"
            name="observations"
            value={deliveryData.observations}
            onChange={handleDeliveryChange}
            rows={2}
            placeholder="Informações adicionais sobre a entrega..."
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Salvar e Gerar Recibo</Button>
        </div>
      </form>
    );
  };

  const generateReceiptPDF = async (supply) => {
    setIsGeneratingPDF(true);
    try {
      // Use the new buildReceiptA4HTML function for PDF generation/download
      const htmlContent = buildReceiptA4HTML(supply, false);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Guard: use today as fallback when delivery_date is empty/invalid
      let dateSuffix = format(new Date(), 'yyyy-MM-dd');
      if (supply.delivery_date) {
        const d = new Date(supply.delivery_date);
        if (!isNaN(d.getTime())) {
          dateSuffix = format(d, 'yyyy-MM-dd');
        }
      }
      link.download = `recibo_${supply.receipt_id}_${dateSuffix}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Erro ao gerar recibo:", error);
      alert("Erro ao gerar o arquivo do recibo.");
    }
    setIsGeneratingPDF(false);
  };

  // Filtro dos registros
  const filteredSupplies = supplies.filter(supply => {
    const text = searchTerm.toLowerCase();
    const textMatch =
      supply.organization?.toLowerCase().includes(text) ||
      (supply.items || []).some(item => item.description?.toLowerCase().includes(text));

    const contractMatch = filterContract === "all" || supply.contract_id === filterContract;

    const date = supply.delivery_date ? new Date(supply.delivery_date + 'T00:00:00') : null; // Add T00:00:00 to avoid timezone issues
    const fromOk = !filterFrom || (date && date >= new Date(filterFrom + 'T00:00:00'));
    const toOk = !filterTo || (date && date <= new Date(filterTo + 'T23:59:59')); // End of day

    const hasNF = !!(supply.nf_number || supply.nf_access_key || ((supply.nf_imports || []).length > 0));
    const nfMatch = filterHasNF === "all" || (filterHasNF === "yes" ? hasNF : !hasNF);

    return textMatch && contractMatch && fromOk && toOk && nfMatch;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> Gestão de Compras e Recibos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Padronize seus recibos, importe Notas Fiscais e vincule ao contrato.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) {
              setPrefillData(null); // Reset prefill data
              setEditingSupply(null); // Reset editing state
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-5 h-5 mr-2" />
                Nova Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSupply ? "Editar Recibo de Compra" : "Registrar Nova Compra"}</DialogTitle>
              </DialogHeader>
              <SupplyForm prefill={prefillData} editingSupply={editingSupply} />
            </DialogContent>
          </Dialog>

          {/* Diálogo Importar NF (atualizado para múltiplos arquivos) */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-5 h-5 mr-2" />
                Importar Nota Fiscal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Importar Itens de Nota Fiscal (CSV, PDF ou Imagem)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".csv,application/pdf,.pdf,image/jpeg,.jpg,image/png,.png"
                  multiple
                  onChange={(e) => setImportFiles(Array.from(e.target.files || []))}
                />
                <p className="text-sm text-muted-foreground">
                  Selecione um ou mais arquivos. Suporte a: CSV, PDF e imagens (JPG/PNG). XML (NF-e) não é suportado nesta importação.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportFiles([]); }}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!importFiles || importFiles.length === 0) { alert("Selecione ao menos um arquivo (CSV, PDF, JPG ou PNG)."); return; }
                      setImporting(true);
                      try {
                        const allowedExts = ["csv", "pdf", "jpg", "jpeg", "png"];
                        const metas = []; // To store metadata for each imported NF
                        let aggregatedItems = []; // To store items from all imported NFs
                        const skipped = []; // NFs puladas por duplicidade

                        for (const f of importFiles) {
                          const fname = (f.name || "").toLowerCase();
                          const ext = fname.includes(".") ? fname.split(".").pop() : "";
                          if (!allowedExts.includes(ext)) {
                            alert(`Arquivo "${f.name}" não suportado. Use CSV, PDF, JPG ou PNG. XML não é suportado.`);
                            continue; // Skip this file and try the next one
                          }

                          const { file_url } = await UploadFile({ file: f });
                          const schema = {
                            type: "object",
                            properties: {
                              nf_number: { type: "string" },
                              nf_series: { type: "string" },
                              nf_access_key: { type: "string" },
                              nf_issue_date: { type: "string", format: "date" },
                              items: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    description: { type: "string" },
                                    quantity: { type: "number" },
                                    unit: { type: "string" },
                                    unit_price: { type: "number" },
                                    total_value: { type: "number" }
                                  }
                                }
                              }
                            }
                          };
                          const res = await ExtractDataFromUploadedFile({ file_url, json_schema: schema });
                          if (res.status !== "success" || !res.output) {
                            console.warn("Falha ao extrair dados de", f.name, res.details);
                            continue; // Skip this file and try the next one
                          }

                          const out = res.output;
                          let nf_data_from_file = {};
                          if (Array.isArray(out)) {
                            // If the output is just an array of items (e.g., from CSV without header NF info)
                            nf_data_from_file.items = out.map(it => ({
                              description: it.description || it.nome || "",
                              quantity: Number(it.quantity || it.qtd || 0),
                              unit: it.unit || it.un || "unid",
                              unit_price: Number(it.unit_price || it.valor_unit || 0),
                              total_value: Number(it.total_value || (Number(it.quantity || 0) * Number(it.unit_price || 0)) || 0)
                            }));
                          } else {
                            // If the output is an object with NF details and items
                            nf_data_from_file = {
                              nf_number: out.nf_number || out.numero || "",
                              nf_series: out.nf_series || out.serie || "",
                              nf_access_key: out.nf_access_key || out.chave || out.chave_acesso || "",
                              nf_issue_date: out.nf_issue_date || out.data_emissao || "",
                              items: (out.items || []).map(it => ({
                                description: it.description || it.nome || "",
                                quantity: Number(it.quantity || it.qtd || 0),
                                unit: it.unit || it.un || "unid",
                                unit_price: Number(it.unit_price || it.valor_unit || 0),
                                total_value: Number(it.total_value || (Number(it.quantity || 0) * Number(it.unit_price || 0)) || 0)
                              }))
                            };
                          }

                          // Verificar duplicidade ANTES de agregar (usa número e/ou chave, quando houver)
                          const dup = isNFMetaDuplicate(nf_data_from_file.nf_number, nf_data_from_file.nf_access_key);
                          if (dup) {
                            skipped.push({
                              nf_number: nf_data_from_file.nf_number || 'N/A',
                              nf_access_key: nf_data_from_file.nf_access_key || 'N/A'
                            });
                            continue; // Não agrega itens/metadata de NF duplicada
                          }

                          if (nf_data_from_file.items && nf_data_from_file.items.length > 0) {
                            aggregatedItems = aggregatedItems.concat(nf_data_from_file.items);
                          }
                          // Add NF metadata to the list, even if some fields are empty
                          metas.push({
                            nf_number: nf_data_from_file.nf_number || "",
                            nf_series: nf_data_from_file.nf_series || "",
                            nf_access_key: nf_data_from_file.nf_access_key || "",
                            nf_issue_date: nf_data_from_file.nf_issue_date || null
                          });
                        } // End of for loop through importFiles

                        if (aggregatedItems.length === 0) {
                          if (skipped.length > 0) {
                            const s = skipped.map(d => `• NF: ${d.nf_number} | Chave: ${d.nf_access_key}`).join('\n');
                            alert(`Nenhum item foi importado. Todas as NFs selecionadas foram ignoradas por já existirem no sistema:\n\n${s}`);
                          } else {
                            alert("Nenhum item foi extraído dos arquivos enviados. Tente outros arquivos (CSV/PDF/Imagem) ou revise o formato.");
                          }
                          setImporting(false);
                          return;
                        }

                        if (skipped.length > 0) {
                          const s = skipped.map(d => `• NF: ${d.nf_number} | Chave: ${d.nf_access_key}`).join('\n');
                          alert(`Algumas NFs foram ignoradas por já existirem no sistema:\n\n${s}\n\nOs demais itens foram importados com sucesso.`);
                        }

                        // Mount prefill with aggregated items and metadata for each NF
                        const prefill = {
                          items: aggregatedItems,
                          nf_imports: metas
                        };
                        setPrefillData(prefill);
                        setEditingSupply(null); // Clear editing state if importing
                        setImportDialogOpen(false);
                        setImportFiles([]); // Clear selected files
                        setIsFormOpen(true); // Open the supply form
                      } catch (e) {
                        console.error("Falha na importação da(s) NF(s):", e);
                        alert("Falha ao importar Notas Fiscais. Verifique os tipos de arquivo (CSV/PDF/JPG/PNG) e tente novamente.");
                      }
                      setImporting(false);
                    }}
                    disabled={importing}
                  >
                    {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : "Importar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Histórico
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total de Recibos</p>
            <p className="text-2xl font-bold text-foreground mt-1">{supplies.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Órgãos/Clientes</p>
            <p className="text-2xl font-bold text-foreground mt-1">{new Set(supplies.map(s => s.organization)).size}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Itens Comprados</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {supplies.reduce((sum, s) => sum + (s.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Valor Movimentado</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                supplies.reduce((sum, s) => sum + (s.total_amount || 0), 0)
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por órgão/cliente ou item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Label>Contrato</Label>
              <Select value={filterContract} onValueChange={setFilterContract}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione o contrato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>De</Label>
              <Input type="date" value={filterFrom} onChange={(e)=>setFilterFrom(e.target.value)} className="bg-background border-border" />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={filterTo} onChange={(e)=>setFilterTo(e.target.value)} className="bg-background border-border" />
            </div>
            <div>
              <Label>Com NF?</Label>
              <Select value={filterHasNF} onValueChange={setFilterHasNF}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Sim</SelectItem>
                  <SelectItem value="no">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              setFilterContract("all"); setFilterFrom(""); setFilterTo(""); setFilterHasNF("all"); setSearchTerm("");
            }}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Entregas */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center text-base font-semibold text-foreground">
            <Package className="w-4 h-4 mr-2 text-primary" />
            Recibos de Compras ({filteredSupplies.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-border">
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Recibo Nº</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Órgão/Cliente</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Nota Fiscal</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Itens</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Valor Total</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Data</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Última Alteração</TableHead>
                <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSupplies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Package className="w-8 h-8 text-muted-foreground opacity-60" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum recibo</h3>
                      <p className="text-muted-foreground text-sm mb-4">Registre uma nova compra para começar.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSupplies.map((supply) => {
                  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(value || 0);

                  return (
                    <TableRow key={supply.id} className="border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-sm font-medium text-foreground">
                        {supply.receipt_id || 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{supply.organization}</TableCell>
                      <TableCell>
                        {supply.nf_imports && supply.nf_imports.length > 0 ? (
                          <div className="flex flex-col text-sm text-muted-foreground">
                            {supply.nf_imports.map((nf, idx) => (
                              <span key={idx}>NF: {nf.nf_number || 'N/A'} / {nf.nf_series || 'N/S'} {nf.nf_issue_date && `(${format(new Date(nf.nf_issue_date), 'dd/MM/yyyy')})`}</span>
                            ))}
                          </div>
                        ) : supply.nf_number ? (
                          <div className="flex flex-col text-sm">
                            <span className="text-foreground">NF: {supply.nf_number} / {supply.nf_series || 'N/S'}</span>
                            {supply.nf_issue_date && (
                              <span className="text-muted-foreground text-xs">Emissão: {format(new Date(supply.nf_issue_date), 'dd/MM/yyyy')}</span>
                            )}
                            {supply.nf_access_key && (
                              <span className="text-xs text-muted-foreground break-all" title={supply.nf_access_key}>
                                Chave: {supply.nf_access_key.substring(0, 10)}...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <ul className="list-disc pl-4 text-sm max-h-20 overflow-y-auto text-muted-foreground">
                          {(supply.items || []).map((item, i) => (
                            <li key={i} title={`${item.description}`}>
                              <span className="font-semibold text-foreground">{item.quantity} {item.unit}</span> — {item.description}
                              {item.total_value > 0 && (
                                <span className="text-green-600 ml-2">({formatCurrency(item.total_value)})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {supply.contract_id && contracts.find(c => c.id === supply.contract_id) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Contrato: {contracts.find(c => c.id === supply.contract_id)?.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        {formatCurrency(supply.total_amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {supply.delivery_date ? format(new Date(supply.delivery_date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{supply.updated_by || supply.created_by || 'Sistema'}</span>
                          <span className="text-xs">{format(new Date(supply.updated_date || supply.created_date), "dd/MM/yy HH:mm")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" disabled={isGeneratingPDF}>
                                <Download className="w-4 h-4 mr-1" />
                                {isGeneratingPDF ? "..." : "Recibo"}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => downloadReceiptHTMLA4(supply)}>
                                <Download className="w-4 h-4 mr-2" />
                                Baixar HTML A4
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printReceiptA4(supply)}>
                                <Printer className="w-4 h-4 mr-2" />
                                Imprimir / Salvar PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEmailModal(supply)}
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingSupply(supply);
                              setPrefillData(null);
                              setIsFormOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(supply.id)}
                            disabled={isDeleting === supply.id}
                          >
                            <Trash2 className="w-4 h-4" />
                            {isDeleting === supply.id ? "..." : ""}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal de Envio de E-mail */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Recibo para seu E-mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              O recibo será enviado para o seu e-mail cadastrado: <strong>{user?.email}</strong>.
              <br />
              A partir da sua caixa de entrada, você poderá encaminhá-lo para o destinatário final.
            </p>
            <p className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded-md">
              Esta é uma medida de segurança para evitar que a aplicação seja utilizada para envio de spam.
            </p>
            <Button onClick={handleSendEmail} className="w-full">
              <Mail className="w-4 h-4 mr-2" />
              Confirmar e Enviar para meu E-mail
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
