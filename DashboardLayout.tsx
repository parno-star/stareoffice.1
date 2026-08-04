import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Kbd } from "@/components/ui/kbd.tsx";
import Omnisearch from "@/components/Omnisearch.tsx";
import GuideSheet from "@/components/GuideSheet.tsx";
import { lazy, Suspense, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner.tsx";
import RoleRequestDialog from "@/components/role-request-dialog.tsx";
import OnboardingDialog from "@/components/onboarding-dialog.tsx";
import { TenantProvider } from "@/components/providers/tenant.tsx";
import NoOrganizationGuard from "@/components/NoOrganizationGuard.tsx";
import OrgIndicator from "@/components/OrgIndicator.tsx";
import ScopeAccessBanner from "@/components/ScopeAccessBanner.tsx";
import OrgSwitcher from "@/components/OrgSwitcher.tsx";
import PlanLimitBanner from "@/components/PlanLimitBanner.tsx";
import SubscriptionBanner from "@/components/SubscriptionBanner.tsx";
import PlanRouteGuard from "@/components/PlanRouteGuard.tsx";
import PendingGrantGate from "@/components/PendingGrantGate.tsx";
import { useTenant } from "@/hooks/use-tenant.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import {
  Home,
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  FileText,
  MessagesSquare,
  Lightbulb,
  LifeBuoy,
  Images,
  PartyPopper,
  HeartHandshake,
  BarChart3,
  LineChart,
  DoorOpen,
  Mic,
  Network,
  UsersRound,
  Shield,
  CreditCard,
  Bell,
  Clock,
  FolderKanban,
  MessageSquare,
  BookOpen,
  Receipt,
  Wallet,
  Rocket,
  GraduationCap,
  Handshake,
  BriefcaseBusiness,
  UserSearch,
  Target,
  Scale,
  Goal,
  HeartPulse,
  Gauge,
  Compass,
  Sparkles,
  Newspaper,
  Package,
  Trophy,
  FolderLock,
  ScrollText,
  Plane,
  Sprout,
  Search,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  MailOpen,
  Archive,
  ShieldCheck,
  Building2,
  MoreVertical,
  Lock,
  UserCog,
  Milestone,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth.ts";
import { cn } from "@/lib/utils.ts";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import NotificationsBell from "@/pages/notifications/_components/NotificationsBell.tsx";
import ChatbotFab from "@/pages/chatbot/_components/ChatbotFab.tsx";
import ProductTour from "@/components/product-tour/ProductTour.tsx";
import NewMessageNotifier from "@/pages/messages/_components/NewMessageNotifier.tsx";
import ProfileCompletionGate from "@/components/profile-completion-dialog.tsx";
import type { MenuKey } from "@/convex/roles.ts";
import { SIDEBAR_GROUPS } from "@/convex/roles.ts";

const PendingApprovalScreen = lazy(() => import("@/pages/pending-approval/page.tsx"));

type NavItem = {
  key: MenuKey;
  icon: LucideIcon;
  label: string;
  path: string;
};

type NavSubGroup = {
  key: string;
  label: string;
  items: NavItem[];
};

type NavGroup = {
  label: string;
  key: string;
  items: NavItem[];
  subGroups?: NavSubGroup[];
};

/**
 * Sidebar navigation is derived from the single source of truth
 * `SIDEBAR_GROUPS` in convex/roles.ts, which BOTH this sidebar and the
 * access-control cards ("Akses Menu per Peran") follow. To move a menu between
 * groups or reorder it, edit `SIDEBAR_GROUPS` — the sidebar and the cards both
 * update automatically.
 *
 * This map only holds the per-menu presentation details (icon + sidebar label +
 * path) that are specific to the sidebar. Grouping and order come from
 * `SIDEBAR_GROUPS`.
 */
const NAV_META: Record<MenuKey, { icon: LucideIcon; label: string; path: string }> = {
  // Umum
  dashboard:       { icon: LayoutDashboard, label: "Dashboard",            path: "/dashboard" },
  chatbot:         { icon: Sparkles,        label: "Asisten AI",           path: "/chatbot" },
  notifications:   { icon: Bell,            label: "Notifikasi",           path: "/notifications" },
  calendar:        { icon: Calendar,        label: "Kalender",             path: "/calendar" },
  letters:         { icon: MailOpen,        label: "Kelola Surat",         path: "/letters" },
  document_archive:{ icon: Archive,         label: "Arsip Dokumen",        path: "/document-archive" },
  // Ruang Saya
  attendance:      { icon: Clock,           label: "Absensi",              path: "/attendance" },
  leave:           { icon: Briefcase,       label: "Pengajuan Cuti",       path: "/leave" },
  expenses:        { icon: Receipt,         label: "Reimbursement",        path: "/expenses" },
  fund_requests:   { icon: Wallet,          label: "Pengajuan Dana",       path: "/fund-requests" },
  travel:          { icon: Plane,           label: "Perjalanan Dinas",     path: "/travel" },
  projects:        { icon: FolderKanban,    label: "Tugas & Proyek",       path: "/projects" },
  career_path:     { icon: Compass,         label: "Jenjang Karier Saya",  path: "/career-path" },
  // Komunikasi
  messages:        { icon: MessageSquare,   label: "Pesan",                path: "/messages" },
  news:            { icon: Newspaper,       label: "Berita & Pengumuman",  path: "/news" },
  forum:           { icon: MessagesSquare,  label: "Forum Diskusi",        path: "/forum" },
  polls:           { icon: BarChart3,       label: "Polling & Survei",     path: "/polls" },
  suggestions:     { icon: Lightbulb,       label: "Kotak Saran",          path: "/suggestions" },
  celebrations:    { icon: PartyPopper,     label: "Perayaan",             path: "/celebrations" },
  recognitions:    { icon: HeartHandshake,  label: "Apresiasi",            path: "/recognitions" },
  awards:          { icon: Trophy,          label: "Penghargaan",          path: "/awards" },
  gallery:         { icon: Images,          label: "Galeri Kegiatan",      path: "/gallery" },
  // Tim & Kinerja
  teams:           { icon: UsersRound,      label: "Tim & Departemen",     path: "/teams" },
  performance:     { icon: Target,          label: "Penilaian Kinerja",    path: "/performance" },
  okr:             { icon: Goal,            label: "OKR & Goals",          path: "/okr" },
  feedback360:     { icon: Compass,         label: "Feedback 360°",        path: "/feedback360" },
  engagement:      { icon: HeartPulse,      label: "Survei Engagement",    path: "/engagement" },
  pulse:           { icon: Gauge,           label: "Pulse Survey",         path: "/pulse" },
  // Sumber Daya
  rooms:           { icon: DoorOpen,        label: "Pemesanan Ruangan",    path: "/rooms" },
  calls:           { icon: Mic,             label: "Online Meeting",       path: "/calls" },
  assets:          { icon: Package,         label: "Inventaris & Aset",    path: "/assets" },
  events:          { icon: PartyPopper,     label: "Event Perusahaan",     path: "/events" },
  documents:       { icon: FileText,        label: "Dokumen Perusahaan",   path: "/documents" },
  my_documents:    { icon: FolderLock,      label: "Dokumen Saya",         path: "/my-documents" },
  wiki:            { icon: BookOpen,        label: "Wiki & Pengetahuan",   path: "/wiki" },
  policies:        { icon: ScrollText,      label: "Kebijakan Perusahaan", path: "/policies" },
  // Manajemen SDM
  directory:       { icon: Users,             label: "Direktori Karyawan",  path: "/directory" },
  profile_verification: { icon: UserCog,      label: "Verifikasi Profil",   path: "/profile-verification" },
  organization:    { icon: Network,           label: "Struktur Organisasi", path: "/organization" },
  grading:         { icon: Scale,             label: "Grading & Job Eval",  path: "/grading" },
  jobs:            { icon: BriefcaseBusiness, label: "Lowongan Internal",   path: "/jobs" },
  recruitment:     { icon: UserSearch,        label: "Rekrutmen & ATS",     path: "/recruitment" },
  onboarding:      { icon: Rocket,            label: "Onboarding",          path: "/onboarding" },
  career_planning: { icon: Milestone,         label: "Perencanaan Karier",  path: "/career-planning" },
  training:        { icon: GraduationCap,     label: "Pelatihan",           path: "/training" },
  talent:          { icon: Sprout,            label: "Talent Management",   path: "/talent" },
  mentorship:      { icon: Handshake,         label: "Mentorship",          path: "/mentorship" },
  reports:         { icon: LineChart,         label: "Laporan HR",          path: "/reports" },
  analytics:       { icon: BarChart3,         label: "Dashboard Analitik",  path: "/analytics" },
  offboarding:     { icon: LogOut,            label: "Offboarding & Exit",  path: "/offboarding" },
  payroll:         { icon: Wallet,            label: "Payroll & Gaji",      path: "/payroll" },
  // Keuangan
  finance_dashboard: { icon: BarChart3,        label: "Dashboard Keuangan", path: "/finance-dashboard" },
  finance_audit:     { icon: FileText,         label: "Audit Trail",        path: "/finance-audit" },
  finance_settings:  { icon: SlidersHorizontal,label: "Pengaturan Keuangan",path: "/finance-settings" },
  // Administrasi
  admin:           { icon: Shield,          label: "Dashboard Admin",         path: "/admin" },
  user_management: { icon: Settings,        label: "Pengaturan Pengguna",     path: "/settings/users" },
  data_privacy:    { icon: ShieldCheck,     label: "Privasi & Akses Data",    path: "/data-privacy" },
  billing:         { icon: CreditCard,      label: "Langganan & Pembayaran",  path: "/billing" },
  support:         { icon: LifeBuoy,        label: "Bantuan IT",              path: "/support" },
  // Menus rendered outside the grouped nav (pinned or platform-only). Kept here
  // so NAV_META stays exhaustive over every MenuKey.
  home:            { icon: Home,            label: "Beranda",                 path: "/home" },
  my_profile:      { icon: UserCog,         label: "Data Profil Saya",        path: "/my-profile" },
  membership_settings:  { icon: Settings,   label: "Pengaturan Paket",        path: "/membership-settings" },
  promo_settings:       { icon: Settings,   label: "Promo & Upgrade",         path: "/promo-settings" },
  membership_dashboard: { icon: BarChart3,  label: "Pemantauan Keanggotaan",  path: "/membership-dashboard" },
};

// Build the grouped sidebar navigation from the shared SIDEBAR_GROUPS order.
const navGroups: ReadonlyArray<NavGroup> = SIDEBAR_GROUPS.map((group) => ({
  key: group.id,
  label: group.label,
  items: group.menus.map((key) => ({
    key,
    icon: NAV_META[key].icon,
    label: NAV_META[key].label,
    path: NAV_META[key].path,
  })),
}));

type NavGroupSectionProps = {
  group: NavGroup;
  visibleKeys: Set<MenuKey>;
  currentPath: string;
  onNav: (path: string) => void;
  badgeCounts: Record<string, number | undefined>;
  defaultOpen: boolean;
};

type NavItemButtonProps = {
  item: NavItem;
  isActive: boolean;
  badgeCounts: Record<string, number | undefined>;
  onNav: (path: string) => void;
  indent?: boolean;
};

// The "Pesan" badge keeps the primary-color style; every other badge uses the
// red "attention" pill. This map lets us style per menu without extra props.
const PRIMARY_BADGE_PATHS = new Set<string>(["/messages"]);
const VIOLET_BADGE_PATHS = new Set<string>(["/letters"]);

function NavItemButton({
  item,
  isActive,
  badgeCounts,
  onNav,
  indent = false,
}: NavItemButtonProps) {
  const count = badgeCounts[item.path] ?? 0;
  const showBadge = count > 0;
  const badgeClass = PRIMARY_BADGE_PATHS.has(item.path)
    ? "bg-primary text-primary-foreground"
    : VIOLET_BADGE_PATHS.has(item.path)
      ? "bg-violet-500 text-white"
      : "bg-red-500 text-white";
  return (
    <button
      onClick={() => onNav(item.path)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-md py-2 text-sm font-medium transition-colors",
        indent ? "pl-6 pr-3" : "px-3",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <item.icon className={cn("size-4 shrink-0", isActive && "text-primary")} />
      <span className="flex-1 truncate text-left" data-tour={`nav-${item.key}`}>{item.label}</span>
      {showBadge ? (
        <span
          className={cn(
            "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
            badgeClass,
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

type NavSubGroupSectionProps = {
  subGroup: NavSubGroup;
  visibleKeys: Set<MenuKey>;
  currentPath: string;
  onNav: (path: string) => void;
  badgeCounts: Record<string, number | undefined>;
};

function NavSubGroupSection({
  subGroup,
  visibleKeys,
  currentPath,
  onNav,
  badgeCounts,
}: NavSubGroupSectionProps) {
  const visibleItems = subGroup.items.filter((i) => visibleKeys.has(i.key));
  const hasActive = visibleItems.some(
    (i) =>
      currentPath === i.path ||
      (i.path !== "/dashboard" && currentPath.startsWith(`${i.path}/`))
  );
  const [open, setOpen] = useState(hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  if (visibleItems.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between pl-3 pr-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45 hover:text-sidebar-foreground hover:bg-sidebar-accent/20 transition-colors"
      >
        <span className="truncate">{subGroup.label}</span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 ml-1 transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {visibleItems.map((item) => {
            const isActive =
              currentPath === item.path ||
              (item.path !== "/dashboard" &&
                currentPath.startsWith(`${item.path}/`));
            return (
              <NavItemButton
                key={item.path}
                item={item}
                isActive={isActive}
                badgeCounts={badgeCounts}
                onNav={onNav}
                indent
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavGroupSection({
  group,
  visibleKeys,
  currentPath,
  onNav,
  badgeCounts,
  defaultOpen,
}: NavGroupSectionProps) {
  const visibleItems = group.items.filter((i) => visibleKeys.has(i.key));
  const visibleSubGroups = (group.subGroups ?? [])
    .map((sg) => ({
      ...sg,
      visibleItems: sg.items.filter((i) => visibleKeys.has(i.key)),
    }))
    .filter((sg) => sg.visibleItems.length > 0);

  const [open, setOpen] = useState(defaultOpen);

  const hasActiveInItems = visibleItems.some(
    (i) =>
      currentPath === i.path ||
      (i.path !== "/dashboard" && currentPath.startsWith(`${i.path}/`))
  );
  const hasActiveInSubGroups = visibleSubGroups.some((sg) =>
    sg.visibleItems.some(
      (i) =>
        currentPath === i.path ||
        (i.path !== "/dashboard" && currentPath.startsWith(`${i.path}/`))
    )
  );
  const hasActive = hasActiveInItems || hasActiveInSubGroups;

  // Show an attention dot on the collapsed group header when it contains any
  // item with a pending badge count. This keeps the indicator visible even
  // when the group is collapsed.
  const allPaths = [
    ...visibleItems.map((i) => i.path),
    ...visibleSubGroups.flatMap((sg) => sg.visibleItems.map((i) => i.path)),
  ];
  const showGroupDot = allPaths.some((p) => (badgeCounts[p] ?? 0) > 0);

  // Auto-expand group containing the active route
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  if (visibleItems.length === 0 && visibleSubGroups.length === 0) return null;

  return (
    <div className="mb-0.5">
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 mt-3 rounded-md text-xs font-semibold text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{group.label}</span>
          {showGroupDot && !open ? (
            <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 ml-1 transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>

      {/* Items + Sub-groups */}
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {visibleItems.map((item) => {
            const isActive =
              currentPath === item.path ||
              (item.path !== "/dashboard" &&
                currentPath.startsWith(`${item.path}/`));
            return (
              <NavItemButton
                key={item.path}
                item={item}
                isActive={isActive}
                badgeCounts={badgeCounts}
                onNav={onNav}
              />
            );
          })}
          {visibleSubGroups.map((sg) => (
            <NavSubGroupSection
              key={sg.key}
              subGroup={sg}
              visibleKeys={visibleKeys}
              currentPath={currentPath}
              onNav={onNav}
              badgeCounts={badgeCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { removeUser } = useAuth();
  const { isSuperAdmin } = useTenant();
  const allowedMenus = useQuery(api.userSettings.getMyAllowedMenus, {});
  const messagesUnread = useQuery(api.messages.getUnreadCount, {});
  const dispositionUnread = useQuery(api.letters.getMyDispositionUnreadCount, {});
  const incomingLetters = useQuery(api.letters.getIncomingLettersBadgeCount, {});
  const pendingApprovals = useQuery(api.letters.getMyPendingApprovalCount, {});
  const myUnfinished = useQuery(api.letters.getMyUnfinishedLetterCount, {});
  const supportUnread = useQuery(api.tickets.getSidebarBadgeCount, {});
  const notificationsUnread = useQuery(api.notifications.getUnreadCount, {});
  const profileVerificationPending = useQuery(
    api.profileChangeRequests.countPending,
    {},
  );
  const leavePending = useQuery(api.leaveRequests.getSidebarBadgeCount, {});
  const expensesPending = useQuery(api.expenses.getSidebarBadgeCount, {});
  const fundRequestsPending = useQuery(
    api.fundRequests.getSidebarBadgeCount,
    {},
  );
  const travelPending = useQuery(api.travel.getSidebarBadgeCount, {});
  const financePending = useQuery(
    api.financeDashboard.getSidebarBadgeCount,
    {},
  );
  const tasksPending = useQuery(api.projects.getSidebarBadgeCount, {});
  const recruitmentPending = useQuery(
    api.recruitment.applications.getSidebarBadgeCount,
    {},
  );
  const performancePending = useQuery(
    api.performance.getSidebarBadgeCount,
    {},
  );
  const feedback360Pending = useQuery(
    api.feedback360.reviews.getSidebarBadgeCount,
    {},
  );
  // Sidebar "Kelola Surat" badge = new arrivals + letters awaiting my approval
  // turn + my own unfinished letters that still need follow-up.
  const lettersIncoming =
    incomingLetters === undefined &&
    pendingApprovals === undefined &&
    myUnfinished === undefined
      ? undefined
      : (incomingLetters ?? 0) + (pendingApprovals ?? 0) + (myUnfinished ?? 0);

  // Per-path badge count map consumed by the nav. Keys are route paths; values
  // are the pending count (undefined while loading). Add new badges here.
  const badgeCounts: Record<string, number | undefined> = {
    "/messages": messagesUnread,
    "/letters": lettersIncoming,
    "/support": supportUnread,
    "/notifications": notificationsUnread,
    "/profile-verification": profileVerificationPending,
    "/leave": leavePending,
    "/expenses": expensesPending,
    "/fund-requests": fundRequestsPending,
    "/travel": travelPending,
    "/finance-dashboard": financePending,
    "/projects": tasksPending,
    "/recruitment": recruitmentPending,
    "/performance": performancePending,
    "/feedback360": feedback360Pending,
  };

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const allowedSet: Set<MenuKey> | null =
    allowedMenus === undefined ? null : new Set<MenuKey>(allowedMenus);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border shrink-0">
        <img
          src="https://hercules-cdn.com/file_TYr2Df58nZYpID6x8p76IO6J"
          alt="Star e-Office"
          className="size-8 rounded-lg object-cover shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[21px] font-bold text-sidebar-foreground tracking-tight">
            Star e-Office
          </span>
          <span className="text-[7px] font-medium text-sidebar-foreground/50 tracking-wide uppercase">
            Star Digital Office Platform
          </span>
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            title="Lipat sidebar"
            aria-label="Lipat sidebar"
            className="hidden shrink-0 cursor-pointer rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground lg:inline-flex"
          >
            <PanelLeftClose className="size-4.5" />
          </button>
        ) : null}
      </div>

      {/* Organization indicator */}
      <div className="border-b border-sidebar-border py-1">
        <OrgIndicator />
      </div>

      {/* Scoped-consent banner (vendor viewing a company with limited scopes) */}
      <ScopeAccessBanner />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
        {allowedSet === null ? (
          <div className="space-y-2 px-1 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
          {/* Beranda – always visible for all users */}
          <button
              onClick={() => handleNav("/home")}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                location.pathname === "/home"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Home className={cn("size-4 shrink-0", location.pathname === "/home" && "text-primary")} />
              <span className="truncate">Beranda</span>
            </button>
          {/* Data Profil Saya – always visible below Beranda */}
          <button
              onClick={() => handleNav("/my-profile")}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                location.pathname === "/my-profile"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <UserCog className={cn("size-4 shrink-0", location.pathname === "/my-profile" && "text-primary")} />
              <span className="truncate">Data Profil Saya</span>
            </button>
          {navGroups.map((group, idx) => (
            <NavGroupSection
              key={group.key}
              group={group}
              visibleKeys={allowedSet}
              currentPath={location.pathname}
              onNav={handleNav}
              badgeCounts={badgeCounts}
              defaultOpen={idx === 0}
            />
          ))}
          </>
        )}
      </nav>

      {/* Super Admin section - only visible to super admins */}
      {isSuperAdmin && (
        <div className="shrink-0 border-t border-sidebar-border px-2 py-2">
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Super Admin
          </p>
          <button
            onClick={() => handleNav("/super-admin")}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.pathname.startsWith("/super-admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Building2 className={cn("size-4 shrink-0", location.pathname.startsWith("/super-admin") && "text-primary")} />
            <span className="truncate">Super Admin Panel</span>
          </button>
        </div>
      )}

      {/* Bottom */}
      <div className="shrink-0 border-t border-sidebar-border px-2 py-3">
        <button
          onClick={async () => { try { await removeUser(); } catch { /* ignore */ } window.location.replace("/"); }}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          Keluar
        </button>
      </div>
    </div>
  );
}

function SuspendedScreen() {
  const { removeUser } = useAuth();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
            <Shield className="size-10 text-destructive" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">Akun Disuspend</h1>
        <p className="text-muted-foreground">
          Akun Anda telah dinonaktifkan sementara oleh administrator. Hubungi administrator untuk informasi lebih lanjut.
        </p>
        <Button variant="ghost" className="gap-2" onClick={async () => { try { await removeUser(); } catch { /* ignore */ } window.location.replace("/"); }}>
          <LogOut className="size-4" />
          Keluar
        </Button>
      </div>
    </div>
  );
}

function HeaderOrgName() {
  const { organization, isSuperAdmin } = useTenant();
  // Super admins get an interactive organization switcher instead of a label
  if (isSuperAdmin) {
    return <OrgSwitcher />;
  }
  if (!organization) return null;
  return (
    <div className="flex items-center gap-2">
      <Building2 className="size-4 shrink-0 text-primary" />
      <span className="text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]">
        {organization.name}
      </span>
    </div>
  );
}

type InfoSheetType = "privasi" | "keamanan" | null;

function AuthenticatedDashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [infoSheet, setInfoSheet] = useState<InfoSheetType>(null);
  const [showRoleRequest, setShowRoleRequest] = useState(false);
  // Desktop sidebar collapse state, persisted so it survives reloads.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("star_sidebar_collapsed") === "1";
  });
  const { removeUser } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const pendingRequest = useQuery(api.roleRequests.getMyPendingRequest, {});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Show onboarding dialog for brand-new users (no role set, not pending)
  const isNewUser =
    currentUser !== undefined &&
    !currentUser?.role &&
    !currentUser?.accountStatus &&
    pendingRequest !== undefined &&
    pendingRequest === null;

  // Brand-new users must complete onboarding first (fill profile, then create
  // or join an organization). This MUST render before NoOrganizationGuard,
  // otherwise the "not joined any organization" screen would block the dialog.
  // Users may dismiss the dialog (X/Escape) if they only wanted to look around —
  // we send them back to the landing page rather than showing a blank screen.
  if (isNewUser) {
    return (
      <div className="min-h-svh bg-background">
        <OnboardingDialog
          open={true}
          onClose={async () => {
            // New user chose to exit onboarding. Sign them out so they land on
            // the sign-in flow and can switch to a different account.
            try {
              await removeUser();
            } catch {
              /* ignore */
            }
            window.location.replace("/");
          }}
        />
      </div>
    );
  }

  // Suspended user guard
  if (currentUser?.accountStatus === "suspended") {
    return <SuspendedScreen />;
  }

  // Pending / rejected user guard – show dedicated screen
  if (
    currentUser?.accountStatus === "pending_approval" ||
    currentUser?.accountStatus === "rejected"
  ) {
    return (
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner className="size-8" /></div>}>
        <PendingApprovalScreen />
      </Suspense>
    );
  }

  const collapseSidebar = () => {
    setSidebarCollapsed(true);
    if (typeof window !== "undefined") localStorage.setItem("star_sidebar_collapsed", "1");
  };
  const expandSidebar = () => {
    setSidebarCollapsed(false);
    if (typeof window !== "undefined") localStorage.setItem("star_sidebar_collapsed", "0");
  };

  return (
    <TenantProvider>
    <NoOrganizationGuard>
    <>
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden w-60 shrink-0 border-r bg-sidebar overflow-hidden",
          sidebarCollapsed ? "lg:hidden" : "lg:block",
        )}
      >
        <SidebarContent onCollapse={collapseSidebar} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 h-full w-60 bg-sidebar">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:px-6">
          <Button
            size="icon-sm"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>

          {/* Desktop: reopen sidebar when collapsed */}
          {sidebarCollapsed ? (
            <Button
              size="icon-sm"
              variant="ghost"
              className="hidden lg:inline-flex"
              onClick={expandSidebar}
              title="Buka sidebar"
              aria-label="Buka sidebar"
            >
              <PanelLeft className="size-5" />
            </Button>
          ) : null}

          <HeaderOrgName />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            data-tour="search-bar"
            className="group flex h-9 min-w-0 flex-1 max-w-md cursor-pointer items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">
              <span className="hidden sm:inline">Cari karyawan, dokumen, wiki...</span>
              <span className="sm:hidden">Cari...</span>
            </span>
            <span className="hidden items-center gap-1 md:inline-flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div data-tour="notifications-bell">
            <NotificationsBell />
          </div>
          {/* Three-dot menu with 3 options: Panduan, Kebijakan Privasi, Keamanan */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                className="cursor-pointer text-muted-foreground hover:text-foreground"
                data-tour="more-menu"
              >
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className="cursor-pointer gap-3"
                onClick={() => setGuideOpen(true)}
              >
                <BookOpen className="size-4 text-blue-600 dark:text-blue-400" />
                <span>Panduan</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-3"
                onClick={() => setInfoSheet("privasi")}
              >
                <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Kebijakan Privasi</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-3"
                onClick={() => setInfoSheet("keamanan")}
              >
                <Shield className="size-4 text-amber-600 dark:text-amber-400" />
                <span>Keamanan</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <SubscriptionBanner />
          <PlanLimitBanner />
          <PlanRouteGuard>
            <PendingGrantGate>
              <Outlet />
            </PendingGrantGate>
          </PlanRouteGuard>
        </main>

        {/* Mobile bottom navigation */}
        <BottomNav onMenuClick={() => setMobileOpen(true)} />
      </div>

      <Omnisearch open={searchOpen} onOpenChange={setSearchOpen} />
      <GuideSheet open={guideOpen} onOpenChange={setGuideOpen} navGroups={navGroups} />

      {/* Kebijakan Privasi Sheet */}
      <Sheet open={infoSheet === "privasi"} onOpenChange={(open) => { if (!open) setInfoSheet(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Lock className="size-5 text-emerald-600 dark:text-emerald-400" />
              Kebijakan Privasi
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-100px)] pr-4">
            <PrivasiSheetContent />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Keamanan Sheet */}
      <Sheet open={infoSheet === "keamanan"} onOpenChange={(open) => { if (!open) setInfoSheet(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Shield className="size-5 text-amber-600 dark:text-amber-400" />
              Keamanan
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-100px)] pr-4">
            <KeamananSheetContent />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <ChatbotFab />
      <ProductTour />
      <NewMessageNotifier />
      <ProfileCompletionGate />
    </div>

    {showRoleRequest && (
      <RoleRequestDialog
        open={showRoleRequest}
        onClose={() => setShowRoleRequest(false)}
      />
    )}
    </>
    </NoOrganizationGuard>
    </TenantProvider>
  );
}

export default function DashboardLayout() {
  return (
    <>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center">
          <div className="space-y-4 text-center">
            <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background px-6">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
            <Sparkles className="size-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Masuk Star e-Office</h1>
          <p className="max-w-sm text-center text-muted-foreground">
            Silakan masuk untuk mengakses workspace digital perusahaan Anda.
          </p>
          <SignInButton signInText="Masuk" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedDashboard />
      </Authenticated>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom Navigation (Mobile)                                        */
/* ------------------------------------------------------------------ */

function BottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const messagesUnread = useQuery(api.messages.getUnreadCount, {});
  const dispositionUnread = useQuery(api.letters.getMyDispositionUnreadCount, {});
  const lettersIncoming = useQuery(api.letters.getIncomingLettersBadgeCount, {});
  const pendingApprovals = useQuery(api.letters.getMyPendingApprovalCount, {});
  const myUnfinished = useQuery(api.letters.getMyUnfinishedLetterCount, {});
  const todayDate = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
  const todayAttendance = useQuery(api.attendance.getTodayRecord, { date: todayDate });

  // Announcements: track last viewed timestamp in localStorage
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);
  const announcements = useQuery(api.announcements.listNews, {});

  useEffect(() => {
    if (!announcements || announcements.length === 0) {
      setHasNewAnnouncements(false);
      return;
    }
    const lastViewed = localStorage.getItem("star_news_last_viewed");
    const latestPublished = announcements[0]?.publishedAt;
    if (!lastViewed || (latestPublished && latestPublished > lastViewed)) {
      setHasNewAnnouncements(true);
    } else {
      setHasNewAnnouncements(false);
    }
  }, [announcements]);

  // Mark announcements as read when user visits /news
  useEffect(() => {
    if (location.pathname.startsWith("/news") && announcements && announcements.length > 0) {
      localStorage.setItem("star_news_last_viewed", announcements[0].publishedAt);
      setHasNewAnnouncements(false);
    }
  }, [location.pathname, announcements]);

  // Determine which items have a red dot
  const hasAttendanceDot = todayAttendance !== undefined && todayAttendance === null;
  const hasLettersDot =
    ((dispositionUnread ?? 0) + (lettersIncoming ?? 0) + (pendingApprovals ?? 0) + (myUnfinished ?? 0)) > 0;
  const hasMessagesDot = messagesUnread !== undefined && messagesUnread > 0;

  const items = [
    { icon: Home, label: "Home", path: "/home", onClick: null, hasDot: false },
    { icon: Clock, label: "Absensi", path: "/attendance", onClick: null, hasDot: hasAttendanceDot },
    { icon: MailOpen, label: "Surat", path: "/letters", onClick: null, hasDot: hasLettersDot },
    { icon: Newspaper, label: "Pengumuman", path: "/news", onClick: null, hasDot: hasNewAnnouncements },
    { icon: MessageSquare, label: "Pesan", path: "/messages", onClick: null, hasDot: hasMessagesDot },
    { icon: Menu, label: "Menu", path: null, onClick: onMenuClick, hasDot: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-card/95 backdrop-blur-sm lg:hidden">
      {items.map((item) => {
        const isActive = item.path ? (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) : false;
        return (
          <button
            key={item.label}
            onClick={() => {
              if (item.onClick) {
                item.onClick();
              } else if (item.path) {
                navigate(item.path);
              }
            }}
            className={cn(
              "relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className={cn("size-5", isActive && "text-primary")} />
            <span>{item.label}</span>
            {/* Red dot indicator */}
            {item.hasDot && !isActive && (
              <span className="absolute right-1/4 top-1 size-2.5 rounded-full bg-red-500 ring-2 ring-card/95" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Privacy Policy Sheet Content                                      */
/* ------------------------------------------------------------------ */

const PRIVACY_ITEMS = [
  {
    title: "Pengumpulan Data",
    desc: "Kami mengumpulkan data yang diperlukan untuk operasional aplikasi, termasuk informasi profil, email, dan data aktivitas kerja. Semua data dikumpulkan dengan persetujuan pengguna.",
  },
  {
    title: "Penyimpanan Data",
    desc: "Data disimpan di server terenkripsi dengan standar AES-256. Lokasi server berada di data center bersertifikasi internasional dengan uptime 99.9%.",
  },
  {
    title: "Penggunaan Data",
    desc: "Data hanya digunakan untuk menjalankan layanan Star e-Office. Kami tidak menjual, menyewakan, atau membagikan data pribadi kepada pihak ketiga tanpa persetujuan.",
  },
  {
    title: "Hak Pengguna",
    desc: "Pengguna berhak mengakses, mengubah, dan menghapus data pribadinya. Permintaan penghapusan data dapat diajukan melalui admin organisasi atau menghubungi tim support.",
  },
  {
    title: "Cookie & Penyimpanan Lokal",
    desc: "Aplikasi menggunakan cookie dan local storage untuk menyimpan preferensi dan sesi login. Data ini hanya digunakan untuk meningkatkan pengalaman pengguna.",
  },
];

function PrivasiSheetContent() {
  return (
    <div className="flex flex-col gap-5 pb-8">
      {PRIVACY_ITEMS.map((item, i) => (
        <div key={i}>
          <h4 className="mb-1.5 text-sm font-semibold text-foreground">
            {i + 1}. {item.title}
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.desc}
          </p>
        </div>
      ))}
      <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Dengan menggunakan Star e-Office, Anda menyetujui kebijakan privasi ini.
          Kebijakan dapat diperbarui sewaktu-waktu dan perubahan akan diinformasikan
          melalui aplikasi.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Security Sheet Content                                            */
/* ------------------------------------------------------------------ */

const SECURITY_ITEMS = [
  {
    title: "Enkripsi End-to-End",
    desc: "Semua komunikasi data antara perangkat dan server dilindungi dengan enkripsi SSL/TLS. Data sensitif dienkripsi dengan AES-256.",
  },
  {
    title: "Autentikasi Aman",
    desc: "Sistem login menggunakan protokol OIDC (OpenID Connect) dengan dukungan multi-factor authentication (MFA) melalui Google, Apple, Microsoft, dan email OTP.",
  },
  {
    title: "Role-Based Access Control",
    desc: "Setiap pengguna memiliki peran (role) yang mengatur akses ke fitur dan data. Admin dapat mengonfigurasi hak akses sesuai kebutuhan organisasi.",
  },
  {
    title: "Audit Trail",
    desc: "Semua aktivitas penting dicatat dalam log audit yang dapat ditinjau oleh admin. Termasuk login, perubahan data, dan akses dokumen.",
  },
  {
    title: "Keamanan Infrastruktur",
    desc: "Server di-host di infrastruktur cloud bersertifikasi dengan perlindungan DDoS, firewall berlapis, dan monitoring 24/7.",
  },
  {
    title: "Backup & Recovery",
    desc: "Data di-backup secara berkala untuk memastikan pemulihan cepat jika terjadi gangguan. Prosedur disaster recovery tersedia untuk situasi darurat.",
  },
];

function KeamananSheetContent() {
  return (
    <div className="flex flex-col gap-5 pb-8">
      {SECURITY_ITEMS.map((item, i) => (
        <div key={i} className="flex gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {item.title}
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.desc}
            </p>
          </div>
        </div>
      ))}
      <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Star e-Office berkomitmen menjaga keamanan data organisasi Anda.
          Jika menemukan celah keamanan, silakan laporkan ke tim kami.
        </p>
      </div>
    </div>
  );
}
