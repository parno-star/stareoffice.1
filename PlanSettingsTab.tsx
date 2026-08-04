import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { Plus, Package, Sparkles, FileDown } from "lucide-react";
import { toast } from "sonner";
import PlanCard from "@/pages/membership-settings/_components/PlanCard.tsx";
import PlanFormDialog from "@/pages/membership-settings/_components/PlanFormDialog.tsx";
import { generatePlansFeaturePdf } from "@/pages/membership-settings/_lib/generate-plans-pdf.ts";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

export default function PlanSettingsTab() {
  const plans = useQuery(api.membership.list, {});
  const seedDefaults = useMutation(api.membership.seedDefaults);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Doc<"membershipPlans"> | null>(
    null,
  );
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDefaults({});
      toast.success("Paket default berhasil dibuat!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal membuat paket default";
      toast.error(message);
    } finally {
      setSeeding(false);
    }
  };

  const handleDownloadPdf = () => {
    if (plans === undefined) return;
    try {
      generatePlansFeaturePdf(plans);
      toast.success("PDF daftar fitur berhasil diunduh.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membuat PDF.";
      toast.error(message);
    }
  };

  if (plans === undefined) {
    return (
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Paket Keanggotaan
          </h2>
          <p className="text-sm text-muted-foreground">
            Kelola paket langganan, harga, batas fitur, dan modul yang
            tersedia.
          </p>
        </div>
        <Button
          className="cursor-pointer gap-2"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="size-4" />
          Tambah Paket
        </Button>
      </div>

      {plans.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>Belum ada paket keanggotaan</EmptyTitle>
            <EmptyDescription>
              Buat paket baru secara manual atau gunakan template default untuk
              memulai dengan cepat.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                className="cursor-pointer gap-2"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="size-4" />
                Buat Manual
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="cursor-pointer gap-2"
                onClick={handleSeed}
                disabled={seeding}
              >
                <Sparkles className="size-4" />
                {seeding ? "Membuat..." : "Gunakan Template Default"}
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan._id}
                plan={plan}
                onEdit={() => setEditingPlan(plan)}
              />
            ))}
          </div>

          {/* Marketing: download all features as PDF */}
          <div className="flex justify-center border-t pt-6">
            <Button
              size="sm"
              variant="secondary"
              className="cursor-pointer gap-2"
              onClick={handleDownloadPdf}
            >
              <FileDown className="size-4" />
              Unduh Semua Fitur (PDF)
            </Button>
          </div>
        </>
      )}

      {/* Create dialog */}
      <PlanFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        plan={null}
        existingCount={plans.length}
      />

      {/* Edit dialog */}
      {editingPlan && (
        <PlanFormDialog
          open={!!editingPlan}
          onOpenChange={(open) => {
            if (!open) setEditingPlan(null);
          }}
          plan={editingPlan}
          existingCount={plans.length}
        />
      )}
    </div>
  );
}
