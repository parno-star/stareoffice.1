import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { scopeLabel } from "@/convex/dataScopes.ts";
import { ShieldCheck } from "lucide-react";

/**
 * Sidebar banner shown to a vendor (super admin) who is currently viewing a
 * company through a SCOPED consent grant. It states exactly which data
 * categories the company approved, so the limited menu set is understood as
 * intentional (scoped consent) rather than a glitch. Renders nothing for
 * normal users and unrestricted super admins.
 */
export default function ScopeAccessBanner() {
  const info = useQuery(api.dataAccess.getMyEffectiveScopes, {});
  if (!info || !info.restricted) return null;

  return (
    <div className="mx-2 my-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 shrink-0 text-primary" />
        <span className="text-[11px] font-semibold text-sidebar-foreground">
          Akses terbatas kategori
        </span>
      </div>
      {info.scopes.length === 0 ? (
        <p className="mt-1 text-[10px] leading-snug text-sidebar-foreground/60">
          Perusahaan belum menyetujui kategori data apa pun untuk Anda.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {info.scopes.map((s) => (
            <span
              key={s}
              className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-medium text-primary"
            >
              {scopeLabel(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
