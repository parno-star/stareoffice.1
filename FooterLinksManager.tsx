import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { Link2, RefreshCw, Save } from "lucide-react";

type LinkState = {
  _id: Id<"footerLinks">;
  group: string;
  label: string;
  order: number;
  isActive: boolean;
};

const GROUP_ORDER = ["Produk", "Perusahaan", "Dukungan", "Legal"];

export default function FooterLinksManager() {
  const allLinks = useQuery(api.footerLinks.getAllFooterLinks, {});
  const seedDefaults = useMutation(api.footerLinks.seedDefaults);
  const bulkToggle = useMutation(api.footerLinks.bulkToggle);

  const [localLinks, setLocalLinks] = useState<LinkState[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Sync from server
  useEffect(() => {
    if (allLinks) {
      setLocalLinks(allLinks);
      setHasChanges(false);
    }
  }, [allLinks]);

  const handleToggle = (linkId: Id<"footerLinks">, checked: boolean) => {
    setLocalLinks((prev) =>
      prev.map((l) => (l._id === linkId ? { ...l, isActive: checked } : l)),
    );
    setHasChanges(true);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDefaults({});
      toast.success("Data footer berhasil diinisialisasi");
    } catch {
      toast.error("Gagal menginisialisasi data footer");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async () => {
    if (!allLinks) return;
    // Find what changed
    const updates: Array<{ linkId: Id<"footerLinks">; isActive: boolean }> = [];
    for (const local of localLinks) {
      const original = allLinks.find((l) => l._id === local._id);
      if (original && original.isActive !== local.isActive) {
        updates.push({ linkId: local._id, isActive: local.isActive });
      }
    }
    if (updates.length === 0) {
      setHasChanges(false);
      return;
    }
    setIsSaving(true);
    try {
      await bulkToggle({ updates });
      toast.success(`${updates.length} link berhasil diperbarui`);
      setHasChanges(false);
    } catch {
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (allLinks) {
      setLocalLinks(allLinks);
      setHasChanges(false);
    }
  };

  // Loading state
  if (allLinks === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // If table is empty, show seed button
  if (allLinks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-5" />
            Kelola Link Footer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Data link footer belum diinisialisasi. Klik tombol di bawah untuk membuat data default.
          </p>
          <Button onClick={handleSeed} disabled={isSeeding} className="cursor-pointer">
            {isSeeding ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Inisialisasi Data Footer
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Group links by category
  const grouped = new Map<string, LinkState[]>();
  for (const l of localLinks) {
    const arr = grouped.get(l.group) ?? [];
    arr.push(l);
    grouped.set(l.group, arr);
  }
  // Sort within groups
  for (const [, arr] of grouped) {
    arr.sort((a, b) => a.order - b.order);
  }

  const activeCount = localLinks.filter((l) => l.isActive).length;
  const totalCount = localLinks.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-5" />
            Kelola Link Footer
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} dari {totalCount} link aktif ditampilkan di landing page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="cursor-pointer">
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Simpan
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {GROUP_ORDER.filter((g) => grouped.has(g)).map((groupName) => {
          const links = grouped.get(groupName)!;
          const groupActive = links.filter((l) => l.isActive).length;
          return (
            <div key={groupName} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{groupName}</h3>
                <Badge variant="secondary" className="text-xs">
                  {groupActive}/{links.length}
                </Badge>
              </div>
              <div className="divide-y rounded-lg border">
                {links.map((link) => (
                  <div
                    key={link._id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span
                      className={`text-sm ${link.isActive ? "text-foreground" : "text-muted-foreground line-through"}`}
                    >
                      {link.label}
                    </span>
                    <Switch
                      checked={link.isActive}
                      onCheckedChange={(checked) => handleToggle(link._id, checked)}
                      className="cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
