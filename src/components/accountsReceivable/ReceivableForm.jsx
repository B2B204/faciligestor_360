
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AccountsReceivable } from '@/entities/AccountsReceivable';
import { FiscalPosition } from '@/entities/FiscalPosition';
import { resolveFiscalPosition, calculateTaxes } from '@/lib/fiscalEngine';
import { BRAZIL_BANKS } from '@/components/utils/banks'; // Corrected import path
import { Checkbox } from '@/components/ui/checkbox';
import { Landmark } from 'lucide-react';

export default function ReceivableForm({ account, onSave, onCancel, user, contracts }) {
  const [formData, setFormData] = useState({
    contract_id: '',
    document_number: '',
    status: 'aberto',
    due_date: '',
    face_value: 0,
    open_amount: 0,
    discount_amount: 0,
    interest_amount: 0,
    monetary_correction_amount: 0,
    paid_amount: 0,
    tax_retained_amount: 0,
    payment_date: '',
    settlement_date: '',
    observations: '',
    // NOVOS CAMPOS - Banco Recebedor
    receiving_bank_code: '',
    receiving_bank_name: '',
    receiving_bank_agency: '',
    receiving_bank_account: '',
    receiving_bank_pix_key: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [fiscalPositions, setFiscalPositions] = useState([]);
  const [taxCalc, setTaxCalc] = useState(null);
  const [applyRetention, setApplyRetention] = useState(true);
  const [tax_breakdown, setTaxBreakdown] = useState(account?.tax_breakdown || null);
  const [fiscal_position_id, setFiscalPositionId] = useState(account?.fiscal_position_id || null);

  useEffect(() => {
    if (user?.cnpj) {
      FiscalPosition.filter({ cnpj: user.cnpj, is_active: true }).then(setFiscalPositions);
    }
  }, [user]);

  useEffect(() => {
    if (account) {
      setFormData({
        contract_id: account.contract_id || '',
        document_number: account.document_number || '',
        status: account.status || 'aberto',
        due_date: account.due_date ? account.due_date.split('T')[0] : '',
        face_value: account.face_value || 0,
        open_amount: account.open_amount || 0,
        discount_amount: account.discount_amount || 0,
        interest_amount: account.interest_amount || 0,
        monetary_correction_amount: account.monetary_correction_amount || 0,
        paid_amount: account.paid_amount || 0,
        tax_retained_amount: account.tax_retained_amount || 0,
        payment_date: account.payment_date ? account.payment_date.split('T')[0] : '',
        settlement_date: account.settlement_date ? account.settlement_date.split('T')[0] : '',
        observations: account.observations || '',
        // carregar banco recebedor
        receiving_bank_code: account.receiving_bank_code || '',
        receiving_bank_name: account.receiving_bank_name || '',
        receiving_bank_agency: account.receiving_bank_agency || '',
        receiving_bank_account: account.receiving_bank_account || '',
        receiving_bank_pix_key: account.receiving_bank_pix_key || ''
      });
    } else {
        // Reset form for new entry, including new bank fields
        setFormData({
            contract_id: '',
            document_number: '',
            status: 'aberto',
            due_date: '',
            face_value: 0,
            open_amount: 0,
            discount_amount: 0,
            interest_amount: 0,
            monetary_correction_amount: 0,
            paid_amount: 0,
            tax_retained_amount: 0,
            payment_date: '',
            settlement_date: '',
            observations: '',
            receiving_bank_code: '',
            receiving_bank_name: '',
            receiving_bank_agency: '',
            receiving_bank_account: '',
            receiving_bank_pix_key: ''
        });
    }
    setApplyRetention(!account || !!account.fiscal_position_id);
    setTaxBreakdown(account?.tax_breakdown || null);
    setFiscalPositionId(account?.fiscal_position_id || null);
  }, [account]);
  
  // Evita depender diretamente de formData dentro do effect para auto-cálculo
  const {
    contract_id,
    face_value,
    discount_amount,
    interest_amount,
    monetary_correction_amount,
    paid_amount,
    tax_retained_amount
  } = formData;

  // Calcula automaticamente os impostos aplicáveis via Regra Fiscal do contrato
  useEffect(() => {
    const contract = contracts?.find((c) => c.id === contract_id);
    if (!contract || !fiscalPositions.length) {
      setTaxCalc(null);
      return;
    }
    const position = resolveFiscalPosition(contract, fiscalPositions);
    const calc = calculateTaxes(face_value, position);
    setTaxCalc(calc);
    setFiscalPositionId(position?.id || null);
    setTaxBreakdown(calc.breakdown.length ? calc.breakdown : null);

    if (applyRetention) {
      const retained = calc.retainAtSource ? calc.total : 0;
      setFormData((prev) => (prev.tax_retained_amount === retained ? prev : { ...prev, tax_retained_amount: retained }));
    }
  }, [contract_id, face_value, fiscalPositions, applyRetention, contracts]);

  useEffect(() => {
    const computed = (Number(face_value) || 0)
      - (Number(discount_amount) || 0)
      + (Number(interest_amount) || 0)
      + (Number(monetary_correction_amount) || 0)
      - (Number(paid_amount) || 0)
      - (Number(tax_retained_amount) || 0);

    setFormData(prev => {
      // Only update if the computed value is different to prevent unnecessary re-renders
      if (computed === prev.open_amount) {
        return prev;
      }
      return { ...prev, open_amount: computed };
    });
  }, [face_value, discount_amount, interest_amount, monetary_correction_amount, paid_amount, tax_retained_amount]);


  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };
  
  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBankSelect = (code) => {
    if (code === 'OUTRO') {
      setFormData(prev => ({
        ...prev,
        receiving_bank_code: 'OUTRO',
        receiving_bank_name: '', // Clear name for manual entry
      }));
    } else {
      const selected = BRAZIL_BANKS.find(b => b.code === code);
      setFormData(prev => ({
        ...prev,
        receiving_bank_code: code,
        receiving_bank_name: selected ? selected.name : '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contract_id || !formData.document_number || !formData.due_date || !formData.face_value) {
        alert("Por favor, preencha todos os campos obrigatórios (*).");
        return;
    }
    
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, cnpj: user.cnpj, tax_breakdown, fiscal_position_id };
      if (account) {
        await AccountsReceivable.update(account.id, dataToSave);
      } else {
        await AccountsReceivable.create(dataToSave);
      }
      onSave();
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
      alert("Falha ao salvar a conta.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="contract_id">Contrato (Sacado) *</Label>
          <Select name="contract_id" value={formData.contract_id} onValueChange={(v) => handleSelectChange('contract_id', v)} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o contrato" />
            </SelectTrigger>
            <SelectContent>
              {contracts?.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="document_number">Nº Documento *</Label>
          <Input id="document_number" name="document_number" value={formData.document_number} onChange={handleChange} required />
        </div>
        <div>
          <Label htmlFor="status">Situação *</Label>
          <Select name="status" value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="liquidado">Liquidado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="due_date">Data de Vencimento *</Label>
          <Input type="date" id="due_date" name="due_date" value={formData.due_date} onChange={handleChange} required />
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-gray-50 p-4 rounded-lg">
        <div>
          <Label htmlFor="face_value">Valor de Face *</Label>
          <Input type="number" id="face_value" name="face_value" value={formData.face_value} onChange={handleChange} required step="0.01" />
        </div>
        <div>
          <Label htmlFor="discount_amount">Desconto</Label>
          <Input type="number" id="discount_amount" name="discount_amount" value={formData.discount_amount} onChange={handleChange} step="0.01" />
        </div>
        <div>
          <Label htmlFor="interest_amount">Juros/Mora</Label>
          <Input type="number" id="interest_amount" name="interest_amount" value={formData.interest_amount} onChange={handleChange} step="0.01" />
        </div>
        <div>
          <Label htmlFor="monetary_correction_amount">Correção Monetária</Label>
          <Input type="number" id="monetary_correction_amount" name="monetary_correction_amount" value={formData.monetary_correction_amount} onChange={handleChange} step="0.01" />
        </div>
        <div>
          <Label htmlFor="paid_amount">Valor Pago</Label>
          <Input type="number" id="paid_amount" name="paid_amount" value={formData.paid_amount} onChange={handleChange} step="0.01" />
        </div>
        <div>
          <Label htmlFor="tax_retained_amount">Impostos Retidos</Label>
          <Input type="number" id="tax_retained_amount" name="tax_retained_amount" value={formData.tax_retained_amount} onChange={handleChange} step="0.01" disabled={applyRetention} className={applyRetention ? 'bg-gray-100' : ''} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Label>Valor em Aberto</Label>
          <div className="p-2 bg-white border rounded-md font-bold text-lg text-blue-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.open_amount || 0)}
          </div>
        </div>
      </div>

      {taxCalc && (
        <div className="space-y-2 p-4 rounded-lg border bg-indigo-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
              <Landmark className="w-4 h-4" /> Regra Fiscal Aplicada: {taxCalc.position?.name || 'Nenhuma regra encontrada'}
            </p>
            <label className="flex items-center gap-2 text-xs text-indigo-800">
              <Checkbox checked={applyRetention} onCheckedChange={(v) => setApplyRetention(!!v)} />
              Reter automaticamente
            </label>
          </div>
          {taxCalc.breakdown.length === 0 ? (
            <p className="text-xs text-indigo-700">Nenhuma alíquota configurada para esta combinação de serviço/cliente.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {taxCalc.breakdown.map((item) => (
                <span key={item.key} className="text-xs bg-white border border-indigo-200 rounded-full px-2 py-1 text-indigo-800">
                  {item.label} {item.rate}% = {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                </span>
              ))}
              <span className="text-xs font-semibold text-indigo-900 px-2 py-1">
                Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(taxCalc.total)}
                {taxCalc.retainAtSource ? ' (retido na fonte)' : ' (não retido — pago pela contratada)'}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* DADOS BANCÁRIOS DE RECEBIMENTO */}
      <div className="space-y-3 p-4 rounded-lg border bg-gray-50">
        <p className="text-sm font-semibold text-gray-800">Dados bancários de recebimento</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Banco recebedor</Label>
            <Select
              value={formData.receiving_bank_code || ""}
              onValueChange={(v) => handleBankSelect(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {BRAZIL_BANKS.map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.code} - {b.name}
                  </SelectItem>
                ))}
                <SelectItem key="OUTRO" value="OUTRO">
                  OUTRO - Outro Banco (informar manualmente)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Agência</Label>
            <Input
              name="receiving_bank_agency"
              value={formData.receiving_bank_agency}
              onChange={handleChange}
              placeholder="Ex.: 1234-5"
            />
          </div>
          <div>
            <Label>Conta</Label>
            <Input
              name="receiving_bank_account"
              value={formData.receiving_bank_account}
              onChange={handleChange}
              placeholder="Ex.: 123456-7"
            />
          </div>
          <div className="md:col-span-1">
            <Label>Chave PIX (opcional)</Label>
            <Input
              name="receiving_bank_pix_key"
              value={formData.receiving_bank_pix_key}
              onChange={handleChange}
              placeholder="CPF/CNPJ, email, telefone ou aleatória"
            />
          </div>

          {/* Campos extras quando OUTRO banco */}
          {formData.receiving_bank_code === 'OUTRO' && (
            <>
              <div>
                <Label>Nome do Banco (manual)</Label>
                <Input
                  name="receiving_bank_name"
                  value={formData.receiving_bank_name}
                  onChange={handleChange}
                  placeholder="Digite o nome do banco"
                  required={true}
                />
              </div>
              <div>
                <Label>Código do Banco (manual)</Label>
                <Input
                  name="receiving_bank_code"
                  value={formData.receiving_bank_code === 'OUTRO' ? '' : formData.receiving_bank_code} // Clear code if it's 'OUTRO' for manual input
                  onChange={handleChange}
                  placeholder="Ex.: 999"
                  required={true}
                />
              </div>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Dica: Use a chave PIX para recebimentos instantâneos ou informe agência/conta para boleto/transferência.
        </p>
      </div>
      
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="payment_date">Data de Pagamento</Label>
          <Input type="date" id="payment_date" name="payment_date" value={formData.payment_date} onChange={handleChange} />
        </div>
        <div>
          <Label htmlFor="settlement_date">Data de Liquidação</Label>
          <Input type="date" id="settlement_date" name="settlement_date" value={formData.settlement_date} onChange={handleChange} />
        </div>
      </div>

      <div>
        <Label htmlFor="observations">Observações</Label>
        <Textarea id="observations" name="observations" value={formData.observations} onChange={handleChange} rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </form>
  );
}
