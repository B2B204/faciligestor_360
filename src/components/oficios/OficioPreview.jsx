
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function OficioPreview({ oficio, currentUser }) {
  const generateHtmlContent = () => {
    const companyName = currentUser?.company_name || 'NOME DA EMPRESA';
    const companyCnpj = currentUser?.cnpj || '';
    const companyAddress = currentUser?.company_address || '';
    const logo = currentUser?.company_logo_url;

    const numeroOficio = oficio.numero_oficio || '—';
    const dataEmissao = oficio.data_emissao ? format(new Date(oficio.data_emissao), 'dd/MM/yyyy') : '';
    const approvalStatus = (oficio.approval_status || 'pendente').toUpperCase();

    const generatedByName = currentUser?.full_name || currentUser?.email || '';

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Ofício ${numeroOficio}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          :root { --text:#111; --muted:#666; --line:#dcdcdc; }
          html, body { padding:0; margin:0; color:var(--text); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          body { font-family:"Times New Roman", Times, serif; font-size:12pt; line-height:1.65; background:#f6f7f9; }
          .page { width:100%; max-width:21cm; margin:0 auto; background:white; box-shadow:0 0 0.6rem rgba(0,0,0,0.12); }
          .wrap { padding:20mm; }
          .letterhead { display:flex; align-items:center; gap:16px; padding-bottom:10px; border-bottom:1px solid var(--line); margin-bottom:16px; }
          .letterhead .logo { width:72px; height:72px; display:flex; align-items:center; justify-content:center; }
          .letterhead .logo img { max-height:72px; max-width:100%; object-fit:contain; }
          .company-block { flex:1; }
          .company-name { font-size:14pt; font-weight:700; letter-spacing:0.2px; }
          .company-details { margin-top:4px; font-size:9pt; color:var(--muted); }
          .meta-line { font-size:10pt; color:var(--muted); display:flex; justify-content:space-between; gap:16px; margin-bottom:14px; }
          .oficio-title { text-align:center; font-weight:700; margin:8px 0 4px 0; }
          .oficio-number { text-align:center; font-size:11pt; color:var(--muted); margin-bottom:10px; }
          .approval-chip { text-align:center; font-size:10pt; margin:6px 0 10px 0; color:#0a0; }
          .approval-chip.rejected { color:#b91c1c; }
          .body-content { text-align:justify; word-break:break-word; hyphens:auto; }
          .body-content img { max-width:100%; height:auto; display:block; margin:6px auto; }
          .body-content table { width:100%; border-collapse:collapse; margin:10px 0 14px 0; page-break-inside:avoid; }
          .body-content th, .body-content td { border:1px solid #bfbfbf; padding:6px 8px; font-size:11pt; }
          .body-content th { background:#f1f3f5; font-weight:700; text-align:left; }
          .signature { text-align:center; margin-top:28mm; page-break-inside:avoid; }
          .signature-line { width:300px; margin:0 auto; border-top:1px solid #000; height:0; }
          .signature-name { margin-top:6px; font-weight:700; }
          .signature-role { color:var(--muted); font-size:10pt; }
          .signature-mat { color:var(--muted); font-size:10pt; }
          .footer { margin-top:18px; font-size:9pt; color:var(--muted); text-align:center; border-top:1px solid var(--line); padding-top:8px; }
          .page-break { height:0; border:none; margin:0; }
          @media print {
            .page { box-shadow:none; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="wrap">
            <div class="letterhead">
              <div class="logo">
                ${logo ? `<img src="${logo}" alt="Logo da Empresa" />` : ''}
              </div>
              <div class="company-block">
                <div class="company-name">${companyName}</div>
                <div class="company-details">
                  CNPJ: ${companyCnpj}${companyAddress ? ' • ' + companyAddress : ''}
                </div>
              </div>
            </div>

            <div class="meta-line">
              <div>Data: <strong>${dataEmissao}</strong></div>
              <div>Nº do Ofício: <strong>${numeroOficio}</strong></div>
            </div>

            <div class="oficio-title">OFÍCIO</div>
            <div class="oficio-number">Nº ${numeroOficio}</div>
            <div class="approval-chip ${approvalStatus==='REJEITADO'?'rejected':''}">
              ${approvalStatus==='PENDENTE' ? 'EM ANÁLISE' : approvalStatus}
            </div>

            <div class="body-content">
              ${oficio.corpo_oficio || ''}
            </div>

            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-name">${oficio.assinante_nome || ''}</div>
              <div class="signature-role">${oficio.cargo_assinante || ''}</div>
              ${oficio.assinante_matricula ? `<div class="signature-mat">Matrícula: ${oficio.assinante_matricula}</div>` : ''}
            </div>

            <div class="footer">
              Gerado por: ${generatedByName}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const content = generateHtmlContent();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(content);
    doc.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  const handleDownloadHtml = () => {
    const content = generateHtmlContent();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oficio_${String(oficio.numero_oficio || 'sem_numero').replace(/\//g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF (A4)
        </Button>
        <Button variant="outline" onClick={handleDownloadHtml}>
          <Download className="w-4 h-4 mr-2" /> Baixar HTML
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden bg-gray-50">
        <iframe
          srcDoc={generateHtmlContent()}
          className="w-full h-[85vh] border-0"
          title={`Pré-visualização do Ofício ${oficio.numero_oficio}`}
        />
      </div>
    </div>
  );
}
