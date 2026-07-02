import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScanLine, AlertCircle } from 'lucide-react';
import { findAssetByCode } from '@/lib/assetTracking';

export default function AssetLookupDialog({ open, onOpenChange, patrimonies, onFound }) {
  const [code, setCode] = useState('');
  const [notFound, setNotFound] = useState(false);

  const handleSearch = () => {
    const asset = findAssetByCode(patrimonies, code);
    if (asset) {
      setNotFound(false);
      setCode('');
      onFound(asset);
    } else {
      setNotFound(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setCode(''); setNotFound(false); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" /> Consultar Ativo por Código
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="asset-code">Código do QR ou Número de Série</Label>
          <Input
            id="asset-code"
            autoFocus
            placeholder="Ex: AST-00012"
            value={code}
            onChange={(e) => { setCode(e.target.value); setNotFound(false); }}
            onKeyDown={handleKeyDown}
          />
          <p className="text-xs text-muted-foreground">
            Digite o código impresso na etiqueta (não é necessário escanear a câmera).
          </p>
          {notFound && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> Nenhum ativo encontrado com esse código.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSearch} disabled={!code.trim()}>Buscar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
