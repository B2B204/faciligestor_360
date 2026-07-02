
import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { PartnershipClick } from "@/entities/PartnershipClick";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, MessageCircle } from "lucide-react";
import { BRAND } from "@/components/common/Branding";

export default function MarketingPage() {
  const [user, setUser] = useState(null);
  useEffect(()=>{ (async()=> setUser(await User.me()))(); },[]);
  const handleClick = async () => {
    if (!user) return;
    await PartnershipClick.create({
      partner_code:"LICITAFORGE",
      user_email: user.email,
      cnpj: user.cnpj,
      clicked_at: new Date().toISOString()
    });
    window.open(`https://wa.me/5599999999999?text=Olá%20LICITAFORGE%2C%20sou%20cliente%20${encodeURIComponent(BRAND.name)}`, "_blank");
  };
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" /> Marketing & Parcerias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Ferramentas e parceiros para impulsionar seu negócio.</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <Rocket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-lg">Consultoria de Licitações — LICITAFORGE</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Apoio completo para participar e vencer licitações, com análise de edital, documentação e estratégia de preço.
                </p>
                <Button onClick={handleClick} className="mt-4">
                  <MessageCircle className="w-4 h-4 mr-2" /> Falar com a LICITAFORGE
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
