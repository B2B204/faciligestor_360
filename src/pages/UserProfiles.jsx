import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TeamMember } from "@/entities/TeamMember";
import { RoleProfile } from "@/entities/RoleProfile";
import { User } from "@/entities/User";
import { PERMISSIONS } from "@/components/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  UserCheck,
  UserX,
  AlertTriangle,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_GROUPS = {
  Geral: ["Dashboard", "Reports", "Alerts", "Support"],
  Comercial: ["CRM", "Contracts", "ReajusteContratual", "SegurosLaudos", "Measurements"],
  RH: ["Employees", "AllowanceReceipts", "Recognitions"],
  Financeiro: [
    "Financial",
    "AccountsReceivable",
    "FinanceDashboard",
    "BankAccounts",
    "AccountsPayable",
    "CashFlow",
    "Invoices",
    "BankReconciliation",
    "DRE",
    "Exports",
    "FiscalSettings",
    "IndirectCosts",
  ],
  Compras: ["Uniforms", "Patrimony", "Supplies"],
  Configurações: [
    "UserProfiles",
    "CompanySettings",
    "Profile",
    "Marketing",
    "Marketplace",
    "Oficios",
  ],
};

const ALL_PAGES = Object.values(PAGE_GROUPS).flat();

const PAGE_LABELS = {
  Dashboard: "Dashboard",
  Reports: "Relatórios",
  Alerts: "Alertas",
  Support: "Suporte",
  CRM: "CRM",
  Contracts: "Contratos",
  ReajusteContratual: "Reajuste Contratual",
  SegurosLaudos: "Seguros e Laudos",
  Measurements: "Medições",
  Employees: "Funcionários",
  AllowanceReceipts: "Recibos de Adiantamento",
  Recognitions: "Reconhecimentos",
  Financial: "Financeiro",
  AccountsReceivable: "Contas a Receber",
  FinanceDashboard: "Dashboard Financeiro",
  BankAccounts: "Contas Bancárias",
  AccountsPayable: "Contas a Pagar",
  CashFlow: "Fluxo de Caixa",
  Invoices: "Notas Fiscais",
  BankReconciliation: "Conciliação Bancária",
  DRE: "DRE",
  Exports: "Exportações",
  FiscalSettings: "Configurações Fiscais",
  IndirectCosts: "Custos Indiretos",
  Uniforms: "Uniformes",
  Patrimony: "Patrimônio",
  Supplies: "Suprimentos",
  UserProfiles: "Perfis de Usuário",
  CompanySettings: "Configurações da Empresa",
  Profile: "Meu Perfil",
  Marketing: "Marketing",
  Marketplace: "Marketplace",
  Oficios: "Ofícios",
};

const ALL_ACTIONS = [
  { key: "view", label: "Visualizar" },
  { key: "create", label: "Criar registros" },
  { key: "edit", label: "Editar registros" },
  { key: "delete", label: "Excluir registros" },
  { key: "all", label: "Acesso total (inclui tudo)" },
  { key: "approve_measurements", label: "Aprovar medições" },
  { key: "edit_rh", label: "Editar módulo RH" },
  { key: "edit_financeiro", label: "Editar módulo Financeiro" },
  { key: "edit_compras", label: "Editar módulo Compras" },
  { key: "edit_comercial", label: "Editar módulo Comercial" },
];

const COLOR_OPTIONS = ["blue", "green", "purple", "amber", "red", "indigo"];

const BUILTIN_META = {
  admin: { display_name: "Administrador", color: "blue", description: "Acesso completo ao sistema." },
  gestor: { display_name: "Gestor", color: "indigo", description: "Acesso completo com aprovação de medições." },
  rh: { display_name: "RH", color: "green", description: "Gerenciamento do módulo de Recursos Humanos." },
  financeiro: { display_name: "Financeiro", color: "amber", description: "Gerenciamento do módulo Financeiro." },
  compras: { display_name: "Compras", color: "purple", description: "Gerenciamento do módulo de Compras." },
  comercial: { display_name: "Comercial", color: "red", description: "Gerenciamento do módulo Comercial." },
  operador: { display_name: "Visualização", color: "gray", description: "Somente visualização do sistema." },
};

const COLOR_BORDER = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  purple: "border-l-purple-500",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
  indigo: "border-l-indigo-500",
  gray: "border-l-gray-400",
};

const COLOR_BADGE_BG = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const COLOR_DOT = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
  gray: "bg-gray-400",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getActionLabel(key) {
  return ALL_ACTIONS.find((a) => a.key === key)?.label || key;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function ProfileCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card animate-pulse p-4 space-y-3">
      <div className="h-4 bg-muted rounded w-2/3" />
      <div className="h-3 bg-muted rounded w-full" />
      <div className="h-3 bg-muted rounded w-4/5" />
      <div className="flex gap-1 flex-wrap">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-16 bg-muted rounded-full" />
        ))}
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ─── Profile Edit Dialog ──────────────────────────────────────────────────────

