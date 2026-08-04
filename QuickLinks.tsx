import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  FileText,
  Calendar,
  Users,
  Link2,
  LifeBuoy,
  Briefcase,
  Clock,
  FolderKanban,
  MessagesSquare,
  Newspaper,
  Lightbulb,
  Images,
  PartyPopper,
  HeartHandshake,
  BarChart3,
  LineChart,
  DoorOpen,
  Network,
  UsersRound,
  MessageSquare,
  BookOpen,
  Receipt,
  Rocket,
  GraduationCap,
  BriefcaseBusiness,
  Target,
  Package,
  Trophy,
  ScrollText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const links = [
  { icon: Users, label: "Direktori Karyawan", path: "/directory" },
  { icon: Briefcase, label: "Pengajuan Cuti", path: "/leave" },
  { icon: Clock, label: "Absensi", path: "/attendance" },
  { icon: FolderKanban, label: "Tugas & Proyek", path: "/projects" },
  { icon: MessageSquare, label: "Pesan", path: "/messages" },
  { icon: Calendar, label: "Kalender Perusahaan", path: "/calendar" },
  { icon: FileText, label: "Dokumen & SOP", path: "/documents" },
  { icon: ScrollText, label: "Kebijakan Perusahaan", path: "/policies" },
  { icon: BookOpen, label: "Wiki", path: "/wiki" },
  { icon: Receipt, label: "Reimbursement", path: "/expenses" },
  { icon: Rocket, label: "Onboarding", path: "/onboarding" },
  { icon: GraduationCap, label: "Pelatihan", path: "/training" },
  { icon: Newspaper, label: "Berita & Pengumuman", path: "/news" },
  { icon: MessagesSquare, label: "Forum Diskusi", path: "/forum" },
  { icon: Lightbulb, label: "Kotak Saran", path: "/suggestions" },
  { icon: LifeBuoy, label: "Bantuan IT", path: "/support" },
  { icon: Images, label: "Galeri Kegiatan", path: "/gallery" },
  { icon: PartyPopper, label: "Perayaan", path: "/celebrations" },
  { icon: HeartHandshake, label: "Apresiasi", path: "/recognitions" },
  { icon: Trophy, label: "Penghargaan", path: "/awards" },
  { icon: BarChart3, label: "Polling & Survei", path: "/polls" },
  { icon: DoorOpen, label: "Pemesanan Ruangan", path: "/rooms" },
  { icon: Network, label: "Struktur Organisasi", path: "/organization" },
  { icon: UsersRound, label: "Tim Lintas Departemen", path: "/teams" },
  { icon: Package, label: "Inventaris & Aset", path: "/assets" },
  { icon: BriefcaseBusiness, label: "Lowongan Internal", path: "/jobs" },
  { icon: Target, label: "Penilaian Kinerja", path: "/performance" },
  { icon: LineChart, label: "Laporan & Analitik", path: "/reports" },
  { icon: Link2, label: "Sistem Internal", path: null },
];

export default function QuickLinks() {
  const navigate = useNavigate();

  const handleClick = (link: (typeof links)[0]) => {
    if (link.path) {
      navigate(link.path);
    } else {
      toast.info("Segera hadir di milestone berikutnya!");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Akses Cepat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {links.map((link) => (
          <button
            key={link.label}
            onClick={() => handleClick(link)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
          >
            <link.icon className="size-4 text-primary" />
            <span>{link.label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
