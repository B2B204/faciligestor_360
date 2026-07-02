import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

export default function UniformForm({ uniform, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    item_name: '',
    size: '',
    unit_cost: 0,
    validity_months: 12,
    category: '',
    color: '',
    material: '',
    observations: '',
    stock_quantity: 0,
    min_stock: 0,
    stock_location: '',
    ca_number: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (uniform) {
      setFormData({
        item_name: uniform.item_name || '',
        size: uniform.size || '',
        unit_cost: uniform.unit_cost || 0,
        validity_months: uniform.validity_months || 12,
        category: uniform.category || '',
        color: uniform.color || '',
        material: uniform.material || '',
        observations: uniform.observations || '',
        stock_quantity: uniform.stock_quantity ?? 0,
        min_stock: uniform.min_stock ?? 0,
        stock_location: uniform.stock_location || '',
        ca_number: uniform.ca_number || '',
      });
    }
  }, [uniform]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const numericFields = ['unit_cost', 'validity_months', 'stock_quantity', 'min_stock'];
    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? Number(value) || 0 : value,
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="item_name">Nome do Item *</Label>
          <Input
            id="item_name"
            name="item_name"
            value={formData.item_name}
            onChange={handleChange}
            required
            placeholder="Ex: Camisa Polo Azul"
          />
        </div>

        <div>
          <Label>Categoria *</Label>
          <Select 
            value={formData.category} 
            onValueChange={(value) => handleSelectChange('category', value)}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="camisa">Camisa</SelectItem>
              <SelectItem value="calca">Calça</SelectItem>
              <SelectItem value="bermuda">Bermuda</SelectItem>
              <SelectItem value="sapato">Sapato</SelectItem>
              <SelectItem value="bone">Boné</SelectItem>
              <SelectItem value="jaqueta">Jaqueta</SelectItem>
              <SelectItem value="colete">Colete</SelectItem>
              <SelectItem value="epi">EPI</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Tamanho *</Label>
          <Select 
            value={formData.size} 
            onValueChange={(value) => handleSelectChange('size', value)}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tamanho" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PP">PP</SelectItem>
              <SelectItem value="P">P</SelectItem>
              <SelectItem value="M">M</SelectItem>
              <SelectItem value="G">G</SelectItem>
              <SelectItem value="GG">GG</SelectItem>
              <SelectItem value="XG">XG</SelectItem>
              <SelectItem value="Único">Tamanho Único</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.category === 'epi' && (
          <div>
            <Label htmlFor="ca_number">Nº do CA (Certificado de Aprovação) *</Label>
            <Input
              id="ca_number"
              name="ca_number"
              value={formData.ca_number}
              onChange={handleChange}
              required
              placeholder="Ex: 12345"
            />
          </div>
        )}

        <div>
          <Label htmlFor="unit_cost">Custo Unitário (R$) *</Label>
          <Input
            id="unit_cost"
            name="unit_cost"
            type="number"
            step="0.01"
            value={formData.unit_cost}
            onChange={handleChange}
            required
            placeholder="0,00"
          />
        </div>

        <div>
          <Label htmlFor="validity_months">Validade (meses) *</Label>
          <Input
            id="validity_months"
            name="validity_months"
            type="number"
            value={formData.validity_months}
            onChange={handleChange}
            required
            placeholder="12"
          />
        </div>

        <div>
          <Label htmlFor="color">Cor</Label>
          <Input
            id="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
            placeholder="Ex: Azul marinho"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="material">Material</Label>
        <Input
          id="material"
          name="material"
          value={formData.material}
          onChange={handleChange}
          placeholder="Ex: 100% algodão, Poliéster"
        />
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm font-semibold text-foreground mb-3">Controle de Estoque</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="stock_quantity">Qtd. em Estoque</Label>
            <Input
              id="stock_quantity"
              name="stock_quantity"
              type="number"
              min="0"
              value={formData.stock_quantity}
              onChange={handleChange}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="min_stock">Estoque Mínimo</Label>
            <Input
              id="min_stock"
              name="min_stock"
              type="number"
              min="0"
              value={formData.min_stock}
              onChange={handleChange}
              placeholder="5"
            />
          </div>
          <div>
            <Label htmlFor="stock_location">Localização</Label>
            <Input
              id="stock_location"
              name="stock_location"
              value={formData.stock_location}
              onChange={handleChange}
              placeholder="Ex: Almoxarifado A"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="observations">Observações</Label>
        <Textarea
          id="observations"
          name="observations"
          value={formData.observations}
          onChange={handleChange}
          rows={3}
          placeholder="Informações adicionais sobre o uniforme..."
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Salvando...' : (uniform ? 'Atualizar' : 'Cadastrar')}
        </Button>
      </div>
    </form>
  );
}