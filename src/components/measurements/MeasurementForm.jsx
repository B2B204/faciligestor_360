import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Measurement } from '@/entities/Measurement';
import { MeasurementItem } from '@/entities/MeasurementItem';
import { CheckCircle, Link as LinkIcon } from 'lucide-react';

const MEASUREMENT_ITEMS = [
  { name: 'CERTIDÕES', weight: 10 },
  { name: 'E-SOCIAL', weight: 10 },
  { name: 'FGTS', weight: 10 },
  { name: 'FOLHA DE PAGAMENTO', weight: 10 },
  { name: 'FOLHA DE PONTO', weight: 10 },
  { name: 'GFIP-SEFIP', weight: 10 },
  { name: 'INSS', weight: 10 },
  { name: 'NOTA FISCAL', weight: 10 },
  { name: 'VALE-ALIMENTAÇÃO E VALE-TRANSPORTE', weight: 10 },
  { name: 'PLANILHA DE MEDIÇÃO', weight: 10 },
];

export default function MeasurementForm({ user, contracts, measurement, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    contract_id: '',
    measurement_month: '',
    status: 'Em execução',
    due_date: '',
    observations: '',
  });
  
  const [items, setItems] = useState(
    MEASUREMENT_ITEMS.map(item => ({
      ...item,
      completed: false,
      proof_link: ''
    }))
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (measurement) {
      setFormData({
        contract_id: measurement.contract_id || '',
        measurement_month: measurement.measurement_month || '',
        status: measurement.status || 'Em execução',
        due_date: measurement.due_date?.split('T')[0] || '',
        observations: measurement.observations || '',
      });
      loadItems(measurement.id);
    } else {
      // Reset items for new measurement
      setItems(MEASUREMENT_ITEMS.map(item => ({
        ...item,
        completed: false,
        proof_link: ''
      })));
      setSaveSuccess(false);
    }
  }, [measurement]);
  
  const loadItems = async (measurementId) => {
    try {
      const measurementItems = await MeasurementItem.filter({ measurement_id: measurementId });
      const itemsWithData = MEASUREMENT_ITEMS.map(defaultItem => {
        const existingItem = measurementItems.find(mi => mi.activity_name === defaultItem.name);
        return {
          ...defaultItem,
          completed: existingItem?.completed || false,
          proof_link: existingItem?.proof_link || ''
        };
      });
      setItems(itemsWithData);
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
    }
  };

  const executionPercentage = useMemo(() => {
    const completedWeight = items
      .filter(item => item.completed)
      .reduce((sum, item) => sum + item.weight, 0);
    return completedWeight;
  }, [items]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Se desmarcar o checkbox, limpar o link
    if (field === 'completed' && !value) {
      newItems[index].proof_link = '';
    }
    
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar links obrigatórios para itens marcados
    const invalidItems = items.filter(item => item.completed && !item.proof_link.trim());
    if (invalidItems.length > 0) {
      alert(`Por favor, preencha os links para os itens marcados: ${invalidItems.map(i => i.name).join(', ')}`);
      return;
    }
    
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const dataToSave = {
        ...formData,
        execution_percentage: executionPercentage,
        documents_count: items.filter(item => item.completed).length,
        cnpj: user.cnpj,
      };

      let savedMeasurement;
      if (measurement) {
        savedMeasurement = await Measurement.update(measurement.id, dataToSave);
      } else {
        savedMeasurement = await Measurement.create(dataToSave);
      }
      
      // Salvar/Atualizar itens
      const itemsToSave = items
        .filter(item => item.completed) // Salvar apenas itens marcados
        .map(item => ({
          measurement_id: savedMeasurement.id,
          activity_name: item.name,
          weight: item.weight,
          completed: item.completed,
          proof_link: item.proof_link,
          cnpj: user.cnpj
        }));

      // Deletar itens antigos se for edição
      if (measurement) {
        const oldItems = await MeasurementItem.filter({ measurement_id: measurement.id });
        for (const item of oldItems) {
          await MeasurementItem.delete(item.id);
        }
      }
      
      // Criar novos itens
      if (itemsToSave.length > 0) {
        await MeasurementItem.bulkCreate(itemsToSave);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      console.error("Erro ao salvar medição:", error);
      alert("Erro ao salvar. Verifique se todos os campos obrigatórios foram preenchidos.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-1">
      {/* Informações Gerais */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-3">Informações da Medição</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contract_id">Contrato *</Label>
            <Select 
              name="contract_id" 
              value={formData.contract_id} 
              onValueChange={(v) => handleSelectChange("contract_id", v)} 
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o contrato" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="measurement_month">Período de Referência *</Label>
            <Input 
              type="month" 
              id="measurement_month" 
              name="measurement_month" 
              value={formData.measurement_month} 
              onChange={handleFormChange} 
              required 
            />
          </div>
        </div>
      </div>

      {/* Documentos da Medição */}
      <div className="bg-green-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-green-900">Documentos da Medição</h3>
          <div className="text-right">
            <Label className="text-sm text-green-700">Percentual Executado</Label>
            <div className="text-2xl font-bold text-green-700">{executionPercentage}%</div>
            {executionPercentage < 100 && (
              <p className="text-xs text-orange-600 mt-1">
                Faltam {100 - executionPercentage}% para completar
              </p>
            )}
            {executionPercentage === 100 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Medição completa
              </p>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="bg-white p-4 rounded-lg border">
              <div className="flex items-center gap-4 mb-3">
                <input
                  type="checkbox"
                  id={`item-${index}`}
                  checked={item.completed}
                  onChange={(e) => handleItemChange(index, 'completed', e.target.checked)}
                  className="h-5 w-5"
                />
                <label htmlFor={`item-${index}`} className="flex-1 flex justify-between items-center">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant="secondary">{item.weight}%</Badge>
                </label>
              </div>
              
              {item.completed && (
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-gray-400" />
                  <Input
                    type="url"
                    placeholder="Cole o link do documento aqui..."
                    value={item.proof_link}
                    onChange={(e) => handleItemChange(index, 'proof_link', e.target.value)}
                    required={item.completed}
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status e Observações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status da Medição</Label>
          <Select 
            name="status" 
            value={formData.status} 
            onValueChange={(v) => handleSelectChange("status", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Em execução">Em Análise</SelectItem>
              <SelectItem value="Concluída">Concluída</SelectItem>
              <SelectItem value="Aprovada">Aprovada</SelectItem>
              <SelectItem value="Rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="due_date">Data de Vencimento</Label>
          <Input 
            type="date" 
            id="due_date" 
            name="due_date" 
            value={formData.due_date} 
            onChange={handleFormChange}
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="observations">Observações</Label>
        <Textarea 
          id="observations" 
          name="observations" 
          value={formData.observations} 
          onChange={handleFormChange} 
          rows={3}
          placeholder="Observações sobre a medição..."
        />
      </div>

      {/* Botões de Ação */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className={`${saveSuccess ? 'bg-green-600' : 'bg-blue-600'}`} 
          disabled={isSaving}
        >
          {isSaving ? (
            'Salvando...'
          ) : saveSuccess ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Salvo!
            </>
          ) : (
            'Cadastrar Medição'
          )}
        </Button>
      </div>
    </form>
  );
}