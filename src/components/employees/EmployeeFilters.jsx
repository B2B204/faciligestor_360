import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";
import { X, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';

const EMPTY_FILTERS = {
  name: '',
  cpf: '',
  role: '',
  contract_id: '',
  unidade: '',
  status: '',
  admission_date_from: '',
  admission_date_to: '',
  dismissal_date_from: '',
  dismissal_date_to: '',
  email: '',
  whatsapp: '',
  uniform_shirt_size: '',
  uniform_pants_size: '',
  uniform_boot_size: '',
  uniform_jacket_size: '',
  uniform_gloves_size: '',
  uniform_hat_size: '',
  missing_sizes: false,
};

export default function EmployeeFilters({
  contracts,
  onFiltersChange,
  totalResults = 0,
  isLoading = false,
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [isExpanded, setIsExpanded] = useState(false);
  const debounceRef = useRef(null);

  // Conta filtros ativos para exibir badge
  const activeCount = Object.entries(filters).filter(([, v]) =>
    typeof v === 'boolean' ? v : v !== ''
  ).length;

  // Para campos de texto: atualiza estado local imediato + debounce de 400ms para disparar o filtro
  const handleTextChange = useCallback((e) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange(newFilters);
    }, 400);
  }, [filters, onFiltersChange]);

  // Para selects e datas: aplica imediatamente (são ações deliberadas, não digitação)
  const handleInstantChange = useCallback((name, value) => {
    const resolved = value === null ? '' : value;
    const newFilters = { ...filters, [name]: resolved };
    setFilters(newFilters);
    clearTimeout(debounceRef.current);
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const handleToggleMissing = useCallback((checked) => {
    const newFilters = { ...filters, missing_sizes: !!checked };
    setFilters(newFilters);
    clearTimeout(debounceRef.current);
    onFiltersChange(newFilters);
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    clearTimeout(debounceRef.current);
    setFilters(EMPTY_FILTERS);
    onFiltersChange(EMPTY_FILTERS);
  }, [onFiltersChange]);

  const sizeOptions = ['PP', 'P', 'M', 'G', 'GG', 'XG'];

  return (
    <Card className="bg-card border-border shadow-sm">
      {/* Header clicável */}
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors rounded-xl"
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Filtros Avançados</span>
          {activeCount > 0 && (
            <Badge className="bg-primary/10 text-primary border-0 text-xs px-1.5 py-0.5">
              {activeCount} ativo{activeCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Filtrando...' : `${totalResults} resultado${totalResults !== 1 ? 's' : ''}`}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-5">
          <div className="border-t border-border pt-4">
            {/* Bloco: Dados gerais */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados do funcionário</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nome"
                  name="name"
                  value={filters.name}
                  onChange={handleTextChange}
                  className="pl-8 bg-background border-border text-sm"
                />
              </div>
              <Input
                placeholder="CPF"
                name="cpf"
                value={filters.cpf}
                onChange={handleTextChange}
                className="bg-background border-border text-sm"
              />
              <Input
                placeholder="Cargo / Função"
                name="role"
                value={filters.role}
                onChange={handleTextChange}
                className="bg-background border-border text-sm"
              />
              <Input
                placeholder="Unidade"
                name="unidade"
                value={filters.unidade}
                onChange={handleTextChange}
                className="bg-background border-border text-sm"
              />
              <Input
                placeholder="E-mail"
                name="email"
                value={filters.email}
                onChange={handleTextChange}
                className="bg-background border-border text-sm"
              />
              <Input
                placeholder="WhatsApp"
                name="whatsapp"
                value={filters.whatsapp}
                onChange={handleTextChange}
                className="bg-background border-border text-sm"
              />
              <Select
                value={filters.contract_id || '__all__'}
                onValueChange={(v) => handleInstantChange('contract_id', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Todos os contratos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os contratos</SelectItem>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.status || '__all__'}
                onValueChange={(v) => handleInstantChange('status', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Demitido</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bloco: Datas */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Período</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Admissão — de</Label>
                <Input
                  type="date"
                  name="admission_date_from"
                  value={filters.admission_date_from}
                  onChange={(e) => handleInstantChange('admission_date_from', e.target.value)}
                  className="bg-background border-border text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Admissão — até</Label>
                <Input
                  type="date"
                  name="admission_date_to"
                  value={filters.admission_date_to}
                  onChange={(e) => handleInstantChange('admission_date_to', e.target.value)}
                  className="bg-background border-border text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Demissão — de</Label>
                <Input
                  type="date"
                  name="dismissal_date_from"
                  value={filters.dismissal_date_from}
                  onChange={(e) => handleInstantChange('dismissal_date_from', e.target.value)}
                  className="bg-background border-border text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Demissão — até</Label>
                <Input
                  type="date"
                  name="dismissal_date_to"
                  value={filters.dismissal_date_to}
                  onChange={(e) => handleInstantChange('dismissal_date_to', e.target.value)}
                  className="bg-background border-border text-sm"
                />
              </div>
            </div>
          </div>

          {/* Bloco: Uniformes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tamanhos de uniforme</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Select
                value={filters.uniform_shirt_size || '__all__'}
                onValueChange={(v) => handleInstantChange('uniform_shirt_size', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Camisa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Camisa — todos</SelectItem>
                  {sizeOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Input
                placeholder="Calça (ex: 44)"
                name="uniform_pants_size"
                value={filters.uniform_pants_size}
                onChange={handleTextChange}
                className="bg-background border-border text-sm"
              />

              <Input
                placeholder="Bota (ex: 41)"
                name="uniform_boot_size"
                type="number"
                value={filters.uniform_boot_size}
                onChange={handleTextChange}
                className="bg-background border-border text-sm"
              />

              <Select
                value={filters.uniform_jacket_size || '__all__'}
                onValueChange={(v) => handleInstantChange('uniform_jacket_size', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Jaqueta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Jaqueta — todos</SelectItem>
                  {sizeOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select
                value={filters.uniform_gloves_size || '__all__'}
                onValueChange={(v) => handleInstantChange('uniform_gloves_size', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Luvas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Luvas — todos</SelectItem>
                  {['PP', 'P', 'M', 'G', 'GG'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select
                value={filters.uniform_hat_size || '__all__'}
                onValueChange={(v) => handleInstantChange('uniform_hat_size', v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="bg-background border-border text-sm">
                  <SelectValue placeholder="Boné/Capacete" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Boné — todos</SelectItem>
                  {['P', 'M', 'G'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Checkbox
                id="missing_sizes"
                checked={filters.missing_sizes}
                onCheckedChange={handleToggleMissing}
              />
              <Label htmlFor="missing_sizes" className="text-sm text-foreground cursor-pointer">
                Mostrar apenas funcionários com tamanhos incompletos
              </Label>
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? 'Aplicando filtros...'
                : activeCount > 0
                  ? `${totalResults} resultado${totalResults !== 1 ? 's' : ''} com ${activeCount} filtro${activeCount > 1 ? 's' : ''} ativo${activeCount > 1 ? 's' : ''}`
                  : `${totalResults} funcionário${totalResults !== 1 ? 's' : ''} no total`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              disabled={activeCount === 0}
              className="gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
