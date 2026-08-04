import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import {
  Save,
  LayoutDashboard,
  Palette,
  BarChart3,
  LineChart,
  AreaChart,
  PieChart,
  MailOpen,
  Send,
  FileStack,
  Users,
  Clock,
  CheckCircle2,
  FileText,
  CalendarPlus,
  MessageSquare,
  FolderKanban,
  LifeBuoy,
  Eye,
  EyeOff,
  Type,
  Settings2,
  RotateCcw,
  SquareStack,
  Columns3,
  RectangleHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Stat card metadata
type StatMeta = {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

const STAT_CARDS: StatMeta[] = [
  { key: "suratMasuk", label: "Surat Masuk", icon: MailOpen, description: "Jumlah surat masuk" },
  { key: "suratKeluar", label: "Surat Keluar", icon: Send, description: "Jumlah surat keluar" },
  { key: "suratBulanIni", label: "Surat Bulan Ini", icon: FileStack, description: "Surat yang dibuat bulan ini" },
  { key: "totalKaryawan", label: "Total Karyawan", icon: Users, description: "Jumlah total karyawan" },
  { key: "disposisiPending", label: "Disposisi Pending", icon: Clock, description: "Disposisi yang belum diselesaikan" },
  { key: "approvalPending", label: "Approval Pending", icon: CheckCircle2, description: "Persetujuan yang menunggu" },
  { key: "suratDraft", label: "Surat Draft", icon: FileText, description: "Surat yang masih draft" },
  { key: "leaveRequests", label: "Pengajuan Cuti", icon: CalendarPlus, description: "Cuti yang menunggu persetujuan" },
  { key: "attendance", label: "Kehadiran Hari Ini", icon: Clock, description: "Jumlah absensi hari ini" },
  { key: "activeProjects", label: "Proyek Aktif", icon: FolderKanban, description: "Proyek yang sedang berjalan" },
  { key: "openTickets", label: "Tiket Terbuka", icon: LifeBuoy, description: "Tiket yang belum ditutup" },
  { key: "unreadMessages", label: "Pesan Belum Dibaca", icon: MessageSquare, description: "Pesan yang belum terbaca" },
];

const LAYOUT_OPTIONS = [
  { value: "default", label: "Default (2 kolom)", icon: Columns3, description: "Layout standar 2 kolom di desktop" },
  { value: "compact", label: "Kompak (1 kolom)", icon: SquareStack, description: "Semua konten dalam 1 kolom" },
  { value: "wide", label: "Lebar (3 kolom stat)", icon: RectangleHorizontal, description: "Stat cards 3 kolom dengan sidebar kanan" },
];

const COLOR_SCHEMES = [
  { value: "default", label: "Default", preview: ["bg-blue-500", "bg-teal-500", "bg-purple-500", "bg-orange-500"] },
  { value: "monochrome", label: "Monokrom", preview: ["bg-gray-600", "bg-gray-500", "bg-gray-400", "bg-gray-700"] },
  { value: "vibrant", label: "Vibrant", preview: ["bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500"] },
  { value: "pastel", label: "Pastel", preview: ["bg-blue-300", "bg-green-300", "bg-purple-300", "bg-pink-300"] },
];

const CHART_TYPES = [
  { value: "bar", label: "Bar Chart", icon: BarChart3 },
  { value: "line", label: "Line Chart", icon: LineChart },
  { value: "area", label: "Area Chart", icon: AreaChart },
  { value: "pie", label: "Pie Chart", icon: PieChart },
];

type WidgetToggle = {
  key: string;
  label: string;
  description: string;
};

const WIDGET_TOGGLES: WidgetToggle[] = [
  { key: "showGreeting", label: "Banner Sapaan", description: "Greeting banner di bagian atas dashboard" },
  { key: "showCelebrations", label: "Perayaan Hari Ini", description: "Banner ulang tahun & anniversary" },
  { key: "showQuickAccess", label: "Akses Cepat", description: "Grid shortcut modul favorit" },
  { key: "showRecentLetters", label: "Surat Terbaru", description: "Tabel surat masuk/keluar terbaru" },
  { key: "showAnnouncements", label: "Pengumuman", description: "Daftar pengumuman perusahaan" },
  { key: "showPendingDispositions", label: "Disposisi Masuk", description: "Disposisi yang menunggu tindakan" },
  { key: "showUpcomingEvents", label: "Event Mendatang", description: "Jadwal event perusahaan" },
  { key: "showActivityTimeline", label: "Aktivitas Terbaru", description: "Timeline aktivitas surat" },
];

type Settings = {
  enabledStats: string[];
  layout: string;
  colorScheme: string;
  chartType: string;
  showTrends: boolean;
  showGreeting: boolean;
  showQuickAccess: boolean;
  showRecentLetters: boolean;
  showActivityTimeline: boolean;
  showPendingDispositions: boolean;
  showUpcomingEvents: boolean;
  showAnnouncements: boolean;
  showCelebrations: boolean;
  dashboardCaption?: string;
  statsCaption?: string;
  chartCaption?: string;
  customStatLabels?: Record<string, string>;
};

const DEFAULT_SETTINGS: Settings = {
  enabledStats: ["suratMasuk", "suratKeluar", "suratBulanIni", "totalKaryawan"],
  layout: "default",
  colorScheme: "default",
  chartType: "bar",
  showTrends: true,
  showGreeting: true,
  showQuickAccess: true,
  showRecentLetters: true,
  showActivityTimeline: true,
  showPendingDispositions: true,
  showUpcomingEvents: true,
  showAnnouncements: true,
  showCelebrations: true,
};

export default function DashboardSettingsPanel() {
  const settings = useQuery(api.dashboardSettings.get, {});
  const saveSettings = useMutation(api.dashboardSettings.save);
  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setForm({
        enabledStats: settings.enabledStats,
        layout: settings.layout,
        colorScheme: settings.colorScheme,
        chartType: settings.chartType,
        showTrends: settings.showTrends,
        showGreeting: settings.showGreeting,
        showQuickAccess: settings.showQuickAccess,
        showRecentLetters: settings.showRecentLetters,
        showActivityTimeline: settings.showActivityTimeline,
        showPendingDispositions: settings.showPendingDispositions,
        showUpcomingEvents: settings.showUpcomingEvents,
        showAnnouncements: settings.showAnnouncements,
        showCelebrations: settings.showCelebrations,
        dashboardCaption: settings.dashboardCaption,
        statsCaption: settings.statsCaption,
        chartCaption: settings.chartCaption,
        customStatLabels: settings.customStatLabels,
      });
      setInitialized(true);
    }
  }, [settings, initialized]);

  if (settings === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const toggleStat = (key: string) => {
    setForm((prev) => {
      const isEnabled = prev.enabledStats.includes(key);
      return {
        ...prev,
        enabledStats: isEnabled
          ? prev.enabledStats.filter((k) => k !== key)
          : [...prev.enabledStats, key],
      };
    });
  };

  const setWidgetToggle = (key: string, value: boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateCustomLabel = (statKey: string, label: string) => {
    setForm((prev) => {
      const labels = { ...(prev.customStatLabels ?? {}) };
      if (label.trim()) {
        labels[statKey] = label;
      } else {
        delete labels[statKey];
      }
      return { ...prev, customStatLabels: Object.keys(labels).length > 0 ? labels : undefined };
    });
  };

  const handleSave = async () => {
    if (form.enabledStats.length === 0) {
      toast.error("Pilih minimal 1 statistik untuk ditampilkan");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        enabledStats: form.enabledStats,
        layout: form.layout,
        colorScheme: form.colorScheme,
        chartType: form.chartType,
        showTrends: form.showTrends,
        showGreeting: form.showGreeting,
        showQuickAccess: form.showQuickAccess,
        showRecentLetters: form.showRecentLetters,
        showActivityTimeline: form.showActivityTimeline,
        showPendingDispositions: form.showPendingDispositions,
        showUpcomingEvents: form.showUpcomingEvents,
        showAnnouncements: form.showAnnouncements,
        showCelebrations: form.showCelebrations,
        dashboardCaption: form.dashboardCaption || undefined,
        statsCaption: form.statsCaption || undefined,
        chartCaption: form.chartCaption || undefined,
        customStatLabels: form.customStatLabels,
      });
      toast.success("Pengaturan dashboard berhasil disimpan");
    } catch {
      toast.error("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULT_SETTINGS);
    toast.info("Pengaturan direset ke default");
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Stat Cards Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" />
                Kartu Statistik
              </CardTitle>
              <CardDescription>
                Pilih statistik yang ditampilkan di bagian atas dashboard ({form.enabledStats.length} aktif)
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs">
              {form.enabledStats.length} / {STAT_CARDS.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STAT_CARDS.map((stat) => {
              const isEnabled = form.enabledStats.includes(stat.key);
              const customLabel = form.customStatLabels?.[stat.key];
              return (
                <div
                  key={stat.key}
                  className={cn(
                    "rounded-xl border p-3 transition-all cursor-pointer",
                    isEnabled
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => toggleStat(stat.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isEnabled
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <stat.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium truncate", !isEnabled && "text-muted-foreground")}>
                          {customLabel || stat.label}
                        </span>
                        {isEnabled && (
                          <Eye className="size-3 shrink-0 text-primary" />
                        )}
                        {!isEnabled && (
                          <EyeOff className="size-3 shrink-0 text-muted-foreground/50" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{stat.description}</p>
                    </div>
                  </div>

                  {/* Custom label input for enabled stats */}
                  {isEnabled && (
                    <div className="mt-2.5 ml-12" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={customLabel ?? ""}
                        onChange={(e) => updateCustomLabel(stat.key, e.target.value)}
                        placeholder={`Label: ${stat.label}`}
                        className="h-7 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutDashboard className="size-4 text-primary" />
            Tata Letak (Layout)
          </CardTitle>
          <CardDescription>
            Pilih layout tampilan dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setForm((prev) => ({ ...prev, layout: opt.value }))}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-all",
                  form.layout === opt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  form.layout === opt.value ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <opt.icon className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4 text-primary" />
            Skema Warna
          </CardTitle>
          <CardDescription>
            Pilih skema warna untuk kartu statistik
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COLOR_SCHEMES.map((scheme) => (
              <button
                key={scheme.value}
                onClick={() => setForm((prev) => ({ ...prev, colorScheme: scheme.value }))}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border p-4 transition-all",
                  form.colorScheme === scheme.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className="flex gap-1.5">
                  {scheme.preview.map((colorClass, i) => (
                    <div key={i} className={cn("size-5 rounded-full", colorClass)} />
                  ))}
                </div>
                <span className="text-sm font-medium">{scheme.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Chart Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" />
            Model Grafik
          </CardTitle>
          <CardDescription>
            Pilih tipe grafik untuk visualisasi data tren
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CHART_TYPES.map((chart) => (
              <button
                key={chart.value}
                onClick={() => setForm((prev) => ({ ...prev, chartType: chart.value }))}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border p-4 transition-all",
                  form.chartType === chart.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <chart.icon className={cn(
                  "size-8",
                  form.chartType === chart.value ? "text-primary" : "text-muted-foreground"
                )} />
                <span className="text-sm font-medium">{chart.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Widget Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4 text-primary" />
            Visibilitas Widget
          </CardTitle>
          <CardDescription>
            Atur komponen mana saja yang ditampilkan di dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {WIDGET_TOGGLES.map((widget) => (
            <div
              key={widget.key}
              className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{widget.label}</Label>
                <p className="text-xs text-muted-foreground">{widget.description}</p>
              </div>
              <Switch
                checked={form[widget.key as keyof Settings] as boolean}
                onCheckedChange={(checked) => setWidgetToggle(widget.key, checked)}
                className="cursor-pointer"
              />
            </div>
          ))}

          {/* Trend indicator toggle */}
          <div className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Indikator Tren</Label>
              <p className="text-xs text-muted-foreground">Tampilkan persentase naik/turun di kartu statistik</p>
            </div>
            <Switch
              checked={form.showTrends}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, showTrends: checked }))}
              className="cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Captions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Type className="size-4 text-primary" />
            Keterangan & Caption
          </CardTitle>
          <CardDescription>
            Atur teks keterangan yang tampil di berbagai bagian dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dashboardCaption">Caption Header Dashboard</Label>
            <Input
              id="dashboardCaption"
              value={form.dashboardCaption ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, dashboardCaption: e.target.value }))}
              placeholder="Contoh: Selamat datang di portal e-Office"
            />
            <p className="text-xs text-muted-foreground">Teks tambahan di bawah greeting banner</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="statsCaption">Caption Bagian Statistik</Label>
            <Input
              id="statsCaption"
              value={form.statsCaption ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, statsCaption: e.target.value }))}
              placeholder="Contoh: Ringkasan data bulan ini"
            />
            <p className="text-xs text-muted-foreground">Teks keterangan di atas kartu statistik</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chartCaption">Caption Bagian Grafik</Label>
            <Input
              id="chartCaption"
              value={form.chartCaption ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, chartCaption: e.target.value }))}
              placeholder="Contoh: Tren surat masuk & keluar 6 bulan terakhir"
            />
            <p className="text-xs text-muted-foreground">Teks keterangan untuk bagian grafik/chart</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1.5 cursor-pointer text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
          Reset ke Default
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 cursor-pointer"
        >
          <Save className="size-4" />
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  );
}
