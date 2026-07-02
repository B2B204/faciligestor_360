import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle } from 'lucide-react';

export default function DeleteConfirmation({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Tem certeza?", 
  description = "Esta ação não pode ser desfeita.",
  itemName = "",
  isPermanent = false // Adicionado para diferenciar soft delete de hard delete
}) {
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFirstConfirm = () => {
    if (isPermanent) {
      setShowFinalConfirm(true);
    } else {
      handleFinalConfirm(); // Para soft delete, não precisa do segundo modal
    }
  };

  const handleFinalConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Erro ao excluir:', error);
    } finally {
      setIsDeleting(false);
      setShowFinalConfirm(false);
      onClose();
    }
  };

  const handleCancel = () => {
    setShowFinalConfirm(false);
    onClose();
  };

  const MainModal = () => (
    <AlertDialog open={isOpen && !showFinalConfirm} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center">
            <Trash2 className="w-5 h-5 mr-2 text-red-600" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description} {itemName ? `"${itemName}"` : ''}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleFirstConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const FinalConfirmModal = () => (
    <AlertDialog open={showFinalConfirm} onOpenChange={handleCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center text-red-600">
            <AlertTriangle className="w-6 h-6 mr-2" />
            Confirmar Exclusão Permanente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-red-800 font-medium">
            ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!
            <br />
            <br />
            Você está prestes a excluir permanentemente {itemName ? `"${itemName}"` : 'este item'}. 
            Os dados serão perdidos para sempre.
            <br />
            <br />
            Tem certeza absoluta que deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleFinalConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? 'Excluindo...' : 'EXCLUIR PERMANENTEMENTE'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      <MainModal />
      {isPermanent && <FinalConfirmModal />}
    </>
  );
}