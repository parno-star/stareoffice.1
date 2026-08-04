import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ShieldAlert } from "lucide-react";

/**
 * Categories that can be gated for super admins.
 * Must stay in sync with DATA_CATEGORIES in convex/superAdminDataAccess.ts.
 */
export type DataCategory =
  | "leave"
  | "letters"
  | "messages"
  | "documents"
  | "directory"
  | "reports";

/**
 * Banner shown ONLY to a super admin who is currently blocked from reading a
 * given operational data category. Regular users never see this — the query
 * returns blocked=false for them, so the banner renders nothing.
 *
 * Place it near the top of a page/section. When visible, the underlying data
 * queries also return empty, so the super admin sees no organization data.
 */
export function DataAccessBanner({
  category,
  className,
}: {
  category: DataCategory;
  className?: string;
}) {
  const access = useQuery(api.superAdminDataAccess.getMyCategoryAccess, {
    category,
  });

  // Loading, or not blocked → render nothing.
  if (!access || !access.blocked) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200${className ? ` ${className}` : ""}`}
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">Akses data dibatasi</p>
        <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
          Demi keamanan dan privasi data setiap organisasi, akses ke data ini
          hanya terbuka setelah organisasi menyetujui permintaan akses Anda dan
          mencakup kategori data ini. Ajukan permintaan akses, lalu tunggu
          persetujuan dari organisasi terkait.
        </p>
      </div>
    </div>
  );
}

export default DataAccessBanner;
