import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Employee } from "@/entities/Employee";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Loader2, AlertTriangle, CheckCircle, FileDown, FileUp } from "lucide-react";
import { parse, format } from "date-fns";

export default function CSVImport({ contracts, user, onSuccess, onCancel }) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
        const allowedTypes = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
        if (!allowedTypes.includes(selectedFile.type)) {
            setError("Formato de arquivo inválido. Por favor, envie um arquivo CSV ou XLSX.");
            setFile(null);
        } else {
            setFile(selectedFile);
            setError("");
        }
    }
    setResults(null);
  };

  const normalizeDate = (dateString) => {
      if (!dateString) return null;
      try {
        const dateStr = String(dateString);
        // Tenta AAAA-MM-DD
        let parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
        if (!isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');
        
        // Tenta DD/MM/AAAA
        parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
        if (!isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');
        
        return null; // Formato não reconhecido
      } catch (e) {
          return null;
      }
  };

  const normalizeCurrency = (currencyString) => {
      if (typeof currencyString === 'number') return currencyString;
      if (!currencyString) return 0;
      return Number(String(currencyString).replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
  };

  const normalizeText = (text) => {
    if (!text) return "";
    return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const handleImport = async () => {
    if (!file) {
      setError("Por favor, selecione um arquivo.");
      return;
    }
    if (!user || !user.cnpj) {
      setError("Erro: Dados do usuário não carregados.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setResults(null);

    try {
      const { file_url } = await UploadFile({ file });
      const extractResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            employees: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  cpf: { type: "string" },
                  role: { type: "string" },
                  contract_name: { type: "string" },
                  base_salary: { "anyOf": [{ "type": "number" }, { "type": "string" }] },
                  meal_allowance: { "anyOf": [{ "type": "number" }, { "type": "string" }] },
                  transport_allowance: { "anyOf": [{ "type": "number" }, { "type": "string" }] },
                  health_plan: { "anyOf": [{ "type": "number" }, { "type": "string" }] },
                  admission_date: { "anyOf": [{ "type": "string" }, {"type": "number"}]}
                }
              }
            }
          }
        }
      });
      
      if (extractResult.status !== "success" || !extractResult.output.employees) {
        throw new Error(extractResult.details || "Falha ao extrair dados do arquivo.");
      }

      const employeesFromFile = extractResult.output.employees;
      const existingEmployees = await Employee.filter({ cnpj: user.cnpj });
      const normalizeCpf = (cpf) => String(cpf || '').replace(/\D/g, '');
      const existingCpfsNormalized = new Set(existingEmployees.map(e => normalizeCpf(e.cpf)).filter(Boolean));
      const seenCpfsInFile = new Set();
      const contractMap = new Map(contracts.map(c => [normalizeText(c.name), c.id]));

      let validRows = [];
      let invalidRows = [];

      employeesFromFile.forEach((emp) => {
        let rowErrors = [];
        
        // Validations
        if (!emp.name) rowErrors.push("Nome é obrigatório.");
        if (!emp.cpf) {
          rowErrors.push("CPF é obrigatório.");
        } else {
          const cpfDigits = normalizeCpf(emp.cpf);
          if (!cpfDigits) {
            rowErrors.push("CPF inválido.");
          } else if (existingCpfsNormalized.has(cpfDigits)) {
            const dup = existingEmployees.find(e => normalizeCpf(e.cpf) === cpfDigits);
            rowErrors.push(`CPF já cadastrado no sistema para "${dup?.name || 'funcionário existente'}". Atualize o cadastro existente.`);
          } else if (seenCpfsInFile.has(cpfDigits)) {
            rowErrors.push("CPF duplicado no arquivo — já existe outra linha com o mesmo CPF.");
          }
          // registra para detectar duplicados intra-arquivo (mesmo que a linha seja inválida por outro motivo, evita contar 2x)
          if (cpfDigits) seenCpfsInFile.add(cpfDigits);
        }
        if (!emp.role) rowErrors.push("Função é obrigatória.");
        
        const normalizedAdmissionDate = normalizeDate(emp.admission_date);
        if (!normalizedAdmissionDate) rowErrors.push("Data de admissão inválida ou em branco (use AAAA-MM-DD ou DD/MM/AAAA).");

        const normalizedContractName = normalizeText(emp.contract_name);
        const contract_id = contractMap.get(normalizedContractName);
        if (!contract_id) rowErrors.push(`Contrato "${emp.contract_name}" não encontrado.`);

        const baseSalary = normalizeCurrency(emp.base_salary);
        if (baseSalary <= 0) rowErrors.push("Salário base deve ser maior que zero.");

        const meal = normalizeCurrency(emp.meal_allowance);
        const transport = normalizeCurrency(emp.transport_allowance);
        const healthPlan = normalizeCurrency(emp.health_plan);
        const chargesPercentage = 40;

        const totalSalary = baseSalary + meal + transport;
        const benefitsCost = healthPlan;
        const socialChargesCost = (baseSalary * chargesPercentage) / 100;
        const totalCost = totalSalary + benefitsCost + socialChargesCost;

        const { contract_name: _contractName, ...empRest } = emp;
        const processedRow = {
          ...empRest,
          base_salary: baseSalary,
          meal_allowance: meal,
          transport_allowance: transport,
          health_plan: healthPlan,
          social_charges_percentage: chargesPercentage,
          total_salary: totalSalary,
          benefits_cost: benefitsCost,
          social_charges_cost: socialChargesCost,
          total_cost: totalCost,
          admission_date: normalizedAdmissionDate,
          contract_id,
          work_shift: 'comercial',
          status: 'ativo',
          cnpj: user.cnpj,
          created_by: user.email,
        };

        if (rowErrors.length > 0) {
          invalidRows.push({ ...emp, errors: rowErrors.join('; ') });
        } else {
          validRows.push(processedRow);
        }
      });
      
      if (!dryRun && validRows.length > 0) {
        await Employee.bulkCreate(validRows);
      }
      
      setResults({
        total: employeesFromFile.length,
        success: validRows.length,
        failed: invalidRows.length,
        errorLog: invalidRows
      });

      if (!dryRun && validRows.length > 0) {
        onSuccess();
      }

    } catch (err) {
      console.error("Erro na importação:", err);
      setError(`Erro: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = "name,cpf,role,contract_name,base_salary,meal_allowance,transport_allowance,health_plan,admission_date";
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_funcionarios.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDownloadErrorLog = () => {
    if (!results || !results.errorLog || results.errorLog.length === 0) return;
    const headers = [...Object.keys(results.errorLog[0])].join(',');
    const csvContent = [
      headers,
      ...results.errorLog.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "log_erros_importacao.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
          <Download className="w-4 h-4 mr-2" />
          Baixar Modelo
        </Button>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Instruções</h4>
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
            <li>Envie um arquivo CSV ou XLSX.</li>
            <li>O nome do contrato (`contract_name`) deve corresponder a um contrato existente no sistema.</li>
            <li>Datas podem ser `DD/MM/AAAA` ou `AAAA-MM-DD`.</li>
            <li>Valores monetários podem usar vírgula (ex: 1234,56).</li>
        </ul>
      </div>
      
      <div>
        <Input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChange} />
        <p className="text-xs text-gray-500 mt-1">
          Selecione um arquivo para importar.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="dryRun" checked={dryRun} onCheckedChange={setDryRun} />
        <Label htmlFor="dryRun">Apenas validar, sem salvar no banco de dados (Dry-run)</Label>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-1" />
            <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {results && (
        <div className="bg-gray-50 border rounded p-4 space-y-3">
            <h4 className="font-semibold text-lg">Resultado da {dryRun ? 'Validação' : 'Importação'}</h4>
            <div className="flex items-center space-x-4">
                <div className="flex items-center text-gray-600"><FileUp className="w-4 h-4 mr-2" /> Total de Linhas: <span className="font-bold ml-1">{results.total}</span></div>
                <div className="flex items-center text-green-600"><CheckCircle className="w-4 h-4 mr-2" /> Sucesso: <span className="font-bold ml-1">{results.success}</span></div>
                <div className="flex items-center text-red-600"><AlertTriangle className="w-4 h-4 mr-2" /> Falhas: <span className="font-bold ml-1">{results.failed}</span></div>
            </div>
            {results.failed > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDownloadErrorLog}>
                    <FileDown className="w-4 h-4 mr-2"/> Baixar Relatório de Falhas
                </Button>
            )}
        </div>
      )}
      
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleImport} 
          disabled={isProcessing || !file}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</> : (dryRun ? "Validar Arquivo" : "Importar Funcionários")}
        </Button>
      </div>
    </div>
  );
}