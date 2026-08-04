import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { DateField } from "@/components/ui/date-field.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  Plus,
  Trash2,
  Settings2,
  Link2,
  Users,
  ArrowDown,
  ShieldCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import { REQUEST_TYPES, FINANCE_FUNCTIONS } from "@/convex/lib/financeConstants.ts";
import { ROLE_VALUES, ROLE_LABELS } from "@/convex/roles.ts";

// ─── Helper: inline position level name ─────────────────────────────────────
function PositionLevelBadge({ positionLevelId }: { positionLevelId?: Id<"positionLevels"> }) {
  const level = useQuery(
    api.positionLevels.get,
    positionLevelId ? { id: positionLevelId } : "skip",
  );
  if (!positionLevelId || level === undefined) return null;
  return <> &middot; {level?.code ?? "?"} - {level?.name ?? "..."}</>;
}

// ─── Types ──────────────────────────────────────────────────────────────────
type ApproverType = "role" | "specific_user" | "manager" | "position_level" | "department_head";

const APPROVER_TYPE_LABELS: Record<ApproverType, string> = {
  role: "Berdasarkan Role",
  specific_user: "User Tertentu",
  manager: "Atasan Langsung",
  position_level: "Berdasarkan Jenjang Jabatan",
  department_head: "Kepala Departemen",
};

function formatCurrency(amount: number): string {
  if (amount === 0) return "Rp 0";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ApprovalChainSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Konfigurasi Persetujuan Keuangan
          </h2>
          <p className="text-sm text-muted-foreground">
            Atur rantai persetujuan, mapping fungsi keuangan, dan delegasi otoritas.
          </p>
        </div>
      </div>

      <Tabs defaultValue="chains" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="chains" className="gap-1.5">
            <Settings2 className="hidden size-4 sm:block" />
            Rantai Persetujuan
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Users className="hidden size-4 sm:block" />
            Mapping Fungsi
          </TabsTrigger>
          <TabsTrigger value="delegations" className="gap-1.5">
            <Link2 className="hidden size-4 sm:block" />
            Delegasi Otoritas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chains">
          <ApprovalChainsTab />
        </TabsContent>
        <TabsContent value="roles">
          <RoleMappingsTab />
        </TabsContent>
        <TabsContent value="delegations">
          <DelegationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL CHAINS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ApprovalChainsTab() {
  const chains = useQuery(api.financeApproval.listChains, {});
  const [expandedChainId, setExpandedChainId] = useState<string | null>(null);

  if (chains === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tentukan rantai persetujuan berdasarkan jenis dan nilai pengajuan.
        </p>
        <CreateChainDialog />
      </div>

      {chains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Settings2 className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada rantai persetujuan</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Buat rantai persetujuan pertama untuk mengatur alur pengajuan keuangan.
            </p>
          </CardContent>
        </Card>
      ) : (
        chains.map((chain) => (
          <ChainCard
            key={chain._id}
            chain={chain}
            isExpanded={expandedChainId === chain._id}
            onToggleExpand={() =>
              setExpandedChainId(expandedChainId === chain._id ? null : chain._id)
            }
          />
        ))
      )}
    </div>
  );
}

// ─── Chain Card ──────────────────────────────────────────────────────────────

