import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export default function UniformDeliveryForm({ contracts, employees, uniforms, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    contract_id: '',
    employee_id: '',
    delivery_date: new Date().toISOString().split('T')[0],
    recipient_signature: '',
    delivery_observations: ''
  });
  // Gera um recibo por formulário (persistido em cada item)
  const [receiptId] = useState(() => `REC-${Date.now()}`);

  const [uniformItems, setUniformItems] = useState([
    { uniform_id: '', quantity: 1, status: 'em_uso' }
  ]);

  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [totalCost, setTotalCost] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const availableItems = uniforms;

  useEffect(() => {
    if (formData.contract_id) {
      const contractEmployees = employees.filter(e => e.contract_id === formData.contract_id);
      setFilteredEmployees(contractEmployees);
    } else {
      setFilteredEmployees([]);
    }
  }, [formData.contract_id, employees]);

  useEffect(() => {
    // Calcular custo total
    const total = uniformItems.reduce((sum, item) => {
      const uniform = uniforms.find(u => u.id === item.uniform_id);
      return sum + ((item.quantity || 0) * (uniform?.unit_cost || 0));
    }, 0);
    setTotalCost(total);
  }, [uniformItems, uniforms]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'contract_id') {
      setFormData(prev => ({ ...prev, employee_id: '' }));
    }
  };

  const handleUniformItemChange = (index, field, value) => {
    const newItems = [...uniformItems];
    newItems[index][field] = field === 'quantity' ? Number(value) || 1 : value;
    setUniformItems(newItems);
  };

  const addUniformItem = () => {
    setUniformItems(prev => [...prev, { uniform_id: '', quantity: 1, status: 'em_uso' }]);
  };

  const removeUniformItem = (index) => {
    if (uniformItems.length > 1) {
      setUniformItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    // usa receiptId fixo do formulário para agrupar todos os itens
    try {
      const validItems = uniformItems.filter(item => item.uniform_id && item.quantity > 0);
      if (validItems.length === 0) {
        alert('Adicione pelo menos um item.');
        return;
      }
      for (const item of validItems) {
        const uniform = uniforms.find(u => u.id === item.uniform_id);
        const itemTotalCost = (item.quantity || 0) * (uniform?.unit_cost || 0);
        const deliveryDate = new Date(formData.delivery_date);
        const expiryDate = new Date(deliveryDate);
        expiryDate.setMonth(expiryDate.getMonth() + (uniform?.validity_months || 12));
        const deliveryData = {
          ...formData,
          uniform_id: item.uniform_id,
          quantity: item.quantity,
          status: item.status,
          total_cost: itemTotalCost,
          expiry_date: expiryDate.toISOString().split('T')[0],
          receipt_id: receiptId,
          is_epi: uniform?.category === 'epi',
        };
        await onSave(deliveryData);
      }
      alert('Entrega registrada! Agora gere o PDF único no Histórico de Entregas.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Contrato *</Label>
          <Select 
            value={formData.contract_id} 
            onValueChange={(value) => handleSelectChange('contract_id', value)}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o contrato" />
            </SelectTrigger>
            <SelectContent>
              {contracts.map(contract => (
                <SelectItem key={contract.id} value={contract.id}>
                  {contract.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Funcionário *</Label>
          <Select 
            value={formData.employee_id} 
            onValueChange={(value) => handleSelectChange('employee_id', value)}
            required
            disabled={!formData.contract_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o funcionário" />
            </SelectTrigger>
            <SelectContent>
              {filteredEmployees.map(employee => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name} - {employee.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="delivery_date">Data de Entrega *</Label>
          <Input
            id="delivery_date"
            name="delivery_date"
            type="date"
            value={formData.delivery_date}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <Label htmlFor="recipient_signature">Nome de Quem Recebeu</Label>
          <Input
            id="recipient_signature"
            name="recipient_signature"
            value={formData.recipient_signature}
            onChange={handleChange}
            placeholder="Nome completo do recebedor"
          />
        </div>
      </div>

      {/* Items de Uniforme */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-medium">Itens</h4>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={addUniformItem}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Item
          </Button>
        </div>

        <div className="space-y-4">
          {uniformItems.map((item, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-white rounded border">
              <div>
                <Label>Item *</Label>
                <Select
                  value={item.uniform_id}
                  onValueChange={(value) => handleUniformItemChange(index, 'uniform_id', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map(uniform => (
                      <SelectItem key={uniform.id} value={uniform.id}>
                        {uniform.item_name} - {uniform.size} - {formatCurrency(uniform.unit_cost)}
                        {uniform.ca_number ? ` - CA ${uniform.ca_number}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleUniformItemChange(index, 'quantity', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select 
                  value={item.status} 
                  onValueChange={(value) => handleUniformItemChange(index, 'status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_uso">Em Uso</SelectItem>
                    <SelectItem value="danificado">Danificado</SelectItem>
                    <SelectItem value="substituido">Substituído</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                    <SelectItem value="devolvido">Devolvido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {item.uniform_id && (
                  <div className="text-sm text-green-600 font-medium">
                    {formatCurrency((item.quantity || 0) * (uniforms.find(u => u.id === item.uniform_id)?.unit_cost || 0))}
                  </div>
                )}
                {uniformItems.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeUniformItem(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={addUniformItem}
            className="w-full flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar outro item
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded flex justify-between items-center">
          <span className="font-medium">Custo Total da Entrega:</span>
          <span className="text-lg font-bold text-blue-600">{formatCurrency(totalCost)}</span>
        </div>
      </div>

      <div>
        <Label htmlFor="delivery_observations">Observações da Entrega</Label>
        <Textarea
          id="delivery_observations"
          name="delivery_observations"
          value={formData.delivery_observations}
          onChange={handleChange}
          rows={3}
          placeholder="Informações adicionais sobre a entrega..."
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSaving || !formData.contract_id || !formData.employee_id}
        >
          {isSaving ? 'Registrando...' : 'Registrar Entrega'}
        </Button>
      </div>
    </form>
  );
}