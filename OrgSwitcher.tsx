import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useTenant } from "@/hooks/use-tenant.ts";
import { useDebounce } from "@/hooks/use-debounce.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Globe,
  Loader2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import AccessRequestDialog from "@/components/AccessRequestDialog.tsx";

/**
 * Global organization switcher for super admins. Lets them pick which
 * organization the entire app is scoped to. Uses a searchable dropdown so it
 * stays fast even with thousands of organizations. The selection persists on
 * the user record (survives refresh & re-login) via setViewingOrganization.
 *
 * Renders nothing for non-super-admins.
 */
export default function OrgSwitcher() {
  const { isSuperAdmin, organization, isLoading } = useTenant();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 250);
  const [switching, setSwitching] = useState<string | null>(null);

  const results = useQuery(
    api.organizations.searchForSwitcher,
    open ? { search: debouncedSearch.trim() || undefined } : "skip",
  );
  // Sample/demo org used as the default label when viewing platform-wide.
  const sampleOrg = useQuery(
    api.organizations.getSampleOrgForSwitcher,
    isSuperAdmin ? {} : "skip",
  );
  const setViewing = useMutation(api.organizations.setViewingOrganization);

  // Company selected for an access request (opens the consent dialog).
  const [accessTarget, setAccessTarget] = useState<{
    id: Id<"organizations">;
    name: string;
  } | null>(null);

  // Only super admins get the switcher
  if (!isSuperAdmin) return null;

  // Returning to the platform-wide view (leaving a company) is always allowed
  // and requires no consent — it never exposes tenant data.
  const handleLeave = async () => {
    setSwitching("all");
    try {
      await setViewing({ organizationId: null });
      setOpen(false);
      setSearch("");
      window.location.reload();
    } catch (err) {
      if (err instanceof ConvexError) {
        const d = err.data as { message?: string };
        toast.error(d.message ?? "Gagal mengganti organisasi");
      } else {
        toast.error("Terjadi kesalahan, coba lagi");
      }
      setSwitching(null);
    }
  };

  // Entering a company opens the consent-first access dialog instead of
  // switching silently.
  const handleSelectCompany = (
    organizationId: Id<"organizations">,
    name: string,
  ) => {
    setOpen(false);
    setAccessTarget({ id: organizationId, name });
  };

  const currentLabel = isLoading
    ? "Memuat..."
    : (organization?.name ?? sampleOrg?.name ?? "Semua Organisasi");

  // Show a company icon when viewing an org, or when defaulting to the sample org.
  const showCompanyIcon = Boolean(organization) || Boolean(sampleOrg);

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 border bg-muted/40 px-2.5 text-sm font-medium hover:bg-muted cursor-pointer max-w-[190px]"
        >
          {showCompanyIcon ? (
            <Building2 className="size-4 shrink-0 text-primary" />
          ) : (
            <Globe className="size-4 shrink-0 text-primary" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">
            {currentLabel}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Cari organisasi..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {/* Platform-wide option */}
            <CommandGroup heading="Tampilan">
              <CommandItem
                value="__all__"
                onSelect={() => handleLeave()}
                className="cursor-pointer gap-2"
              >
                <Globe className="size-4 shrink-0 text-primary" />
                <span className="flex-1">Semua Organisasi</span>
                {switching === "all" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  !organization && <Check className="size-4 text-primary" />
                )}
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Organisasi">
              {results === undefined ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Mencari...
                </div>
              ) : results.length === 0 ? (
                <CommandEmpty>Tidak ada organisasi yang cocok.</CommandEmpty>
              ) : (
                results.map((org) => {
                  const isCurrent = organization?._id === org._id;
                  return (
                    <CommandItem
                      key={org._id}
                      value={org._id}
                      onSelect={() => handleSelectCompany(org._id, org.name)}
                      className="cursor-pointer gap-2"
                    >
                      <Building2
                        className={cn(
                          "size-4 shrink-0",
                          org.isActive
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate">
                          <span className="truncate">{org.name}</span>
                          {org.isSampleOrg && (
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              Contoh
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3" />
                          {org.userCount} pengguna
                          {!org.isActive && " · nonaktif"}
                        </p>
                      </div>
                      {isCurrent && <Check className="size-4 text-primary" />}
                    </CommandItem>
                  );
                })
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {accessTarget && (
      <AccessRequestDialog
        organizationId={accessTarget.id}
        organizationName={accessTarget.name}
        open={accessTarget !== null}
        onOpenChange={(o) => {
          if (!o) setAccessTarget(null);
        }}
      />
    )}
    </>
  );
}
