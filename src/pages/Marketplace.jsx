import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, FileSignature, BarChart, Briefcase, Bot, ShieldCheck } from 'lucide-react';

const services = [
  {
    icon: FileSignature,
    title: "Assinatura Digital (Clicksign/D4Sign)",
    description: "Envie recibos e medições para assinatura digital diretamente do sistema.",
    price: "A partir de R$ 99/mês",
    category: "Integração",
    premium: true,
  },
  {
    icon: Fingerprint,
    title: "Emissão de Certidões Automatizada",
    description: "Consulta e emissão automática de CNDs e outras certidões.",
    price: "R$ 79/mês",
    category: "Automação",
  },
  {
    icon: BarChart,
    title: "Módulo de Business Intelligence",
    description: "Dashboards avançados e relatórios personalizados para uma visão estratégica.",
    price: "R$ 149/mês",
    category: "Análise",
    premium: true,
  },
  {
    icon: Briefcase,
    title: "Integração com ERP (Omie/Conta Azul)",
    description: "Sincronize dados financeiros e fiscais com seu sistema de gestão.",
    price: "Sob consulta",
    category: "Integração",
    premium: true,
  },
  {
    icon: Bot,
    title: "Auditoria com Inteligência Artificial",
    description: "Rotinas de IA que verificam inconsistências e sugerem melhorias em seus contratos.",
    price: "R$ 199/mês",
    category: "Automação",
  },
   {
    icon: ShieldCheck,
    title: "Gestão de Treinamentos (NRs)",
    description: "Controle vencimentos e certificados de treinamentos obrigatórios para sua equipe.",
    price: "R$ 59/mês",
    category: "RH",
  }
];

export default function MarketplacePage() {
  const handlePurchase = (serviceTitle) => {
    alert(`O serviço "${serviceTitle}" é um recurso premium. A integração real requer a ativação de um plano superior e/ou configuração de backend. Entre em contato com nosso suporte para saber mais.`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> Marketplace de Serviços
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Turbine seu FaciliGestor360 com integrações e módulos poderosos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service, index) => (
          <Card key={index} className="bg-card border-border shadow-sm flex flex-col hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 bg-primary/10 rounded-lg flex items-center justify-center">
                  <service.icon className="w-5 h-5 text-primary" />
                </div>
                {service.premium && (
                  <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0 text-xs">
                    Plano Pro
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base font-semibold text-foreground leading-snug">{service.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <p className="text-muted-foreground text-sm">{service.description}</p>
              <div className="flex justify-between items-center">
                <Badge variant="outline" className="border-border text-muted-foreground text-xs">{service.category}</Badge>
                <span className="font-semibold text-foreground text-sm">{service.price}</span>
              </div>
            </CardContent>
            <div className="p-6 pt-0">
              <Button className="w-full" onClick={() => handlePurchase(service.title)}>
                Adicionar ao meu sistema
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}