function ChainCard({
  chain,
  isExpanded,
  onToggleExpand,
}: {
  chain: {
    _id: Id<"financeApprovalChains">;
    name: string;
    requestType: string;
    description?: string;
    minAmount: number;
    maxAmount: number;
    isActive: boolean;
    levels: Array<{
      _id: Id<"financeApprovalLevels">;
      level: number;
      label: string;
      approverType: string;
      roleKey?: string;
      specificUserId?: Id<"users">;
      slaHours: number;
      canDelegate: boolean;
    }>;
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const updateChain = useMutation(api.financeApproval.updateChain);
  const deleteChain = useMutation(api.financeApproval.deleteChain);
  const deleteLevel = useMutation(api.financeApproval.deleteLevel);

  const requestTypeLabel =
    REQUEST_TYPES.find((t) => t.key === chain.requestType)?.label ?? chain.requestType;
  const thresholdText =
    chain.maxAmount === 0
      ? `${formatCurrency(chain.minAmount)} ke atas`
      : `${formatCurrency(chain.minAmount)} - ${formatCurrency(chain.maxAmount)}`;

  const handleToggleActive = async () => {
    try {
      await updateChain({ id: chain._id, isActive: !chain.isActive });
      toast.success(chain.isActive ? "Chain dinonaktifkan" : "Chain diaktifkan");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal mengubah status";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteChain({ id: chain._id });
      toast.success("Chain dihapus");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal menghapus";
      toast.error(msg);
    }
  };

  const handleDeleteLevel = async (levelId: Id<"financeApprovalLevels">) => {
    try {
      await deleteLevel({ id: levelId });
      toast.success("Level dihapus");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal menghapus level";
      toast.error(msg);
    }
  };

  return (
    <Card className={!chain.isActive ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex flex-1 cursor-pointer items-start gap-3"
            onClick={onToggleExpand}
          >
            <button className="mt-1 text-muted-foreground hover:text-foreground">
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{chain.name}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {requestTypeLabel}
                </Badge>
                {!chain.isActive && (
                  <Badge variant="destructive" className="text-xs">
                    Nonaktif
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Threshold: {thresholdText} &middot; {chain.levels.length} level persetujuan
              </p>
              {chain.description && (
                <p className="mt-1 text-xs text-muted-foreground/80">{chain.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={chain.isActive}
              onCheckedChange={handleToggleActive}
              className="cursor-pointer"
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 cursor-pointer text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3 pt-0">
          {/* Levels timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Level Persetujuan</p>
              <AddLevelDialog chainId={chain._id} />
            </div>

            {chain.levels.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Belum ada level. Tambahkan level persetujuan.
              </p>
            ) : (
              <div className="space-y-1">
                {chain.levels.map((level, idx) => (
                  <div key={level._id}>
                    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {level.level}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{level.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {APPROVER_TYPE_LABELS[level.approverType as ApproverType] ?? level.approverType}
                          {level.approverType === "role" && level.roleKey && (
                            <> &middot; {ROLE_LABELS[level.roleKey as keyof typeof ROLE_LABELS] ?? level.roleKey}</>
                          )}
                          {level.approverType === "position_level" && "positionLevelId" in level && (
                            <PositionLevelBadge positionLevelId={level.positionLevelId as Id<"positionLevels"> | undefined} />
                          )}
                          {" "}&middot; SLA: {level.slaHours}j
                          {level.canDelegate && " \u00B7 Delegasi OK"}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 cursor-pointer text-destructive/70 hover:text-destructive"
                        onClick={() => handleDeleteLevel(level._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {idx < chain.levels.length - 1 && (
                      <div className="flex justify-center py-0.5">
                        <ArrowDown className="size-3.5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Create Chain Dialog ─────────────────────────────────────────────────────

function CreateChainDialog() {
  const createChain = useMutation(api.financeApproval.createChain);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [requestType, setRequestType] = useState("operational");
  const [description, setDescription] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nama harus diisi");
      return;
    }
    setLoading(true);
    try {
      await createChain({
        name: name.trim(),
        requestType,
        description: description.trim() || undefined,
        minAmount: Number(minAmount) || 0,
        maxAmount: Number(maxAmount) || 0,
      });
      toast.success("Rantai persetujuan berhasil dibuat");
      setOpen(false);
      setName("");
      setRequestType("operational");
      setDescription("");
      setMinAmount("");
      setMaxAmount("");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal membuat chain";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="cursor-pointer gap-1.5">
          <Plus className="size-4" />
          Tambah Chain
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Rantai Persetujuan</DialogTitle>
          <DialogDescription>
            Tentukan jenis pengajuan dan threshold nilai untuk rantai ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Rantai</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Operasional Rutin"
            />
          </div>
          <div className="space-y-2">
            <Label>Jenis Pengajuan</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((t) => (
                  <SelectItem key={t.key} value={t.key} className="cursor-pointer">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Min. Nilai (IDR)</Label>
              <Input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Maks. Nilai (IDR)</Label>
              <Input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="0 = unlimited"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Deskripsi (opsional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi singkat..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="cursor-pointer">
              Batal
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={loading} className="cursor-pointer">
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Level Dialog ────────────────────────────────────────────────────────

function AddLevelDialog({ chainId }: { chainId: Id<"financeApprovalChains"> }) {
  const addLevel = useMutation(api.financeApproval.addLevel);
  const users = useQuery(api.financeApproval.listUsersForAssignment, {});
  const positionLevels = useQuery(api.positionLevels.listActive, {});
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [approverType, setApproverType] = useState<ApproverType>("role");
  const [roleKey, setRoleKey] = useState("");
  const [specificUserId, setSpecificUserId] = useState("");
  const [positionLevelId, setPositionLevelId] = useState("");
  const [slaHours, setSlaHours] = useState("48");
  const [canDelegate, setCanDelegate] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!label.trim()) {
      toast.error("Label harus diisi");
      return;
    }
    if (approverType === "role" && !roleKey) {
      toast.error("Pilih role");
      return;
    }
    if (approverType === "specific_user" && !specificUserId) {
      toast.error("Pilih user");
      return;
    }
    if (approverType === "position_level" && !positionLevelId) {
      toast.error("Pilih jenjang jabatan");
      return;
    }
    setLoading(true);
    try {
      await addLevel({
        chainId,
        label: label.trim(),
        approverType,
        roleKey: approverType === "role" ? roleKey : undefined,
        specificUserId: approverType === "specific_user" ? (specificUserId as Id<"users">) : undefined,
        positionLevelId: approverType === "position_level" ? (positionLevelId as Id<"positionLevels">) : undefined,
        slaHours: Number(slaHours) || 48,
        canDelegate,
      });
      toast.success("Level berhasil ditambahkan");
      setOpen(false);
      setLabel("");
      setApproverType("role");
      setRoleKey("");
      setSpecificUserId("");
      setPositionLevelId("");
      setSlaHours("48");
      setCanDelegate(true);
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal menambah level";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="cursor-pointer gap-1.5">
          <Plus className="size-3.5" />
          Tambah Level
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Level Persetujuan</DialogTitle>
          <DialogDescription>
            Tentukan siapa yang menyetujui di level ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Label Level</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Contoh: Atasan Langsung, Kepala Bagian, PPK"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipe Approver</Label>
            <Select
              value={approverType}
              onValueChange={(v) => setApproverType(v as ApproverType)}
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager" className="cursor-pointer">Atasan Langsung (Manager)</SelectItem>
                <SelectItem value="role" className="cursor-pointer">Berdasarkan Role</SelectItem>
                <SelectItem value="specific_user" className="cursor-pointer">User Tertentu</SelectItem>
                <SelectItem value="position_level" className="cursor-pointer">Berdasarkan Jenjang Jabatan</SelectItem>
                <SelectItem value="department_head" className="cursor-pointer">Kepala Departemen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {approverType === "role" && (
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleKey} onValueChange={setRoleKey}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih role..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_VALUES.map((r) => (
                    <SelectItem key={r} value={r} className="cursor-pointer">
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {approverType === "specific_user" && (
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={specificUserId} onValueChange={setSpecificUserId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih user..." />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id} className="cursor-pointer">
                      {u.name} ({ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {approverType === "position_level" && (
            <div className="space-y-2">
              <Label>Jenjang Jabatan</Label>
              <Select value={positionLevelId} onValueChange={setPositionLevelId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Pilih jenjang jabatan..." />
                </SelectTrigger>
                <SelectContent>
                  {(positionLevels ?? []).map((pl) => (
                    <SelectItem key={pl._id} value={pl._id} className="cursor-pointer">
                      {pl.code} - {pl.name}
                      {pl.maxApprovalAmount > 0
                        ? ` (maks Rp ${pl.maxApprovalAmount.toLocaleString("id-ID")})`
                        : " (unlimited)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sistem akan mencari pejabat di level ini dari rantai atasan pengaju, kemudian departemen yang sama.
              </p>
            </div>
          )}

          {approverType === "department_head" && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                Sistem akan otomatis meneruskan ke Kepala Departemen pengaju. 
                Jika tidak ada Kepala Departemen, akan dialihkan ke atasan langsung.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>SLA (jam)</Label>
              <Input
                type="number"
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="48"
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <Switch
                checked={canDelegate}
                onCheckedChange={setCanDelegate}
                className="cursor-pointer"
              />
              <Label className="text-sm">Bisa Didelegasikan</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="cursor-pointer">
              Batal
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={loading} className="cursor-pointer">
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE MAPPINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function RoleMappingsTab() {
  const mappings = useQuery(api.financeApproval.listRoleMappings, {});
  const users = useQuery(api.financeApproval.listUsersForAssignment, {});

  if (mappings === undefined || users === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tetapkan pengguna ke fungsi keuangan organisasi (PPK, PPSPM, Bendahara, KPA, Verifikator).
      </p>

      {FINANCE_FUNCTIONS.map((fn) => {
        const mapping = mappings.find((m) => m.functionKey === fn.key);
        return (
          <RoleMappingCard
            key={fn.key}
            functionDef={fn}
            mapping={mapping ?? null}
            users={users}
          />
        );
      })}
    </div>
  );
}

function RoleMappingCard({
  functionDef,
  mapping,
  users,
}: {
  functionDef: { key: string; label: string; description: string };
  mapping: {
    assignedUserIds: Id<"users">[];
    assignedUsers: Array<{ _id: Id<"users">; name: string }>;
    fallbackRole?: string;
  } | null;
  users: Array<{ _id: Id<"users">; name: string; role: string; department: string; jobTitle: string }>;
}) {
  const upsertRoleMapping = useMutation(api.financeApproval.upsertRoleMapping);
  const [editing, setEditing] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>(
    mapping?.assignedUserIds ?? [],
  );
  const [fallbackRole, setFallbackRole] = useState(mapping?.fallbackRole ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertRoleMapping({
        functionKey: functionDef.key,
        functionLabel: functionDef.label,
        description: functionDef.description,
        assignedUserIds: selectedUserIds,
        fallbackRole: fallbackRole || undefined,
      });
      toast.success("Mapping disimpan");
      setEditing(false);
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = (userId: Id<"users">) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{functionDef.label}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{functionDef.description}</p>
          </div>
          <Button
            size="sm"
            variant={editing ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => {
              if (editing) {
                handleSave();
              } else {
                setSelectedUserIds(mapping?.assignedUserIds ?? []);
                setFallbackRole(mapping?.fallbackRole ?? "");
                setEditing(true);
              }
            }}
            disabled={saving}
          >
            {editing ? (saving ? "Menyimpan..." : "Simpan") : "Atur"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div>
            {mapping && mapping.assignedUsers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {mapping.assignedUsers.map((u) => (
                  <Badge key={u._id} variant="secondary" className="text-xs">
                    {u.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60">
                Belum ada pengguna yang ditetapkan.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {users.map((u) => (
                <label
                  key={u._id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u._id)}
                    onChange={() => toggleUser(u._id)}
                    className="cursor-pointer"
                  />
                  <span>{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                  </span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Fallback Role (opsional)</Label>
              <Select value={fallbackRole || "none"} onValueChange={(v) => setFallbackRole(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 cursor-pointer text-xs">
                  <SelectValue placeholder="Tidak ada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer text-xs">Tidak ada</SelectItem>
                  {ROLE_VALUES.map((r) => (
                    <SelectItem key={r} value={r} className="cursor-pointer text-xs">
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setEditing(false)}
            >
              Batal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELEGATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function DelegationsTab() {
  const delegations = useQuery(api.financeApproval.listDelegations, {});
  const users = useQuery(api.financeApproval.listUsersForAssignment, {});

  if (delegations === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Kelola delegasi otoritas saat pejabat berhalangan.
        </p>
        {users && <CreateDelegationDialog users={users} />}
      </div>

      {delegations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Link2 className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Belum ada delegasi aktif
            </p>
          </CardContent>
        </Card>
      ) : (
        delegations.map((d) => (
          <DelegationCard key={d._id} delegation={d} />
        ))
      )}
    </div>
  );
}

function DelegationCard({
  delegation,
}: {
  delegation: {
    _id: Id<"financeApprovalDelegations">;
    delegatorName: string;
    delegateName: string;
    startDate: string;
    endDate: string;
    reason: string;
    isActive: boolean;
  };
}) {
  const toggleDelegation = useMutation(api.financeApproval.toggleDelegation);
  const deleteDelegation = useMutation(api.financeApproval.deleteDelegation);

  const handleToggle = async () => {
    try {
      await toggleDelegation({ id: delegation._id, isActive: !delegation.isActive });
      toast.success(delegation.isActive ? "Delegasi dinonaktifkan" : "Delegasi diaktifkan");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDelegation({ id: delegation._id });
      toast.success("Delegasi dihapus");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal menghapus";
      toast.error(msg);
    }
  };

  return (
    <Card className={!delegation.isActive ? "opacity-60" : ""}>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {delegation.delegatorName}
            <span className="mx-1.5 text-muted-foreground">&rarr;</span>
            {delegation.delegateName}
          </p>
          <p className="text-xs text-muted-foreground">
            {delegation.startDate} s/d {delegation.endDate} &middot; {delegation.reason}
          </p>
        </div>
        <Switch
          checked={delegation.isActive}
          onCheckedChange={handleToggle}
          className="cursor-pointer"
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-8 cursor-pointer text-destructive hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateDelegationDialog({
  users,
}: {
  users: Array<{ _id: Id<"users">; name: string; role: string; department: string; jobTitle: string }>;
}) {
  const createDelegation = useMutation(api.financeApproval.createDelegation);
  const [open, setOpen] = useState(false);
  const [delegatorId, setDelegatorId] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!delegatorId || !delegateId || !startDate || !endDate || !reason.trim()) {
      toast.error("Semua field harus diisi");
      return;
    }
    setLoading(true);
    try {
      await createDelegation({
        delegatorId: delegatorId as Id<"users">,
        delegateId: delegateId as Id<"users">,
        startDate,
        endDate,
        reason: reason.trim(),
      });
      toast.success("Delegasi berhasil dibuat");
      setOpen(false);
      setDelegatorId("");
      setDelegateId("");
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (e) {
      const msg = e instanceof ConvexError ? (e.data as { message: string }).message : "Gagal membuat delegasi";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="cursor-pointer gap-1.5">
          <Plus className="size-4" />
          Tambah Delegasi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Delegasi Otoritas</DialogTitle>
          <DialogDescription>
            Tugaskan wewenang persetujuan kepada orang lain untuk periode tertentu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pejabat (yang berhalangan)</Label>
            <Select value={delegatorId} onValueChange={setDelegatorId}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Pilih pejabat..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u._id} value={u._id} className="cursor-pointer">
                    {u.name} - {u.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Penerima Delegasi</Label>
            <Select value={delegateId} onValueChange={setDelegateId}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Pilih penerima..." />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter((u) => u._id !== delegatorId)
                  .map((u) => (
                    <SelectItem key={u._id} value={u._id} className="cursor-pointer">
                      {u.name} - {u.jobTitle}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <DateField
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <DateField
                value={endDate}
                onChange={(v) => setEndDate(v)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alasan</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Cuti tahunan, perjalanan dinas"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="cursor-pointer">
              Batal
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={loading} className="cursor-pointer">
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
