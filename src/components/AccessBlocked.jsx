
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Crown, Check, Star, ArrowLeft, TrendingUp, Shield, Users, Zap } from 'lucide-react';
import PaymentStatusChecker from './PaymentStatusChecker';
import { BRAND } from '@/components/common/Branding';

export default function AccessBlocked({ user, onSubscriptionUpdate }) {

  const handleBackToDashboard = () => {
    window.location.href = window.location.origin + "/Dashboard";
  };

  const plans = [
    {
      id: 'essencial',
      name: 'Essencial',
      price: 'R$ 997',
      period: '/mês',
      description: 'Perfeito para pequenas empresas',
      icon: Shield,
      features: [
        'Até 10 contratos ativos',
        'Até 5 usuários do sistema',
        'Funcionários ilimitados',
        'Gestão financeira completa',
        'Relatórios essenciais',
        'Suporte via email'
      ],
      paymentUrl: 'https://pay.cakto.com.br/m54dwcn',
      popular: false,
      gradient: 'from-green-500 to-emerald-600'
    },
    {
      id: 'avancado',
      name: 'Avançado',
      price: 'R$ 1.497',
      period: '/mês',
      description: 'Ideal para empresas em crescimento',
      icon: TrendingUp,
      features: [
        'Até 20 contratos ativos',
        'Até 10 usuários do sistema',
        'Funcionários ilimitados',
        'Todos os módulos incluídos',
        'Relatórios avançados',
        'Controle patrimonial completo',
        'Suporte prioritário'
      ],
      paymentUrl: 'https://pay.cakto.com.br/avancado',
      popular: true,
      gradient: 'from-blue-500 to-indigo-600'
    },
    {
      id: 'pro',
      name: 'Enterprise',
      price: 'Sob consulta',
      period: '',
      description: 'Para grandes operações',
      icon: Crown,
      features: [
        'Contratos ilimitados',
        'Usuários ilimitados',
        'Funcionários ilimitados',
        'Integrações customizadas',
        'Relatórios personalizados',
        'API exclusiva',
        'Suporte 24/7 dedicado',
        'Gerente de conta exclusivo'
      ],
      paymentUrl: `https://wa.me/5561999887766?text=Olá! Gostaria de conhecer o plano Enterprise do ${BRAND.name}`,
      popular: false,
      gradient: 'from-purple-500 to-pink-600'
    }
  ];

  const handlePlanSelection = (plan) => {
    if (plan.id === 'pro') {
      window.open(plan.paymentUrl, '_blank');
    } else {
      window.open(plan.paymentUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        {/* Header Hero */}
        <Card className="shadow-2xl border-0 overflow-hidden mb-8">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-700 to-purple-800 p-8 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-black bg-opacity-10"></div>
              <div className="relative z-10">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <Building2 className="w-10 h-10" />
                  </div>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">{BRAND.name}</h1>
                <p className="text-xl text-blue-100 mb-6">A Plataforma Completa para Gestão de Facilities</p>
                <div className="flex justify-center mb-6">
                  <Button
                    onClick={handleBackToDashboard}
                    variant="outline"
                    className="bg-white bg-opacity-20 border-white border-opacity-30 text-white hover:bg-white hover:bg-opacity-30 backdrop-blur-sm"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Tentar Acessar Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Checker */}
        <Card className="shadow-lg mb-8">
          <CardContent className="p-6">
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
              <PaymentStatusChecker onStatusUpdate={onSubscriptionUpdate} />
            </div>
          </CardContent>
        </Card>

        {/* Planos */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Escolha o Plano Ideal para Sua Empresa
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transforme a gestão dos seus contratos de facilities com nossa plataforma completa e intuitiva
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const IconComponent = plan.icon;
              return (
                <Card
                  key={plan.id}
                  className={`relative hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${
                    plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 text-sm font-semibold">
                        <Star className="w-3 h-3 mr-1" />
                        Mais Escolhido
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-8">
                    {/* Header do Plano */}
                    <div className="text-center mb-8">
                      <div className={`w-16 h-16 bg-gradient-to-r ${plan.gradient} rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                      <p className="text-gray-600 mb-4">{plan.description}</p>
                      <div className="mb-6">
                        <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                        {plan.period && <span className="text-lg text-gray-500 ml-1">{plan.period}</span>}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="mb-8">
                      <ul className="space-y-3">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start text-sm">
                            <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA Button */}
                    <Button
                      className={`w-full py-4 text-lg font-semibold bg-gradient-to-r ${plan.gradient} hover:opacity-90 shadow-lg transform transition-all duration-200 hover:scale-105`}
                      onClick={() => handlePlanSelection(plan)}
                    >
                      {plan.id === 'pro' ? 'Falar com Consultor' : `Escolher ${plan.name}`}
                      <Zap className="w-5 h-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Teste Gratuito */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-8 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-green-800 mb-4">
                Teste Gratuito por 7 Dias Completos
              </h3>
              <p className="text-green-700 text-lg mb-6 max-w-2xl mx-auto">
                Experimente todos os recursos do {BRAND.name} sem compromisso. 
                Comece hoje mesmo a transformar sua gestão de facilities!
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">✓ Sem cartão de crédito</span>
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">✓ Acesso completo</span>
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">✓ Suporte incluído</span>
              </div>
              <Button 
                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white text-lg font-semibold px-8 py-4 shadow-lg"
                onClick={() => onSubscriptionUpdate()}
              >
                <Users className="w-5 h-5 mr-2" />
                Iniciar Teste Gratuito Agora
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            © 2025 {BRAND.name} - Facilitando sua gestão com tecnologia e inovação
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Plataforma segura • Dados criptografados • Suporte especializado
          </p>
        </div>
      </div>
    </div>
  );
}
