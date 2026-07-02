import React, { useState } from 'react';
import { Uniform } from '@/entities/Uniform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Search, Shirt } from 'lucide-react';

export default function UniformList({ uniforms, onEdit, onDataChange }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este uniforme?')) {
      try {
        await Uniform.delete(id);
        onDataChange();
      } catch (error) {
        console.error('Erro ao excluir uniforme:', error);
        alert('Erro ao excluir uniforme.');
      }
    }
  };

  const formatCurrency = (value) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const categoryColors = {
    camisa: 'bg-blue-100 text-blue-800',
    calca: 'bg-green-100 text-green-800',
    bermuda: 'bg-yellow-100 text-yellow-800',
    sapato: 'bg-purple-100 text-purple-800',
    bone: 'bg-orange-100 text-orange-800',
    jaqueta: 'bg-indigo-100 text-indigo-800',
    colete: 'bg-pink-100 text-pink-800',
    epi: 'bg-red-100 text-red-800',
    outros: 'bg-gray-100 text-gray-800'
  };

  const filteredUniforms = uniforms.filter(uniform =>
    uniform.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    uniform.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Uniformes Cadastrados</h3>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <Input
            placeholder="Buscar uniformes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {filteredUniforms.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Shirt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum uniforme encontrado
            </h3>
            <p className="text-gray-600">
              {searchTerm ? 'Tente uma busca diferente.' : 'Comece cadastrando uniformes para sua empresa.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUniforms.map((uniform) => (
            <Card key={uniform.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{uniform.item_name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge className={categoryColors[uniform.category] || categoryColors.outros}>
                        {uniform.category}
                      </Badge>
                      <Badge variant="outline">
                        Tamanho {uniform.size}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onEdit(uniform)}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(uniform.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Custo:</span>
                    <div className="font-semibold text-green-600">
                      {formatCurrency(uniform.unit_cost)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Validade:</span>
                    <div className="font-medium">
                      {uniform.validity_months} meses
                    </div>
                  </div>
                </div>
                
                {uniform.category === 'epi' && uniform.ca_number && (
                  <div className="text-sm">
                    <span className="text-gray-600">CA:</span> <span className="font-semibold">{uniform.ca_number}</span>
                  </div>
                )}

                {uniform.color && (
                  <div className="text-sm">
                    <span className="text-gray-600">Cor:</span> {uniform.color}
                  </div>
                )}
                
                {uniform.material && (
                  <div className="text-sm">
                    <span className="text-gray-600">Material:</span> {uniform.material}
                  </div>
                )}
                
                {uniform.observations && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {uniform.observations.length > 100 
                      ? `${uniform.observations.substring(0, 100)}...` 
                      : uniform.observations
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}