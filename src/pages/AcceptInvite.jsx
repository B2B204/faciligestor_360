import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserInvite } from "@/entities/UserInvite";
import { TeamMember } from "@/entities/TeamMember";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, AlertTriangle, CheckCircle, PartyPopper,
  Mail, UserCheck, ArrowRight, Lock, Eye, EyeOff, Building2
} from "lucide-react";

const DEPT_LABELS = {
  admin: "Administrador",
  gestor: "Gestor",
  financeiro: "Financeiro",
  rh: "RH",
  operador: "Visualização",
};

export default function AcceptInvite() {
  const location = useLocation();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("loading"); // loading | form | creating | success | invalid | expired | error
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isExistingUser, setIsExistingUser] = useState(false);

  useEffect(() => {
    const validate = async () => {
      const code = new URLSearchParams(location.search).get("code");
      if (!code) { setPhase("invalid"); setErrorMsg("Código de convite não encontrado."); return; }

      try {
        const [inv] = await UserInvite.filter({ invite_code: code, status: "pendente" });
        if (!inv) { setPhase("invalid"); setErrorMsg("Convite inválido ou já utilizado."); return; }
        if (new Date() > new Date(inv.expires_at)) {
          await UserInvite.update(inv.id, { status: "expirado" });
          setPhase("expired"); setErrorMsg("Este convite expirou. Solicite um novo ao administrador."); return;
        }
        setInvite(inv);
        setPhase("form");
      } catch {
        setPhase("error"); setErrorMsg("Erro ao validar convite. Tente novamente.");
      }
    };
    validate();
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) { setErrorMsg("A senha deve ter pelo menos 8 caracteres."); return; }
    if (!isExistingUser && password !== confirmPassword) { setErrorMsg("As senhas não coincidem."); return; }

    setPhase("creating");

    try {
      let userId;

      if (isExistingUser) {
        // User already has an account — just log in and link
        const { data, error } = await supabase.auth.signInWithPassword({
          email: invite.email,
          password,
        });
        if (error) throw new Error("Senha incorreta. Verifique e tente novamente.");
        userId = data.user.id;
      } else {
        // Create new account
        const { data, error } = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: {
            data: {
              full_name: invite.full_name,
              department: invite.department,
              cnpj: invite.cnpj,
            },
          },
        });

        if (error) {
          // Account already exists — prompt to log in instead
          if (error.message?.toLowerCase().includes("already") || error.status === 400) {
            setIsExistingUser(true);
            setPhase("form");
            setErrorMsg("Este e-mail já possui uma conta. Digite sua senha atual para vincular à empresa.");
            return;
          }
          throw error;
        }

        userId = data.user?.id;
      }

      // Link profile to company CNPJ
      if (userId) {
        await supabase
          .from("profiles")
          .update({
            full_name: invite.full_name,
            department: invite.department,
            cnpj: invite.cnpj,
            is_active: true,
          })
          .eq("id", userId);
      }

      // Create / update TeamMember
      const existingMembers = await TeamMember.filter({ email: invite.email, cnpj: invite.cnpj });
      const memberData = {
        full_name: invite.full_name,
        email: invite.email,
        department: invite.department,
        cnpj: invite.cnpj,
        status: "ativo",
        created_by: invite.invited_by,
      };
      if (existingMembers.length > 0) {
        await TeamMember.update(existingMembers[0].id, memberData);
      } else {
        await TeamMember.create(memberData);
      }

      // Mark invite as accepted
      await UserInvite.update(invite.id, { status: "aceito" });

      setPhase("success");

      // Redirect to app after 2s (user is now logged in)
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setPhase("form");
      setErrorMsg(err.message || "Erro ao criar conta. Tente novamente.");
    }
  };

  const renderContent = () => {
    if (phase === "loading") return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <p className="font-semibold text-foreground">Validando convite…</p>
      </div>
    );

    if (phase === "creating") return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <p className="font-semibold text-foreground">Criando sua conta…</p>
        <p className="text-sm text-muted-foreground">Vinculando à empresa, aguarde.</p>
      </div>
    );

    if (phase === "success") return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Conta criada com sucesso!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Você já está vinculado à empresa. Redirecionando…
          </p>
        </div>
        <div className="w-full p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            Bem-vindo, <strong>{invite?.full_name}</strong>! Acesso liberado como <strong>{DEPT_LABELS[invite?.department] || invite?.department}</strong>.
          </p>
        </div>
      </div>
    );

    if (phase === "invalid" || phase === "expired" || phase === "error") return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {phase === "expired" ? "Convite Expirado" : "Convite Inválido"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/login")}>
          Voltar para o Login
        </Button>
      </div>
    );

    // phase === "form"
    return (
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <PartyPopper className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mt-3">
            {isExistingUser ? "Vincular à empresa" : "Você foi convidado!"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isExistingUser
              ? "Entre com sua senha para vincular sua conta à empresa."
              : "Crie sua senha para acessar o sistema já vinculado à empresa."}
          </p>
        </div>

        <Separator className="bg-border" />

        {/* Invite info */}
        <div className="bg-muted/50 rounded-lg p-4 border border-border space-y-2.5">
          <div className="flex items-center gap-3">
            <UserCheck className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="font-semibold text-foreground text-sm">{invite?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="font-medium text-foreground text-sm">{invite?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Função</p>
              <p className="font-medium text-foreground text-sm capitalize">
                {DEPT_LABELS[invite?.department] || invite?.department}
              </p>
            </div>
          </div>
        </div>

        {/* Password field */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            {isExistingUser ? "Sua senha atual" : "Criar senha"}
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isExistingUser ? "Sua senha" : "Mínimo 8 caracteres"}
              className="pl-9 pr-10 bg-background border-border"
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm password (only for new users) */}
        {!isExistingUser && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-sm font-medium text-foreground">Confirmar senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="pl-9 pr-10 bg-background border-border"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{errorMsg}</p>
          </div>
        )}

        <Button type="submit" className="w-full gap-2" size="lg">
          {isExistingUser ? "Entrar e vincular à empresa" : "Criar conta e entrar"}
          <ArrowRight className="w-4 h-4" />
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Ao continuar você concorda com os termos de uso do FaciliGestor360.
        </p>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        {/* Brand */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">FaciliGestor360</p>
        </div>

        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-6 sm:p-8">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
