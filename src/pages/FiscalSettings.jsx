import React, { useEffect, useState } from 'react';
import { User } from '@/entities/User';
import { FiscalSettings as FiscalSettingsEntity } from '@/entities/FiscalSettings';
import { UploadPrivateFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Shield, Upload, CheckCircle, AlertTriangle, Loader2, KeyRound, FileKey } from 'lucide-react';

export default function FiscalSettings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prodPass, setProdPass] = useState('');
  const [hmlPass, setHmlPass] = useState('');
  const [env, setEnv] = useState('homologacao');

  const load = async () => {
    const me = await User.me();
    setUser(me);
    const all = await FiscalSettingsEntity.filter({}, '-updated_date', 1);
    const s = all[0] || { environment: 'homologacao', cnpj: me?.cnpj };
    setSettings(s);
    setEnv(s.environment || 'homologacao');
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const uploadPfx = async (file, which) => {
    const { file_uri } = await UploadPrivateFile({ file });
    const now = new Date().toISOString();
    const update = which === 'prod' ? { prod_pfx_uri: file_uri, prod_pfx_uploaded_at: now } : { hml_pfx_uri: file_uri, hml_pfx_uploaded_at: now };
    const body = { ...settings, ...update, environment: env, cnpj: user?.cnpj };
    if (settings?.id) {
      const res = await FiscalSettingsEntity.update(settings.id, body);
      setSettings(res);
    } else {
      const res = await FiscalSettingsEntity.create(body);
      setSettings(res);
    }
    alert('Certificado enviado com sucesso.');
  };

  const savePasswords = async () => {
    setSaving(true);
    const body = { ...settings, environment: env, cnpj: user?.cnpj };
    if (prodPass) body.prod_pfx_password = prodPass;
    if (hmlPass) body.hml_pfx_password = hmlPass;
    const res = settings?.id ? await FiscalSettingsEntity.update(settings.id, body) : await FiscalSettingsEntity.create(body);
    setSettings(res);
    setProdPass(''); setHmlPass(''); setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando configurações fiscais...</p>
        </div>
      </div>
    );
  }

  if (!user?.cnpj) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-background flex items-center justify-center">
        <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg max-w-md w-full">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Defina seu CNPJ no Perfil para continuar com as configurações fiscais.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-background min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Configurações Fiscais
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie certificados digitais A1 e configurações do ambiente fiscal.
          </p>
        </div>
        <Button onClick={savePasswords} disabled={saving} className="gap-2 shrink-0">
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
          ) : (
            <><Upload className="w-4 h-4" />Salvar Configurações</>
          )}
        </Button>
      </div>

      {/* Environment selector */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Ambiente Fiscal
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Selecione se deseja operar em homologação (testes) ou produção (real).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-xs space-y-1">
            <Label className="text-sm font-medium text-foreground">Ambiente Ativo</Label>
            <Select value={env} onValueChange={setEnv}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Em homologação, as notas não têm validade fiscal real.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Certificates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Production Certificate */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileKey className="w-5 h-5 text-primary" />
              Certificado de Produção
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Certificado A1 para emissão de notas fiscais reais.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">Arquivo .pfx</Label>
              <Input
                type="file"
                accept=".pfx"
                className="bg-background border-border cursor-pointer"
                onChange={e => e.target.files?.[0] && uploadPfx(e.target.files[0], 'prod')}
              />
              {settings?.prod_pfx_uri ? (
                <div className="flex gap-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-800 dark:text-green-300">
                    Enviado em {new Date(settings.prod_pfx_uploaded_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum certificado enviado.</p>
              )}
            </div>
            <Separator className="bg-border" />
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Senha do Certificado
              </Label>
              <Input
                type="password"
                value={prodPass}
                onChange={e => setProdPass(e.target.value)}
                placeholder="••••••••"
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">Deixe em branco para manter a senha atual.</p>
            </div>
          </CardContent>
        </Card>

        {/* Homologation Certificate */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileKey className="w-5 h-5 text-muted-foreground" />
              Certificado de Homologação
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Certificado A1 para testes no ambiente de homologação.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground">Arquivo .pfx</Label>
              <Input
                type="file"
                accept=".pfx"
                className="bg-background border-border cursor-pointer"
                onChange={e => e.target.files?.[0] && uploadPfx(e.target.files[0], 'hml')}
              />
              {settings?.hml_pfx_uri ? (
                <div className="flex gap-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-800 dark:text-green-300">
                    Enviado em {new Date(settings.hml_pfx_uploaded_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum certificado enviado.</p>
              )}
            </div>
            <Separator className="bg-border" />
            <div className="space-y-1">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Senha do Certificado
              </Label>
              <Input
                type="password"
                value={hmlPass}
                onChange={e => setHmlPass(e.target.value)}
                placeholder="••••••••"
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">Deixe em branco para manter a senha atual.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info box */}
      <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Os certificados digitais são armazenados de forma segura e criptografada. Nunca compartilhe suas senhas com terceiros.
        </p>
      </div>
    </div>
  );
}
