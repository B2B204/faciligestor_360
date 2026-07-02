import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Printer } from 'lucide-react';

const QrCodeLabel = ({ patrimony, user, size }) => {
  const code = patrimony.qr_code || patrimony.serial_number;
  if (!code) return null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size*4}x${size*4}&data=${encodeURIComponent(code)}`;

  return (
    <div
      className="qr-label-container"
      style={{
        width: `${size}mm`,
        height: `${size}mm`,
        padding: '2mm',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed #ccc',
        fontFamily: 'Arial, sans-serif',
        breakInside: 'avoid',
      }}
    >
      <img src={qrUrl} alt={`QR Code ${code}`} style={{ maxWidth: '80%', maxHeight: '60%' }} />
      <div style={{ fontSize: '7px', textAlign: 'center', marginTop: '1mm', lineHeight: '1.2' }}>
        <p style={{ margin: 0, fontWeight: 'bold' }}>Cód: {code}</p>
        <p style={{ margin: 0 }}>{patrimony.equipment_name}</p>
        <p style={{ margin: 0, fontStyle: 'italic', paddingTop: '0.5mm' }}>{user?.company_name || 'Empresa'}</p>
      </div>
    </div>
  );
};


export default function QrCodeGenerator({ isOpen, onClose, patrimonies, user, onConfirm }) {
  const [size, setSize] = useState('40'); // default size 40mm

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const labelsHtml = document.getElementById('qr-labels-printable').innerHTML;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Codes</title>
          <style>
            @media print {
              body {
                margin: 1cm;
              }
              @page {
                size: A4;
                margin: 1cm;
              }
              .qr-labels-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(${size}mm, 1fr));
                gap: 2mm;
              }
              .qr-label-container {
                 page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-labels-grid">
            ${labelsHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    onConfirm();
  };

  const patrimonyList = Array.isArray(patrimonies) ? patrimonies : [patrimonies];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Gerar e Imprimir QR Codes</DialogTitle>
        </DialogHeader>
        
        <div className="my-4">
          <Label htmlFor="qr-size">Tamanho da Etiqueta</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger id="qr-size" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30mm x 30mm</SelectItem>
              <SelectItem value="40">40mm x 40mm</SelectItem>
              <SelectItem value="50">50mm x 50mm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div 
          id="qr-labels-printable" 
          className="p-4 border rounded-lg bg-gray-50 max-h-[50vh] overflow-y-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, ${size}mm)`,
            gap: '2mm',
            justifyContent: 'center',
          }}
        >
          {patrimonyList.map(p => (
            <QrCodeLabel key={p.id} patrimony={p} user={user} size={parseInt(size)} />
          ))}
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}