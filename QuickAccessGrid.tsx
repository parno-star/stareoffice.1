import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
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
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  Settings2,
  MailPlus,
  Briefcase,
  Clock,
  FolderKanban,
  GraduationCap,
  MessageSquare,
  CalendarDays,
  Sparkles,
  Users,
  FileText,
  BookOpen,
  Receipt,
  Rocket,
  Network,
  UsersRound,
  LifeBuoy,
  Images,
  PartyPopper,
  HeartHandshake,
  BarChart3,
  LineChart,
  DoorOpen,
  BriefcaseBusiness,
  Target,
  Package,
  Trophy,
  ScrollText,
  Lightbulb,
  Bell,
  Plane,
  Wallet,
  Scale,
  Compass,
  Goal,
  HeartPulse,
  Gauge,
  Newspaper,
  MailOpen,
  RailSymbol,
  Shield,
  Settings,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ModuleItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  color: string;
  group: string;
};

const ALL_MODULES: ModuleItem[] = [
  // Umum
  { path: "/letters", label: "Kelola Surat", icon: MailOpen, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", group: "Umum" },
  { path: "/messages", label: "Pesan", icon: MessageSquare, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400", group: "Umum" },
  { path: "/notifications", label: "Notifikasi", icon: Bell, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", group: "Umum" },
  { path: "/calendar", label: "Kalender", icon: CalendarDays, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400", group: "Umum" },
  { path: "/chatbot", label: "Asisten AI", icon: Sparkles, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", group: "Umum" },
  // HR
  { path: "/directory", label: "Direktori Karyawan", icon: Users, color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400", group: "Human Resources" },
  { path: "/organization", label: "Struktur Organisasi", icon: Network, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400", group: "Human Resources" },
  { path: "/teams", label: "Tim & Departemen", icon: UsersRound, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", group: "Human Resources" },
  { path: "/attendance", label: "Absensi", icon: Clock, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400", group: "Human Resources" },
  { path: "/leave", label: "Pengajuan Cuti", icon: Briefcase, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400", group: "Human Resources" },
  { path: "/onboarding", label: "Onboarding", icon: Rocket, color: "bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400", group: "Human Resources" },
  { path: "/offboarding", label: "Offboarding", icon: Briefcase, color: "bg-stone-100 text-stone-600 dark:bg-stone-900/30 dark:text-stone-400", group: "Human Resources" },
  { path: "/recruitment", label: "Rekrutmen", icon: BriefcaseBusiness, color: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400", group: "Talent Acquisition" },
  { path: "/jobs", label: "Lowongan Internal", icon: BriefcaseBusiness, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", group: "Talent Acquisition" },
  { path: "/talent", label: "Talent Management", icon: Target, color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400", group: "Talent Acquisition" },
  { path: "/grading", label: "Grading & Job Eval", icon: Scale, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", group: "Talent Acquisition" },
  { path: "/career-path", label: "Jenjang Karier", icon: Compass, color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400", group: "Talent Acquisition" },
  { path: "/training", label: "Pelatihan", icon: GraduationCap, color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400", group: "Learning & Development" },
  { path: "/mentorship", label: "Mentorship", icon: HeartHandshake, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400", group: "Learning & Development" },
  { path: "/performance", label: "Penilaian Kinerja", icon: Target, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", group: "Performance Management" },
  { path: "/okr", label: "OKR & Goals", icon: Goal, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400", group: "Performance Management" },
  { path: "/feedback360", label: "Feedback 360", icon: Compass, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400", group: "Performance Management" },
  { path: "/engagement", label: "Survei Engagement", icon: HeartPulse, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400", group: "Performance Management" },
  { path: "/pulse", label: "Pulse Survey", icon: Gauge, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400", group: "Performance Management" },
  { path: "/reports", label: "Laporan HR", icon: LineChart, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", group: "HRIS & Analytics" },
  { path: "/analytics", label: "Dashboard Analitik", icon: BarChart3, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", group: "HRIS & Analytics" },
  // Keuangan
  { path: "/payroll", label: "Payroll & Gaji", icon: Wallet, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", group: "Keuangan" },
  { path: "/expenses", label: "Reimbursement", icon: Receipt, color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400", group: "Keuangan" },
  { path: "/fund-requests", label: "Pengajuan Dana", icon: Wallet, color: "bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400", group: "Keuangan" },
  { path: "/travel", label: "Perjalanan Dinas", icon: Plane, color: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400", group: "Keuangan" },
  // General Affairs
  { path: "/assets", label: "Inventaris & Aset", icon: Package, color: "bg-stone-100 text-stone-600 dark:bg-stone-900/30 dark:text-stone-400", group: "General Affairs" },
  { path: "/rooms", label: "Pemesanan Ruangan", icon: DoorOpen, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400", group: "General Affairs" },
  { path: "/events", label: "Event Perusahaan", icon: PartyPopper, color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", group: "General Affairs" },
  // Operasional
  { path: "/projects", label: "Tugas & Proyek", icon: FolderKanban, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400", group: "Operasional" },
  { path: "/track-calculator", label: "Kalkulator Jalan Rel", icon: RailSymbol, color: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400", group: "Operasional" },
  { path: "/track-history", label: "Riwayat & Visualisasi", icon: BarChart3, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", group: "Operasional" },
  // Corporate Communication
  { path: "/news", label: "Berita & Pengumuman", icon: Newspaper, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400", group: "Corporate Communication" },
  { path: "/forum", label: "Forum Diskusi", icon: MessageSquare, color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400", group: "Corporate Communication" },
  { path: "/polls", label: "Polling & Survei", icon: BarChart3, color: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400", group: "Corporate Communication" },
  { path: "/suggestions", label: "Kotak Saran", icon: Lightbulb, color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400", group: "Corporate Communication" },
  { path: "/celebrations", label: "Perayaan", icon: PartyPopper, color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400", group: "Corporate Communication" },
  { path: "/recognitions", label: "Apresiasi", icon: HeartHandshake, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", group: "Corporate Communication" },
  { path: "/awards", label: "Penghargaan", icon: Trophy, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", group: "Corporate Communication" },
  { path: "/gallery", label: "Galeri Kegiatan", icon: Images, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", group: "Corporate Communication" },
  // Legal & Compliance
  { path: "/documents", label: "Dokumen Perusahaan", icon: FileText, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", group: "Legal & Compliance" },
  { path: "/my-documents", label: "Dokumen Saya", icon: FileText, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400", group: "Legal & Compliance" },
  { path: "/wiki", label: "Wiki & Pengetahuan", icon: BookOpen, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400", group: "Legal & Compliance" },
  { path: "/policies", label: "Kebijakan Perusahaan", icon: ScrollText, color: "bg-stone-100 text-stone-600 dark:bg-stone-900/30 dark:text-stone-400", group: "Legal & Compliance" },
  // IT
  { path: "/support", label: "Bantuan IT", icon: LifeBuoy, color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400", group: "Information Technology" },
  { path: "/admin", label: "Dashboard Admin", icon: Shield, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", group: "Information Technology" },
  { path: "/settings/users", label: "Pengaturan Pengguna", icon: Settings, color: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400", group: "Information Technology" },
];

const DEFAULT_SHORTCUTS = [
  "/letters",
  "/leave",
  "/attendance",
  "/projects",
  "/training",
  "/messages",
  "/calendar",
  "/chatbot",
];

const MODULE_MAP = new Map(ALL_MODULES.map((m) => [m.path, m]));

function QuickAccessEditDialog({
  selected,
  onSave,
  isSaving,
}: {
  selected: string[];
  onSave: (paths: string[]) => void;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));

  const toggle = (path: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        if (next.size >= 16) {
          toast.error("Maksimal 16 shortcut");
          return prev;
        }
        next.add(path);
      }
      return next;
    });
  };

  const groups = Array.from(
    ALL_MODULES.reduce((acc, m) => {
      if (!acc.has(m.group)) acc.set(m.group, []);
      acc.get(m.group)!.push(m);
      return acc;
    }, new Map<string, ModuleItem[]>()),
  );

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Atur Akses Cepat</DialogTitle>
        <DialogDescription>
          Pilih modul yang ingin ditampilkan di dashboard Anda. Maksimal 16 modul.
          ({draft.size} dipilih)
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
        {groups.map(([groupName, items]) => (
          <div key={groupName}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
              {groupName}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map((mod) => {
                const isSelected = draft.has(mod.path);
                return (
                  <button
                    key={mod.path}
                    onClick={() => toggle(mod.path)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", mod.color)}>
                      <mod.icon className="size-4" />
                    </div>
                    <span className="min-w-0 flex-1 truncate font-medium text-xs">{mod.label}</span>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft(new Set(DEFAULT_SHORTCUTS))}
        >
          Reset Default
        </Button>
        <DialogClose asChild>
          <Button variant="ghost" size="sm">Batal</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button
            size="sm"
            disabled={isSaving || draft.size === 0}
            onClick={() => onSave(Array.from(draft))}
          >
            Simpan
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

export default function QuickAccessGrid() {
  const navigate = useNavigate();
  const savedShortcuts = useQuery(api.users.getMyQuickAccess, {});
  const updateShortcuts = useMutation(api.users.updateMyQuickAccess);
  const [isSaving, setIsSaving] = useState(false);

  if (savedShortcuts === undefined) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const shortcuts = savedShortcuts.length > 0 ? savedShortcuts : DEFAULT_SHORTCUTS;
  const modules = shortcuts
    .map((path) => MODULE_MAP.get(path))
    .filter((m): m is ModuleItem => m !== undefined);

  const handleSave = async (paths: string[]) => {
    setIsSaving(true);
    try {
      await updateShortcuts({ shortcuts: paths });
      toast.success("Akses cepat berhasil diperbarui");
    } catch {
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Akses Cepat</CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs cursor-pointer">
              <Settings2 className="size-3.5" />
              Atur
            </Button>
          </DialogTrigger>
          <QuickAccessEditDialog
            selected={shortcuts}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {modules.map((mod) => (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl p-3 transition-colors hover:bg-muted"
            >
              <div className={cn("flex size-10 items-center justify-center rounded-xl", mod.color)}>
                <mod.icon className="size-5" />
              </div>
              <span className="text-[11px] font-medium text-center leading-tight">{mod.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
