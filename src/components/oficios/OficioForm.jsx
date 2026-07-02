import React, { useEffect, useMemo, useRef, useState } from "react";
import { OficioTemplate } from "@/entities/OficioTemplate";
import { UploadFile } from "@/integrations/Core";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Table2, Save, Eye, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Employee } from "@/entities/Employee";
import AISuggester from "@/components/common/AISuggester";

export default function OficioForm({ oficio, onSave, onCancel, currentUser, suggestedNumber }) {
  const [form, setForm] = useState({
    numero_oficio: "",
    destinatario: "",
    assunto: "",
    data_emissao: "",
    assinante_nome: currentUser?.full_name || "",
    cargo_assinante: currentUser?.cargo || "",
    assinante_matricula: currentUser?.matricula || "",
    signer_employee_id: "",
    corpo_oficio: "<p></p>",
    tipo_oficio: oficio?.tipo_oficio || "",
    contract_id: oficio?.contract_id || "",
    category: oficio?.category || "",
    department: oficio?.department || ""
  });
  const [showPreview, setShowPreview] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const quillRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Carregar funcionários para seleção de assinante
    const loadEmployees = async () => {
      try {
        if (!currentUser?.cnpj) return;
        const list = await Employee.filter({ cnpj: currentUser.cnpj }, "-created_at", 200);
        setEmployees(list);
      } catch (e) {
        console.log("Não foi possível carregar funcionários para assinatura:", e?.message || e);
      }
    };
    loadEmployees();
  }, [currentUser?.cnpj]);

  // Carregar templates de ofício
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        if (!currentUser?.cnpj) return;
        const list = await OficioTemplate.filter({ cnpj: currentUser.cnpj }, "-created_date", 200);
        setTemplates(list);
      } catch (e) {
        console.log("Não foi possível carregar templates:", e?.message || e);
      }
    };
    loadTemplates();
  }, [currentUser?.cnpj]);

  useEffect(() => {
    if (oficio) {
      setForm({
        numero_oficio: oficio.numero_oficio || "",
        destinatario: oficio.destinatario || "",
        assunto: oficio.assunto || "",
        data_emissao: oficio.data_emissao ? String(oficio.data_emissao).substring(0, 10) : "",
        assinante_nome: oficio.assinante_nome || currentUser?.full_name || "",
        cargo_assinante: oficio.cargo_assinante || currentUser?.cargo || "",
        assinante_matricula: oficio.assinante_matricula || currentUser?.matricula || "",
        signer_employee_id: oficio.signer_employee_id || "",
        corpo_oficio: oficio.corpo_oficio || "<p></p>",
        tipo_oficio: oficio.tipo_oficio || "",
        contract_id: oficio.contract_id || "",
        category: oficio.category || "",
        department: oficio.department || ""
      });
    } else if (suggestedNumber) {
      setForm(f => ({ ...f, numero_oficio: suggestedNumber }));
    }
  }, [oficio, currentUser, suggestedNumber]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ align: "" }, { align: "center" }, { align: "right" }, { align: "justify" }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ color: [] }, { background: [] }],
        ["blockquote", "code-block"],
        ["link", "image"],
        ["clean"]
      ],
      handlers: {
        image: () => fileInputRef.current?.click()
      }
    },
    clipboard: { matchVisual: false }
  }), []);

  const formats = [
    "header", "bold", "italic", "underline", "strike",
    "align", "list", "bullet", "size", "color", "background",
    "blockquote", "code-block", "image", "link", "font"
  ];

  const insertTable = () => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;
    const tableHtml = `
      <table style="width:100%; border-collapse: collapse;" border="1">
        <tr><th style="padding:6px;">Cabeçalho 1</th><th style="padding:6px;">Cabeçalho 2</th></tr>
        <tr><td style="padding:6px;">Linha 1, Col 1</td><td style="padding:6px;">Linha 1, Col 2</td></tr>
        <tr><td style="padding:6px;">Linha 2, Col 1</td><td style="padding:6px;">Linha 2, Col 2</td></tr>
      </table><p></p>
    `;
    const range = quill.getSelection(true);
    quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
  };

  const insertPageBreak = () => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;
    const range = quill.getSelection(true);
    const pb = `<div class="page-break" style="border-top:1px dashed #ccc; margin:12px 0;"></div><p></p>`;
    quill.clipboard.dangerouslyPasteHTML(range.index, pb);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await UploadFile({ file });
      const quill = quillRef.current?.getEditor?.();
      if (!quill) return;
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, "image", file_url, "user");
      quill.setSelection(range.index + 1, 0);
    } catch (err) {
      alert("Falha ao enviar imagem. Tente novamente.");
      console.error(err);
    } finally {
      e.target.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.numero_oficio || !form.destinatario || !form.assunto || !form.data_emissao || !form.assinante_nome || !form.cargo_assinante) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    onSave({
      ...oficio,
      numero_oficio: form.numero_oficio,
      destinatario: form.destinatario,
      assunto: form.assunto,
      data_emissao: form.data_emissao,
      assinante_nome: form.assinante_nome,
      cargo_assinante: form.cargo_assinante,
      assinante_matricula: form.assinante_matricula,
      signer_employee_id: form.signer_employee_id,
      corpo_oficio: form.corpo_oficio,
      tipo_oficio: form.tipo_oficio,
      contract_id: form.contract_id,
      category: form.category,
      department: form.department
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label>Número do Ofício *</Label>
            <Input value={form.numero_oficio} onChange={(e) => setForm(f => ({ ...f, numero_oficio: e.target.value }))} placeholder={suggestedNumber || "0001/2025"} />
          </div>
          <div className="md:col-span-1">
            <Label>Data de Emissão *</Label>
            <Input type="date" value={form.data_emissao} onChange={(e) => setForm(f => ({ ...f, data_emissao: e.target.value }))} />
          </div>
          <div className="md:col-span-1">
            <Label>Tipo de Ofício (Opcional)</Label>
            <Input value={form.tipo_oficio} onChange={(e) => setForm(f => ({ ...f, tipo_oficio: e.target.value }))} placeholder="ex.: encaminhamento_medicao" />
          </div>

          <div className="md:col-span-2">
            <Label>Destinatário *</Label>
            <Input value={form.destinatario} onChange={(e) => setForm(f => ({ ...f, destinatario: e.target.value }))} />
          </div>
          <div className="md:col-span-1">
            <Label>Assunto *</Label>
            <Input value={form.assunto} onChange={(e) => setForm(f => ({ ...f, assunto: e.target.value }))} />
          </div>

          {/* Classificação e Template */}
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v)=>setForm(f=>({...f, category:v}))}>
                <SelectTrigger><SelectValue placeholder="ex.: ofício, aviso, interno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oficio">Ofício</SelectItem>
                  <SelectItem value="aviso">Aviso</SelectItem>
                  <SelectItem value="interno">Interno</SelectItem>
                  <SelectItem value="requisicao">Requisição</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Departamento</Label>
              <Select value={form.department} onValueChange={(v)=>setForm(f=>({...f, department:v}))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="compras">Compras</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Template</Label>
              <Select value={form.tipo_oficio} onValueChange={(code)=>{
                const t = templates.find(x=>x.code===code);
                setForm(f=>({
                  ...f,
                  tipo_oficio: code,
                  assunto: t?.subject_template || f.assunto,
                  corpo_oficio: t?.body_template || f.corpo_oficio
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Opcional: aplicar template" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t=> (
                    <SelectItem key={t.id} value={t.code}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seleção do assinante */}
          <div className="md:col-span-3 pt-4 border-t border-gray-100">
            <Label className="text-gray-700 font-semibold mb-3 block">Assinatura do Documento</Label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label className="text-gray-600 mb-1 block">Vincular Funcionário</Label>
                <Select
                  value={form.signer_employee_id || ""}
                  onValueChange={(employeeId) => {
                    const emp = employees.find(e => e.id === employeeId);
                    if (emp) {
                      setForm(f => ({
                        ...f,
                        signer_employee_id: employeeId,
                        assinante_nome: emp.name || f.assinante_nome,
                        cargo_assinante: emp.role || f.cargo_assinante,
                        assinante_matricula: emp.matricula || f.assinante_matricula
                      }));
                    } else {
                      setForm(f => ({ ...f, signer_employee_id: "", }));
                    }
                  }}
                >
                  <SelectTrigger className="bg-gray-50 border-gray-200 focus:ring-indigo-500 rounded-xl">
                    <SelectValue placeholder="Selecione para preencher" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} • {emp.role || "—"} {emp.matricula ? `• Mat: ${emp.matricula}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-600 mb-1 block">Nome do Assinante *</Label>
                <Input className="bg-gray-50 border-gray-200 focus:border-indigo-500 rounded-xl" value={form.assinante_nome} onChange={(e) => setForm(f => ({ ...f, assinante_nome: e.target.value }))} />
              </div>
              <div>
                <Label className="text-gray-600 mb-1 block">Cargo do Assinante *</Label>
                <Input className="bg-gray-50 border-gray-200 focus:border-indigo-500 rounded-xl" value={form.cargo_assinante} onChange={(e) => setForm(f => ({ ...f, cargo_assinante: e.target.value }))} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 gap-4">
        <div className="text-sm text-indigo-900 flex-1">
          <p className="font-semibold mb-1">Editor de Texto do Ofício</p>
          <p className="text-xs text-indigo-700/80">
            Use as ferramentas abaixo para formatar, inserir tabelas ou usar <b>Inteligência Artificial</b> para redigir o documento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AISuggester 
            label="Gerar com IA" 
            contextType="oficio"
            defaultPrompt={`Redija um ofício formal com o assunto: "${form.assunto || 'assunto aqui'}". Destinado a: ${form.destinatario || 'destinatário'}.`}
            onUseText={(text) => {
              const htmlText = text.replace(/\n/g, '<br/>');
              setForm(f => ({ ...f, corpo_oficio: (f.corpo_oficio || '') + htmlText }));
            }}
          />
          <Button type="button" variant="outline" onClick={insertTable} className="rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800">
            <Table2 className="w-4 h-4 mr-1.5" /> Tabela
          </Button>
          <Button type="button" variant="outline" onClick={insertPageBreak} className="rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800">
            <Table2 className="w-4 h-4 mr-1.5" /> Quebra
          </Button>
          <Button type="button" variant={showPreview ? "secondary" : "outline"} onClick={() => setShowPreview(p => !p)} className={`rounded-xl ${showPreview ? 'bg-indigo-100 text-indigo-900 border-indigo-200' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}>
            <Eye className="w-4 h-4 mr-1.5" /> {showPreview ? "Ocultar Prévia" : "Ver Prévia"}
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Editor + Prévia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <style>
          {`
            .a4-editor-wrapper .ql-toolbar {
              border: none !important;
              border-bottom: 1px solid #e5e7eb !important;
              background-color: white;
              border-top-left-radius: 0.75rem;
              border-top-right-radius: 0.75rem;
              position: sticky;
              top: 0;
              z-index: 10;
            }
            .a4-editor-wrapper .ql-container {
              border: none !important;
              background-color: #f3f4f6; /* cinza claro para o fundo */
              border-bottom-left-radius: 0.75rem;
              border-bottom-right-radius: 0.75rem;
            }
            .a4-editor-wrapper .ql-editor {
              background-color: white;
              width: 210mm;
              max-width: 95%;
              min-height: 297mm;
              margin: 2rem auto;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              padding: 20mm;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12pt;
              color: #000;
            }
            @media (max-width: 768px) {
              .a4-editor-wrapper .ql-editor {
                 padding: 15px;
                 margin: 1rem auto;
              }
            }
          `}
        </style>
        <div className={`border border-gray-200 rounded-xl bg-white shadow-sm transition-all duration-300 a4-editor-wrapper flex flex-col ${!showPreview ? 'lg:col-span-2' : ''}`}>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={form.corpo_oficio}
            onChange={(html) => setForm(f => ({ ...f, corpo_oficio: html }))}
            modules={modules}
            formats={formats}
            style={{ height: '700px' }}
            className="border-none flex-1"
          />
        </div>

        {showPreview && (
          <div className="border border-indigo-100 rounded-xl bg-white overflow-auto p-8 shadow-sm max-h-[562px]">
            <div className="max-w-[800px] mx-auto bg-white min-h-full">
              <div
                className="prose prose-sm max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: form.corpo_oficio }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl text-gray-500 hover:text-gray-700">
          <X className="w-4 h-4 mr-1.5" /> Cancelar
        </Button>
        <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-6 shadow-sm hover:shadow-md transition-all">
          <Save className="w-4 h-4 mr-1.5" /> Salvar Ofício
        </Button>
      </div>
    </form>
  );
}