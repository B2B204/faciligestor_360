import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserInvite } from "@/entities/UserInvite";
import { TeamMember } from "@/entities/TeamMember";
import { User } from "@/entities/User";
import {
  UserPlus, AlertCircle, CheckCircle, Loader2, Copy, Check,
  Link2, MessageCircle, Mail, Clock, Building2
} from "lucide-react";

const DEPT_LABELS = {
  admin: "Administrador",
  gestor: "Gestor",
  financeiro: "Financeiro",
  rh: "RH",
  operador: "Visualização",
};

function generateCode() {
  return `INV-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

export default function UserInviteModal({ isOpen, onClose, currentUser, onSuccess }) {
  const [form, setForm] = useState({ full_name: "", email: "", department: "operador" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setForm({ full_name: "", email: "", department: "operador" });
    setError("");
    setInviteLink("");
    setCopied(false);
  };

  const handleClose = () => {
    if (inviteLink) onSuccess?.();
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const email = form.email.toLowerCase().trim();
      if (!form.full_name.trim() || !email.includes("@")) {
        throw new Error("Preencha nome e e-mail válidos.");
      }

      const [existingUsers, existingMembers, pendingInvites] = await Promise.all([
        User.filter({ email, cnpj: currentUser.cnpj }),
        TeamMember.filter({ email, cnpj: currentUser.cnpj }),
        UserInvite.filter({ email, cnpj: currentUser.cnpj, status: "pendente" }),
      ]);

      if (existingUsers.length > 0 || existingMembers.length > 0) {
        throw new Error("Este e-mail já faz parte da equipe.");
      }

      const validPending = pendingInvites.filter(i => new Date(i.expires_at) > new Date());
      if (validPending.length > 0) {
        // Reuse existing link
        const code = validPending[0].invite_code;
        setInviteLink(`${window.location.origin}/accept-invite?code=${code}`);
        setSaving(false);
        return;
      }

      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await UserInvite.create({
        full_name: form.full_name,
        email,
        department: form.department,
        invite_code: code,
        status: "pendente",
        invited_by: currentUser.email,
        cnpj: currentUser.cnpj,
        expires_at: expiresAt.toISOString(),
      });

      setInviteLink(`${window.location.origin}/accept-invite?code=${code}`);
    } catch (err) {
      setError(err.message || "Erro ao criar convite. Tente novamente.");
    }
    setSaving(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Olá ${form.full_name}! Você foi convidado(a) para acessar o FaciliGestor360.\n\nClique no link abaixo para criar sua conta e já ficar vinculado à empresa:\n${inviteLink}\n\n⏰ O link expira em 7 dias.`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent("Convite — FaciliGestor360");
    const body = encodeURIComponent(
      `Olá ${form.full_name},\n\nVocê foi convidado(a) para acessar o FaciliGestor360.\n\nClique no link abaixo para criar sua conta:\n${inviteLink}\n\nO link expira em 7 dias.\n\nAtenciosamente,\n${currentUser?.full_name || "Administrador"}`
    );
    window.open(`mailto:${form.email}?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Convidar Membro da Equipe
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            O usuário receberá um link para criar a conta já vinculada à sua empresa.
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          /* ── Success state ── */
          <div className="space-y-5 pt-2">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Convite criado!</p>
                <p className="text-sm text-muted-foreground">
                  Envie o link abaixo para <strong>{form.full_name}</strong>.
                </p>
              </div>
            </div>

            {/* Info card */}
            <div className="bg-muted/50 rounded-lg p-3 border border-border space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Função:</span>
                <span className="font-medium text-foreground">{DEPT_LABELS[form.department] || form.department}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Válido por:</span>
                <span className="font-medium text-foreground">7 dias</span>
              </div>
            </div>

            {/* Link box */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Link de convite
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteLink}
                  className="bg-background border-border text-xs font-mono text-muted-foreground flex-1"
                />
                <Button
                  size="sm"
                  variant={copied ? "secondary" : "outline"}
                  onClick={handleCopy}
                  className="gap-1.5 shrink-0"
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copiado</>
                    : <><Copy className="w-3.5 h-3.5" /> Copiar</>
                  }
                </Button>
              </div>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleWhatsApp}
                variant="outline"
                className="gap-2 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
              <Button
                onClick={handleEmail}
                variant="outline"
                className="gap-2"
              >
                <Mail className="w-4 h-4" />
                E-mail
              </Button>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { onSuccess?.(); reset(); }}>
                Criar outro
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          /* ── Form state ── */
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-sm font-medium text-foreground">Nome completo *</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={e => setForm(s => ({ ...s, full_name: e.target.value }))}
                placeholder="Ex: João Silva"
                className="bg-background border-border"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                placeholder="joao@empresa.com"
                className="bg-background border-border"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Função *</Label>
              <Select
                value={form.department}
                onValueChange={v => setForm(s => ({ ...s, department: v }))}
                disabled={saving}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="operador">Visualização</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <Link2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Um link único será gerado. Ao clicar, o usuário apenas digita uma senha e já fica vinculado à sua empresa — sem precisar preencher nada mais.
              </span>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                  : <><Link2 className="w-4 h-4" /> Gerar link de convite</>
                }
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
