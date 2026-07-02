import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export default function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <svg
                className="w-5 h-5 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">FaciliGestor360</p>
        </div>

        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Icon + Title */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Você não tem permissão para visualizar esta página.
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center">
              Seu perfil de usuário atual não inclui acesso a este módulo. Se você acredita que isso é um erro, entre em contato com o administrador do sistema.
            </p>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => navigate(createPageUrl("Dashboard"))}
              >
                <Home className="w-4 h-4" />
                Voltar para o Dashboard
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-4 h-4" />
                Página anterior
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Código de erro: <span className="font-mono font-medium">403 — Forbidden</span>
        </p>
      </div>
    </div>
  );
}
