import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function PaymentStatusChecker({ onStatusUpdate }) {
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    
    // Simular verificação de status
    setTimeout(() => {
      setIsChecking(false);
      setLastChecked(new Date().toLocaleTimeString());
      
      // Callback para atualizar status no componente pai
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    }, 2000);
  };

  return (
    <div className="text-center">
      <div className="mb-4">
        <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Verificação de Status do Pagamento
        </h3>
        <p className="text-gray-600 text-sm">
          Se você acabou de efetuar o pagamento, clique no botão abaixo para verificar se foi processado.
        </p>
      </div>

      <Button
        onClick={handleCheckStatus}
        disabled={isChecking}
        className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white"
      >
        {isChecking ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Verificando Status...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Verificar Status do Pagamento
          </>
        )}
      </Button>

      {lastChecked && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center text-sm text-blue-800">
            <AlertCircle className="w-4 h-4 mr-1" />
            Última verificação: {lastChecked}
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Se o pagamento foi aprovado recentemente, pode levar alguns minutos para ser processado.
          </p>
        </div>
      )}

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="text-sm text-yellow-800">
          <p className="font-medium mb-1">💡 Dica Importante:</p>
          <p>
            Após o pagamento ser confirmado pelo FaciliGestor360, seu acesso será liberado automaticamente. 
            Geralmente o processo leva de 2 a 10 minutos.
          </p>
        </div>
      </div>
    </div>
  );
}