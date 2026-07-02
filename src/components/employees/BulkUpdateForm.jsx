
import React, { useState } from 'react';
import { Employee } from '@/entities/Employee';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

export default function BulkUpdateForm({ employees, contracts, onSuccess, onCancel }) {
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [updateFields, setUpdateFields] = useState({
    base_salary: { enabled: false, value: '' },
    meal_allowance: { enabled: false, value: '' },
    transport_allowance: { enabled: false, value: '' },
    health_plan: { enabled: false, value: '' },
    contract_id: { enabled: false, value: '' },
    work_shift: { enabled: false, value: '' },
    status: { enabled: false, value: '' },
    // Uniforms
    uniform_shirt_size: { enabled: false, value: '' },
    uniform_pants_size: { enabled: false, value: '' },
    uniform_pants_modeling: { enabled: false, value: 'masc' },
    uniform_boot_size: { enabled: false, value: '' },
    uniform_boot_steel_toe: { enabled: false, value: false },
    uniform_jacket_size: { enabled: false, value: '' },
    uniform_gloves_size: { enabled: false, value: '' },
    uniform_hat_size: { enabled: false, value: '' },
    uniform_notes: { enabled: false, value: '' }
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleFieldToggle = (field) => {
    setUpdateFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        enabled: !prev[field].enabled
      }
    }));
  };

  const handleFieldValue = (field, value) => {
    setUpdateFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value: value
      }
    }));
  };

  const handleSelectAll = () => {
    setSelectedEmployees(
      selectedEmployees.length === employees.length
        ? []
        : employees.map(emp => emp.id)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedEmployees.length === 0) {
      alert('Selecione pelo menos um funcionário para atualizar.');
      return;
    }

    const fieldsToUpdate = Object.entries(updateFields)
      .filter(([_, config]) => config.enabled && (config.value !== '' && config.value !== null && config.value !== undefined))
      .reduce((acc, [field, config]) => {
        let v = config.value;
        if (['base_salary', 'meal_allowance', 'transport_allowance', 'health_plan', 'uniform_boot_size'].includes(field)) {
          v = Number(v) || 0;
        }
        if (field === 'uniform_boot_steel_toe') {
          v = !!v;
        }
        return { ...acc, [field]: v };
      }, {});

    if (Object.keys(fieldsToUpdate).length === 0) {
      alert('Selecione pelo menos um campo para atualizar.');
      return;
    }

    setIsUpdating(true);
    try {
      // Atualizar cada funcionário selecionado
      for (const employeeId of selectedEmployees) {
        const currentEmployee = employees.find(emp => emp.id === employeeId);

        // Recalcular custos se algum campo financeiro foi alterado
        let updatedData = { ...fieldsToUpdate };

        if (fieldsToUpdate.base_salary || fieldsToUpdate.meal_allowance || fieldsToUpdate.transport_allowance || fieldsToUpdate.health_plan) {
          const baseSalary = fieldsToUpdate.base_salary || currentEmployee.base_salary || 0;
          const mealAllowance = fieldsToUpdate.meal_allowance || currentEmployee.meal_allowance || 0;
          const transportAllowance = fieldsToUpdate.transport_allowance || currentEmployee.transport_allowance || 0;
          const healthPlan = fieldsToUpdate.health_plan || currentEmployee.health_plan || 0;
          const otherBenefits = currentEmployee.other_benefits || 0;
          const chargesPercentage = currentEmployee.social_charges_percentage || 40;

          const totalSalary = baseSalary + mealAllowance + transportAllowance;
          const benefitsCost = healthPlan + otherBenefits;
          const socialChargesCost = (baseSalary * chargesPercentage) / 100;
          const totalCost = totalSalary + benefitsCost + socialChargesCost;

          updatedData = {
            ...updatedData,
            total_salary: totalSalary,
            benefits_cost: benefitsCost,
            social_charges_cost: socialChargesCost,
            total_cost: totalCost
          };
        }
        // After computing updatedData for salary fields:
        updatedData = { ...updatedData, ...fieldsToUpdate };

        await Employee.update(employeeId, updatedData);
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar funcionários:', error);
      alert('Erro ao atualizar funcionários. Tente novamente.');
    }
    setIsUpdating(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Conteúdo rolável */}
      <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-6">
        {/* Seleção de Funcionários */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900">Selecionar Funcionários</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedEmployees.length === employees.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </Button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2">
            {employees.map(employee => (
              <div key={employee.id} className="flex items-center space-x-2">
                <Checkbox
                  id={employee.id}
                  checked={selectedEmployees.includes(employee.id)}
                  onCheckedChange={() => handleEmployeeToggle(employee.id)}
                />
                <label htmlFor={employee.id} className="text-sm">
                  {employee.name} - {employee.role}
                </label>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-2">
            {selectedEmployees.length} funcionários selecionados
          </p>
        </div>

        {/* Campos para Atualização */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Campos para Atualizar</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Salário Base */}
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={updateFields.base_salary.enabled}
                onCheckedChange={() => handleFieldToggle('base_salary')}
              />
              <div className="flex-1">
                <Label>Salário Base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!updateFields.base_salary.enabled}
                  value={updateFields.base_salary.value}
                  onChange={(e) => handleFieldValue('base_salary', e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Vale Alimentação */}
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={updateFields.meal_allowance.enabled}
                onCheckedChange={() => handleFieldToggle('meal_allowance')}
              />
              <div className="flex-1">
                <Label>Vale Alimentação (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!updateFields.meal_allowance.enabled}
                  value={updateFields.meal_allowance.value}
                  onChange={(e) => handleFieldValue('meal_allowance', e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Vale Transporte */}
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={updateFields.transport_allowance.enabled}
                onCheckedChange={() => handleFieldToggle('transport_allowance')}
              />
              <div className="flex-1">
                <Label>Vale Transporte (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!updateFields.transport_allowance.enabled}
                  value={updateFields.transport_allowance.value}
                  onChange={(e) => handleFieldValue('transport_allowance', e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Plano de Saúde */}
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={updateFields.health_plan.enabled}
                onCheckedChange={() => handleFieldToggle('health_plan')}
              />
              <div className="flex-1">
                <Label>Plano de Saúde (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!updateFields.health_plan.enabled}
                  value={updateFields.health_plan.value}
                  onChange={(e) => handleFieldValue('health_plan', e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Contrato */}
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={updateFields.contract_id.enabled}
                onCheckedChange={() => handleFieldToggle('contract_id')}
              />
              <div className="flex-1">
                <Label>Contrato</Label>
                <Select
                  disabled={!updateFields.contract_id.enabled}
                  value={updateFields.contract_id.value}
                  onValueChange={(value) => handleFieldValue('contract_id', value)}
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
            </div>

            {/* Turno */}
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={updateFields.work_shift.enabled}
                onCheckedChange={() => handleFieldToggle('work_shift')}
              />
              <div className="flex-1">
                <Label>Turno de Trabalho</Label>
                <Select
                  disabled={!updateFields.work_shift.enabled}
                  value={updateFields.work_shift.value}
                  onValueChange={(value) => handleFieldValue('work_shift', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="noite">Noite</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="escala_12x36">Escala 12x36</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Uniforms */}
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_shirt_size.enabled} onCheckedChange={() => handleFieldToggle('uniform_shirt_size')} />
              <div className="flex-1">
                <Label>Tam. Camisa</Label>
                <Select disabled={!updateFields.uniform_shirt_size.enabled} value={updateFields.uniform_shirt_size.value} onValueChange={(v) => handleFieldValue('uniform_shirt_size', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{["PP", "P", "M", "G", "GG", "XG"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_pants_size.enabled} onCheckedChange={() => handleFieldToggle('uniform_pants_size')} />
              <div className="flex-1">
                <Label>Tam. Calça</Label>
                <Input disabled={!updateFields.uniform_pants_size.enabled} value={updateFields.uniform_pants_size.value} onChange={(e) => handleFieldValue('uniform_pants_size', e.target.value)} placeholder="Ex.: 44" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_pants_modeling.enabled} onCheckedChange={() => handleFieldToggle('uniform_pants_modeling')} />
              <div className="flex-1">
                <Label>Modelagem Calça</Label>
                <Select disabled={!updateFields.uniform_pants_modeling.enabled} value={updateFields.uniform_pants_modeling.value} onValueChange={(v) => handleFieldValue('uniform_pants_modeling', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masc">Masculina</SelectItem>
                    <SelectItem value="fem">Feminina</SelectItem>
                    <SelectItem value="unisex">Unissex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_boot_size.enabled} onCheckedChange={() => handleFieldToggle('uniform_boot_size')} />
              <div className="flex-1">
                <Label>Tam. Bota/Sapato</Label>
                <Input type="number" step="1" disabled={!updateFields.uniform_boot_size.enabled} value={updateFields.uniform_boot_size.value} onChange={(e) => handleFieldValue('uniform_boot_size', e.target.value)} placeholder="Ex.: 41" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_boot_steel_toe.enabled} onCheckedChange={() => handleFieldToggle('uniform_boot_steel_toe')} />
              <div className="flex-1">
                <Label>Bico de Aço</Label>
                <Select disabled={!updateFields.uniform_boot_steel_toe.enabled} value={String(updateFields.uniform_boot_steel_toe.value)} onValueChange={(v) => handleFieldValue('uniform_boot_steel_toe', v === 'true')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_jacket_size.enabled} onCheckedChange={() => handleFieldToggle('uniform_jacket_size')} />
              <div className="flex-1">
                <Label>Tam. Jaqueta</Label>
                <Select disabled={!updateFields.uniform_jacket_size.enabled} value={updateFields.uniform_jacket_size.value} onValueChange={(v) => handleFieldValue('uniform_jacket_size', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["PP", "P", "M", "G", "GG", "XG"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_gloves_size.enabled} onCheckedChange={() => handleFieldToggle('uniform_gloves_size')} />
              <div className="flex-1">
                <Label>Tam. Luvas</Label>
                <Select disabled={!updateFields.uniform_gloves_size.enabled} value={updateFields.uniform_gloves_size.value} onValueChange={(v) => handleFieldValue('uniform_gloves_size', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["PP", "P", "M", "G", "GG"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={updateFields.uniform_hat_size.enabled} onCheckedChange={() => handleFieldToggle('uniform_hat_size')} />
              <div className="flex-1">
                <Label>Tam. Boné/Capacete</Label>
                <Select disabled={!updateFields.uniform_hat_size.enabled} value={updateFields.uniform_hat_size.value} onValueChange={(v) => handleFieldValue('uniform_hat_size', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["P", "M", "G"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:col-span-2">
              <Checkbox checked={updateFields.uniform_notes.enabled} onCheckedChange={() => handleFieldToggle('uniform_notes')} />
              <div className="flex-1">
                <Label>Observações</Label>
                <Input disabled={!updateFields.uniform_notes.enabled} value={updateFields.uniform_notes.value} onChange={(e) => handleFieldValue('uniform_notes', e.target.value)} placeholder="Observações gerais" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé fixo (fora da área rolável) */}
      <div className="flex justify-end space-x-2 pt-4 border-t bg-white">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isUpdating || selectedEmployees.length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isUpdating ? 'Atualizando...' : `Atualizar ${selectedEmployees.length} Funcionários`}
        </Button>
      </div>
    </form>
  );
}