function ProfileDialog({ open, onClose, profile, onSave }) {
  const isNew = !profile;
  const isBuiltin = profile?.is_builtin_source === true;

  const [displayName, setDisplayName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [allPages, setAllPages] = useState(true);
  const [selectedPages, setSelectedPages] = useState([]);
  const [selectedActions, setSelectedActions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (profile) {
      setDisplayName(profile.display_name || "");
      setRoleKey(profile.role_key || "");
      setDescription(profile.description || "");
      setColor(profile.color || "blue");
      const pages = profile.pages || [];
      const hasAll = pages.includes("all");
      setAllPages(hasAll);
      setSelectedPages(hasAll ? [] : pages);
      setSelectedActions(profile.actions || []);
      setSlugManual(true);
    } else {
      setDisplayName("");
      setRoleKey("");
      setDescription("");
      setColor("blue");
      setAllPages(true);
      setSelectedPages([]);
      setSelectedActions(["view"]);
      setSlugManual(false);
    }
  }, [open, profile]);

  const handleNameChange = (val) => {
    setDisplayName(val);
    if (!slugManual) {
      setRoleKey(slugify(val));
    }
  };

  const togglePage = useCallback((page) => {
    setSelectedPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  }, []);

  const toggleAction = useCallback((key) => {
    setSelectedActions((prev) => {
      if (key === "all") {
        return prev.includes("all") ? prev.filter((a) => a !== "all") : ["all"];
      }
      if (prev.includes("all")) return prev;
      return prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key];
    });
  }, []);

  const handleSave = async () => {
    if (!displayName.trim() || !roleKey.trim()) return;
    setSaving(true);
    setError("");
    try {
      const pages = allPages ? ["all"] : selectedPages;
      const actions = selectedActions;
      await onSave({
        display_name: displayName.trim(),
        role_key: roleKey.trim(),
        description: description.trim(),
        color,
        pages,
        actions,
        is_builtin: isBuiltin,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao salvar perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const allActionsChecked = selectedActions.includes("all");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isNew ? "Novo Perfil" : `Editar Perfil — ${profile?.display_name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name + slug */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-foreground">Nome do perfil</Label>
              <Input
                value={displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isBuiltin && !isNew}
                placeholder="Ex: Supervisor"
                className="bg-background border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Slug (role_key)</Label>
              <Input
                value={roleKey}
                onChange={(e) => {
                  setRoleKey(e.target.value);
                  setSlugManual(true);
                }}
                disabled={!isNew}
                placeholder="ex: supervisor"
                className="bg-background border-border text-foreground"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-foreground">Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva as responsabilidades deste perfil..."
              rows={2}
              className="bg-background border-border text-foreground resize-none"
            />
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label className="text-foreground">Cor do perfil</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full ${COLOR_DOT[c]} ring-offset-background transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                  title={c}
                />
              ))}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Pages */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-foreground font-semibold">Páginas com acesso</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Acesso total</span>
                <Switch checked={allPages} onCheckedChange={setAllPages} />
              </div>
            </div>

            {!allPages && (
              <div className="space-y-4 pl-1">
                {Object.entries(PAGE_GROUPS).map(([group, pages]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {group}
                    </p>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                      {pages.map((page) => (
                        <label
                          key={page}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <Checkbox
                            checked={selectedPages.includes(page)}
                            onCheckedChange={() => togglePage(page)}
                          />
                          <span className="text-sm text-foreground group-hover:text-foreground/80">
                            {PAGE_LABELS[page] || page}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {allPages && (
              <p className="text-sm text-muted-foreground pl-1">
                Este perfil terá acesso a todas as páginas do sistema.
              </p>
            )}
          </div>

          <Separator className="bg-border" />

          {/* Actions */}
          <div className="space-y-3">
            <Label className="text-foreground font-semibold">Ações permitidas</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 pl-1">
              {ALL_ACTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={selectedActions.includes(key)}
                    onCheckedChange={() => toggleAction(key)}
                    disabled={key !== "all" && allActionsChecked}
                  />
                  <span
                    className={`text-sm ${
                      key !== "all" && allActionsChecked
                        ? "text-muted-foreground/50"
                        : "text-foreground group-hover:text-foreground/80"
                    }`}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !displayName.trim()}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", danger = false }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className={`w-5 h-5 ${danger ? "text-red-500" : "text-amber-500"}`} />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground">
            Cancelar
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({ profile, allProfiles, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pages = profile.pages || [];
  const actions = profile.actions || [];
  const isAllPages = pages.includes("all");
  const pageLabels = isAllPages ? [] : pages.map((p) => PAGE_LABELS[p] || p);
  const MAX_PAGES = 5;
  const shownPages = pageLabels.slice(0, MAX_PAGES);
  const extraPages = pageLabels.length - MAX_PAGES;

  const borderClass = COLOR_BORDER[profile.color] || "border-l-gray-400";
  const badgeClass = COLOR_BADGE_BG[profile.color] || COLOR_BADGE_BG.gray;

  return (
    <>
      <Card className={`bg-card border-border shadow-sm border-l-4 ${borderClass} flex flex-col`}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold text-foreground truncate">
                  {profile.display_name}
                </CardTitle>
                {profile.is_builtin_source ? (
                  <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-xs shrink-0">
                    Padrão
                  </Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs shrink-0">
                    Personalizado
                  </Badge>
                )}
              </div>
              {profile.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.description}</p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 flex-1 flex flex-col gap-3">
          {/* Pages */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Páginas</p>
            {isAllPages ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                ✓ Acesso total
              </span>
            ) : pageLabels.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhuma página</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {shownPages.map((p) => (
                  <span key={p} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                    {p}
                  </span>
                ))}
                {extraPages > 0 && (
                  <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                    +{extraPages} mais
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Ações</p>
            {actions.includes("all") ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                ✓ Todas as ações
              </span>
            ) : actions.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhuma ação</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {actions.map((a) => (
                  <span key={a} className={`text-xs rounded-full px-2 py-0.5 font-medium ${badgeClass}`}>
                    {getActionLabel(a)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(profile)}
              className="flex-1 border-border text-foreground hover:bg-muted"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Editar
            </Button>
            {!profile.is_builtin_source && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(profile.id)}
        title="Excluir perfil"
        description={`Tem certeza que deseja excluir o perfil "${profile.display_name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
      />
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserProfiles() {
  const [me, setMe] = useState(null);
  const [customProfiles, setCustomProfiles] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  // Confirm for team actions
  const [confirmTeam, setConfirmTeam] = useState(null); // { type, member }

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    User.me()
      .then((u) => setMe(u))
      .catch(() => {});
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const rows = await RoleProfile.list();
      setCustomProfiles(rows || []);
    } catch {
      setCustomProfiles([]);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setLoadingTeam(true);
    try {
      const rows = await TeamMember.list("-created_date", 200);
      setTeamMembers(rows || []);
    } catch {
      setTeamMembers([]);
    } finally {
      setLoadingTeam(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadTeam();
  }, [loadProfiles, loadTeam]);

  // ── Merged profile list ───────────────────────────────────────────────────────

  const builtinProfiles = useMemo(() => {
    const overrideKeys = new Set(
      customProfiles.filter((p) => p.is_builtin).map((p) => p.role_key)
    );

    const builtinKeys = [
      ...Object.keys(PERMISSIONS),
      ...(PERMISSIONS.operador ? [] : ["operador"]),
    ].filter((k) => !["operador"].includes(k) || !PERMISSIONS[k]);

    const base = Object.keys(PERMISSIONS).map((key) => {
      if (overrideKeys.has(key)) return null; // replaced by custom row
      const meta = BUILTIN_META[key] || {};
      return {
        id: `builtin_${key}`,
        role_key: key,
        display_name: meta.display_name || key,
        description: meta.description || "",
        color: meta.color || "blue",
        pages: PERMISSIONS[key].pages,
        actions: PERMISSIONS[key].actions,
        is_builtin_source: true,
      };
    }).filter(Boolean);

    // Add operador if not in PERMISSIONS
    if (!PERMISSIONS.operador) {
      base.push({
        id: "builtin_operador",
        role_key: "operador",
        display_name: "Visualização",
        description: "Somente visualização do sistema.",
        color: "gray",
        pages: ["all"],
        actions: ["view"],
        is_builtin_source: true,
      });
    }

    return base;
  }, [customProfiles]);

  const allProfiles = useMemo(() => {
    const customs = customProfiles.map((p) => ({
      ...p,
      is_builtin_source: p.is_builtin || false,
    }));
    return [...builtinProfiles, ...customs.filter((p) => !p.is_builtin)];
  }, [builtinProfiles, customProfiles]);

  // ── Profile CRUD ──────────────────────────────────────────────────────────────

  const handleOpenCreate = useCallback(() => {
    setEditingProfile(null);
    setProfileDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((profile) => {
    setEditingProfile(profile);
    setProfileDialogOpen(true);
  }, []);

  const handleSaveProfile = useCallback(
    async (data) => {
      const cnpj = me?.cnpj;
      if (editingProfile) {
        if (editingProfile.is_builtin_source && editingProfile.id?.startsWith("builtin_")) {
          // Create override row
          await RoleProfile.create({ ...data, cnpj, is_builtin: true });
        } else {
          await RoleProfile.update(editingProfile.id, data);
        }
      } else {
        await RoleProfile.create({ ...data, cnpj, is_builtin: false });
      }
      await loadProfiles();
    },
    [editingProfile, me, loadProfiles]
  );

  const handleDeleteProfile = useCallback(
    async (id) => {
      try {
        await RoleProfile.delete(id);
        await loadProfiles();
      } catch (err) {
        alert(err?.message || "Erro ao excluir perfil. Tente novamente.");
      }
    },
    [loadProfiles]
  );

  // ── Team CRUD ─────────────────────────────────────────────────────────────────

  const handleProfileChange = useCallback(async (memberId, newRole) => {
    await TeamMember.update(memberId, { department: newRole });
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, department: newRole } : m))
    );
  }, []);

  const handleToggleStatus = useCallback(async (member) => {
    const newStatus = member.status === "ativo" ? "inativo" : "ativo";
    await TeamMember.update(member.id, { status: newStatus });
    setTeamMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, status: newStatus } : m))
    );
  }, []);

  const handleRemoveMember = useCallback(async (id) => {
    await TeamMember.delete(id);
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 min-h-screen bg-background">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" />
          Perfis e Equipe
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie perfis de acesso e os membros da equipe.
        </p>
      </div>

      <Tabs defaultValue="perfis">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="perfis" className="data-[state=active]:bg-background">
            <Shield className="w-4 h-4 mr-1.5" />
            Perfis
          </TabsTrigger>
          <TabsTrigger value="equipe" className="data-[state=active]:bg-background">
            <Users className="w-4 h-4 mr-1.5" />
            Equipe
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Perfis ────────────────────────────────────────────────────── */}
        <TabsContent value="perfis" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Perfis de Usuário</h2>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Perfil
            </Button>
          </div>

          {loadingProfiles ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ProfileCardSkeleton key={i} />
              ))}
            </div>
          ) : allProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum perfil encontrado</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Crie um novo perfil para começar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  allProfiles={allProfiles}
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteProfile}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Equipe ────────────────────────────────────────────────────── */}
        <TabsContent value="equipe" className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Membros da Equipe</h2>
            <Badge className="bg-muted text-muted-foreground">
              {teamMembers.length}
            </Badge>
          </div>

          {loadingTeam ? (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Nome", "E-mail", "Perfil", "Status", "Ações"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum membro na equipe</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Os membros adicionados aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {["Nome", "E-mail", "Perfil", "Status", "Ações"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...teamMembers]
                    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
                    .map((member) => (
                      <tr
                        key={member.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Nome */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">
                            {member.full_name || "—"}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            {member.email || "—"}
                          </span>
                        </td>

                        {/* Profile select */}
                        <td className="px-4 py-3">
                          <Select
                            value={member.department || ""}
                            onValueChange={(val) => handleProfileChange(member.id, val)}
                          >
                            <SelectTrigger className="h-8 text-xs w-40 bg-background border-border text-foreground">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent className="bg-background border-border">
                              {allProfiles.map((p) => (
                                <SelectItem
                                  key={p.role_key}
                                  value={p.role_key}
                                  className="text-sm text-foreground"
                                >
                                  {p.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {member.status === "ativo" ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-xs">
                              Inativo
                            </Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirmTeam({ type: "toggle", member })
                              }
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {member.status === "ativo" ? (
                                <>
                                  <UserX className="w-3.5 h-3.5 mr-1" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                                  Ativar
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirmTeam({ type: "remove", member })
                              }
                              className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Remover
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Profile Create/Edit Dialog */}
      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        profile={editingProfile}
        onSave={handleSaveProfile}
      />

      {/* Team Confirm Dialogs */}
      {confirmTeam?.type === "toggle" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmTeam(null)}
          onConfirm={() => handleToggleStatus(confirmTeam.member)}
          title={
            confirmTeam.member.status === "ativo"
              ? "Desativar membro"
              : "Ativar membro"
          }
          description={
            confirmTeam.member.status === "ativo"
              ? `Deseja desativar "${confirmTeam.member.full_name}"? O acesso será revogado.`
              : `Deseja reativar "${confirmTeam.member.full_name}"?`
          }
          confirmLabel={
            confirmTeam.member.status === "ativo" ? "Desativar" : "Ativar"
          }
          danger={confirmTeam.member.status === "ativo"}
        />
      )}

      {confirmTeam?.type === "remove" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmTeam(null)}
          onConfirm={() => handleRemoveMember(confirmTeam.member.id)}
          title="Remover membro"
          description={`Tem certeza que deseja remover "${confirmTeam.member.full_name}" da equipe? Esta ação não pode ser desfeita.`}
          confirmLabel="Remover"
          danger
        />
      )}
    </div>
  );
}
