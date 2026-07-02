import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "@/entities/User";
import { Code, Send } from "lucide-react";

// Componente apenas para demonstração/teste - remover em produção
export default function WebhookTestingPanel({ user, onSuccess }) {
  const [testData, setTestData] = useState({
    cnpj: user?.cnpj || "",
    email: user?.email || "",
    plano: "essencial",
    status: "active"
  });
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    try {
      // Simular o que o webhook faria: atualizar o usuário
      await User.updateMyUserData({
        plan: testData.plano,
        plan_status: testData.status
      });
      
      alert("✅ Simulação de webhook executada com sucesso!");
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Erro na simulação:", error);
      alert("❌ Erro na simulação do webhook");
    }
    setIsTesting(false);
  };

  return (
    <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Code className="w-5 h-5" />
          Painel de Teste - Webhook
        </CardTitle>
        <p className="text-sm text-blue-700">
          Para demonstração: Simula o webhook que será enviado pela Cakto
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="test-cnpj">CNPJ</Label>
            <Input
              id="test-cnpj"
              value={testData.cnpj}
              onChange={(e) => setTestData(prev => ({ ...prev, cnpj: e.target.value }))}
              placeholder="12345678000199"
            />
          </div>
          <div>
            <Label htmlFor="test-email">Email</Label>
            <Input
              id="test-email"
              value={testData.email}
              onChange={(e) => setTestData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="cliente@empresa.com"
            />
          </div>
          <div>
            <Label>Plano</Label>
            <Select value={testData.plano} onValueChange={(value) => setTestData(prev => ({ ...prev, plano: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="essencial">Essencial</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={testData.status} onValueChange={(value) => setTestData(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-gray-100 p-3 rounded text-sm font-mono">
          <strong>Payload simulado:</strong>
          <pre>{JSON.stringify(testData, null, 2)}</pre>
        </div>

        <Button onClick={handleTest} disabled={isTesting} className="w-full">
          {isTesting ? (
            "Simulando..."
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Simular Webhook de Ativação
            </>
          )}
        </Button>

        <div className="bg-yellow-50 p-3 rounded text-sm border border-yellow-200">
          <strong>⚠️ Nota:</strong> Este painel é apenas para demonstração. 
          Em produção, a ativação será feita automaticamente pelo webhook da Cakto.
        </div>
      </CardContent>
    </Card>
  );
}