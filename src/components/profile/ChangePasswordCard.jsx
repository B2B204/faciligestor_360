import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function PasswordInput({ id, label, value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="pr-10"
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-10 text-muted-foreground"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function ChangePasswordCard({ email }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setFeedback(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);

    if (form.newPassword.length < 8) {
      setFeedback({ type: "error", message: "A nova senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ type: "error", message: "A confirmação não corresponde à nova senha." });
      return;
    }
    if (form.currentPassword === form.newPassword) {
      setFeedback({ type: "error", message: "A nova senha deve ser diferente da senha atual." });
      return;
    }

    setIsSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: form.currentPassword,
      });

      if (signInError) {
        setFeedback({ type: "error", message: "A senha atual está incorreta." });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: form.newPassword,
      });
      if (updateError) throw updateError;

      setForm(EMPTY_FORM);
      setFeedback({ type: "success", message: "Senha alterada com sucesso." });
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      setFeedback({
        type: "error",
        message: error?.message?.toLowerCase().includes("same password")
          ? "A nova senha deve ser diferente da senha atual."
          : "Não foi possível alterar a senha. Tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyRound className="mr-3 h-6 w-6 text-blue-600" />
          Segurança da conta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
          <p className="text-sm text-muted-foreground">
            Para sua segurança, confirme a senha atual antes de definir uma nova senha.
          </p>

          <PasswordInput
            id="current-password"
            label="Senha atual"
            value={form.currentPassword}
            onChange={updateField("currentPassword")}
            autoComplete="current-password"
          />
          <PasswordInput
            id="new-password"
            label="Nova senha"
            value={form.newPassword}
            onChange={updateField("newPassword")}
            autoComplete="new-password"
          />
          <PasswordInput
            id="confirm-password"
            label="Confirmar nova senha"
            value={form.confirmPassword}
            onChange={updateField("confirmPassword")}
            autoComplete="new-password"
          />

          <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres.</p>

          {feedback && (
            <div
              role={feedback.type === "error" ? "alert" : "status"}
              className={`rounded-md border px-3 py-2 text-sm ${
                feedback.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                  : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <Button type="submit" disabled={isSaving || !email}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
