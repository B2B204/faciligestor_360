import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { BRAND } from "@/components/common/Branding";

export const PRIVACY_POLICY_VERSION = "1.0";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          Versão {PRIVACY_POLICY_VERSION} — em vigor a partir de {new Date().toLocaleDateString('pt-BR')}.
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <p>
            Esta Política de Privacidade descreve como o <strong>{BRAND.name}</strong> coleta, usa, armazena
            e protege dados pessoais, em conformidade com a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 — LGPD).
          </p>

          <section>
            <h2 className="font-semibold text-foreground mb-1">1. Quais dados coletamos</h2>
            <p>
              Para operar o sistema de gestão de facilities, tratamos dados pessoais de usuários da
              plataforma (nome, e-mail, telefone, foto) e de colaboradores das empresas clientes
              cadastrados por seus administradores (nome, CPF, endereço, dados bancários/PIX, dados de
              saúde relacionados a benefícios, informações de uniformes e EPIs), além de dados de
              contratos, contatos comerciais e informações financeiras necessárias à operação do sistema.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-1">2. Finalidade e base legal</h2>
            <p>
              Os dados são tratados para: (i) execução do contrato de uso da plataforma; (ii) cumprimento
              de obrigações legais e regulatórias (trabalhistas, fiscais e de segurança do trabalho — NR-6);
              (iii) legítimo interesse na gestão administrativa e financeira das empresas usuárias; e
              (iv) consentimento do titular, quando aplicável (ex.: dados de saúde vinculados a benefícios).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-1">3. Compartilhamento</h2>
            <p>
              Não vendemos dados pessoais. Dados podem ser compartilhados com provedores de infraestrutura
              estritamente necessários à operação do sistema (hospedagem e banco de dados) e, quando
              exigido, com autoridades públicas competentes.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-1">4. Direitos do titular</h2>
            <p>
              Nos termos do art. 18 da LGPD, o titular pode solicitar a confirmação da existência de
              tratamento, acesso, correção, portabilidade, exclusão ou anonimização de seus dados, além de
              informações sobre o compartilhamento e a revogação do consentimento. Solicitações podem ser
              feitas pela seção "Meus Dados" no Perfil (para usuários da plataforma) ou diretamente ao
              administrador da empresa responsável pelo cadastro (para colaboradores).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-1">5. Segurança e retenção</h2>
            <p>
              Adotamos controles de acesso por empresa (isolamento multi-tenant), autenticação individual e
              registro de auditoria de acesso a dados sensíveis. Os dados são mantidos pelo período
              necessário às finalidades descritas ou pelo prazo exigido por lei, podendo ser excluídos ou
              anonimizados mediante solicitação, quando não houver impedimento legal.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-1">6. Contato</h2>
            <p>
              Dúvidas sobre esta política ou sobre o tratamento de dados pessoais podem ser encaminhadas ao
              administrador da conta da sua empresa dentro da plataforma.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
