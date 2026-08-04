import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  Calendar,
  ClipboardCheck,
  Receipt,
  FileText,
  DoorOpen,
  FolderKanban,
  Wallet,
  Plane,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type QuickAction = {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  color: string;
};

const QUICK_ACTIONS: ReadonlyArray<QuickAction> = [
  { id: "leave", icon: Calendar, label: "Ajukan Cuti", path: "/leave", color: "text-blue-500" },
  { id: "attendance", icon: ClipboardCheck, label: "Absensi", path: "/attendance", color: "text-emerald-500" },
  { id: "expenses", icon: Receipt, label: "Reimburse", path: "/expenses", color: "text-teal-500" },
  { id: "payroll", icon: Wallet, label: "Slip Gaji", path: "/payroll", color: "text-amber-500" },
  { id: "letters", icon: FileText, label: "Surat", path: "/letters", color: "text-slate-500" },
  { id: "rooms", icon: DoorOpen, label: "Ruangan", path: "/rooms", color: "text-lime-500" },
  { id: "projects", icon: FolderKanban, label: "Tugas", path: "/projects", color: "text-orange-500" },
  { id: "travel", icon: Plane, label: "Dinas", path: "/travel", color: "text-sky-500" },
];

export default function QuickActionsBar() {
  const navigate = useNavigate();

  return (
    <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => navigate(action.path)}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-all hover:shadow-md hover:scale-[1.02]",
          )}
        >
          <action.icon className={cn("size-3.5", action.color)} />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
