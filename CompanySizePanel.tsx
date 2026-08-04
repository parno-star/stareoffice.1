import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SIZE_BAND_CONFIG } from "../_lib/grading-utils.ts";
import { ConvexError } from "convex/values";

export default function CompanySizePanel() {
  const sizes = useQuery(api.grading.listCompanySizes, {});
  const departments = useQuery(api.users.listDepartments, {});
  const setSize = useMutation(api.grading.setCompanySize);
  const removeSize = useMutation(api.grading.deleteCompanySize);

  const [scope, setScope] = useState("");
  const [sizeBand, setSizeBand] = useState("C");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // We use " " for the Default option in Select since SelectItem can't be "".
      const effectiveScope = scope.trim();
      await setSize({
        scope: effectiveScope,
        sizeBand,
        note: note.trim() || undefined,
      });
      toast.success("Company size disimpan");
      setScope("");
      setNote("");
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string };
        toast.error(data.message ?? "Gagal menyimpan");
      } else {
        toast.error("Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  const defaultRow = sizes?.find((s) => s.scope === "");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <div className="mb-3">
            <h3 className="font-semibold">Company Size Band</h3>
            <p className="text-xs text-muted-foreground">
              Ukuran perusahaan mempengaruhi Global Grade final. Set satu nilai
              default (kosongkan "Scope"), lalu override per departemen bila
              perlu.
            </p>
          </div>
          {sizes === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : sizes.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Settings2 />
                </EmptyMedia>
                <EmptyTitle>Belum ada size band</EmptyTitle>
                <EmptyDescription>
                  Set default company size band agar proses grading bisa
                  berjalan.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-2">
              {sizes.map((s) => {
                const cfg = SIZE_BAND_CONFIG[s.sizeBand];
                return (
                  <div
                    key={s._id}
                    className="flex items-start justify-between gap-2 rounded-lg border bg-muted/30 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {s.scope === "" ? "Default (Company-Wide)" : s.scope}
                        </Badge>
                        <Badge className="bg-primary/10 text-primary">
                          {cfg?.label ?? s.sizeBand}
                        </Badge>
                      </div>
                      {cfg ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cfg.description}
                        </p>
                      ) : null}
                      {s.note ? (
                        <p className="mt-1 text-xs">{s.note}</p>
                      ) : null}
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="cursor-pointer text-destructive"
                      onClick={async () => {
                        if (!window.confirm("Hapus row ini?")) return;
                        await removeSize({ id: s._id });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="font-semibold">
            {defaultRow ? "Tambah / Update Override" : "Set Default"}
          </h3>
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger>
                <SelectValue placeholder="Default (kosong) atau departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Default (Company-Wide)</SelectItem>
                {(departments ?? []).map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Pilih "Default" untuk size band perusahaan, atau pilih departemen
              untuk override.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Size Band</Label>
            <Select value={sizeBand} onValueChange={setSizeBand}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SIZE_BAND_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label} ({v.shift >= 0 ? "+" : ""}
                    {v.shift} grade)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Catatan</Label>
            <Textarea
              rows={2}
              placeholder="Headcount/revenue/kompleksitas organisasi"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Input type="hidden" value={scope} readOnly />
          <Button
            className="w-full cursor-pointer"
            onClick={() => {
              // Treat empty-scope selection: our Select uses " " for default
              handleSave();
            }}
            disabled={saving}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
