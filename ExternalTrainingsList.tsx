import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  BadgeCheck,
  BadgeX,
  Building2,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import ExternalTrainingDialog from "./ExternalTrainingDialog.tsx";
import {
  EXTERNAL_STATUS_LABEL,
  formatIdDate,
  formatIdr,
} from "../_lib/advanced-utils.ts";
import { getCategoryConfig } from "../_lib/training-utils.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";

function CertificateLink({ storageId }: { storageId: Id<"_storage"> }) {
  const url = useQuery(api.training.external.getCertificateUrl, {
    storageId,
  });
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      <FileText className="size-3.5" /> Unduh sertifikat
      <ExternalLink className="size-3" />
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "gap-1 border-transparent",
        status === "approved" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "rejected" &&
          "bg-red-500/15 text-red-700 dark:text-red-300",
        status === "pending" &&
          "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      )}
    >
      {status === "approved" ? (
        <BadgeCheck className="size-3" />
      ) : status === "rejected" ? (
        <BadgeX className="size-3" />
      ) : (
        <Clock className="size-3" />
      )}
      {EXTERNAL_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

type Row = Doc<"externalTrainings"> & {
  userName?: string | null;
  userDepartment?: string | null;
};

function RowItem({
  row,
  isAdmin,
  onReview,
  onDelete,
}: {
  row: Row;
  isAdmin: boolean;
  onReview?: (id: Id<"externalTrainings">, status: "approved" | "rejected") => void;
  onDelete: (id: Id<"externalTrainings">) => void;
}) {
  const cat = getCategoryConfig(row.category);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold">{row.title}</h4>
              <StatusBadge status={row.status} />
              <Badge variant="secondary">{cat.label}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {row.provider}
              </span>
              <span>Selesai: {formatIdDate(row.completedDate)}</span>
              {row.durationHours ? (
                <span>{row.durationHours} jam</span>
              ) : null}
              {row.cost ? <span>{formatIdr(row.cost)}</span> : null}
              {row.expiryDate ? (
                <span>Exp: {formatIdDate(row.expiryDate)}</span>
              ) : null}
            </div>
            {row.description ? (
              <p className="text-sm text-muted-foreground">
                {row.description}
              </p>
            ) : null}
            {isAdmin && row.userName ? (
              <p className="text-xs font-medium text-muted-foreground">
                Oleh: {row.userName}
                {row.userDepartment ? ` · ${row.userDepartment}` : ""}
              </p>
            ) : null}
            {row.reviewNote ? (
              <p className="rounded border bg-muted/40 p-2 text-xs">
                Catatan reviewer: {row.reviewNote}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              {row.certificateStorageId ? (
                <CertificateLink storageId={row.certificateStorageId} />
              ) : null}
              {row.certificateUrl ? (
                <a
                  href={row.certificateUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3" /> Link sertifikat
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && onReview && row.status === "pending" ? (
              <>
                <Button
                  size="sm"
                  onClick={() => onReview(row._id, "approved")}
                  className="cursor-pointer gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check className="size-4" /> Setujui
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onReview(row._id, "rejected")}
                  className="cursor-pointer gap-1 text-red-600"
                >
                  <X className="size-4" /> Tolak
                </Button>
              </>
            ) : null}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus entri ini?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sertifikat dan datanya akan hilang permanen.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">
                    Batal
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(row._id)}
                    className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Hapus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExternalTrainingsList({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<"mine" | "all" | "pending">("mine");
  const myList = useQuery(api.training.external.listMyExternalTrainings, {});
  const allList = useQuery(
    api.training.external.listAllExternalTrainings,
    isAdmin && tab !== "mine" ? { status: "all" } : "skip",
  );
  const pendingList = useQuery(
    api.training.external.listPendingExternalTrainings,
    isAdmin && tab === "pending" ? {} : "skip",
  );

  const review = useMutation(api.training.external.reviewExternalTraining);
  const deleteEntry = useMutation(api.training.external.deleteExternalTraining);

  const handleReview = async (
    id: Id<"externalTrainings">,
    status: "approved" | "rejected",
  ) => {
    try {
      await review({ id, status });
      toast.success(
        status === "approved" ? "Disetujui" : "Ditolak",
      );
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? ((err.data as { message?: string }).message ?? "Gagal")
          : "Gagal";
      toast.error(msg);
    }
  };

  const handleDelete = async (id: Id<"externalTrainings">) => {
    try {
      await deleteEntry({ id });
      toast.success("Dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const addButton = (
    <ExternalTrainingDialog
      trigger={
        <Button size="sm" className="cursor-pointer gap-1">
          <Plus className="size-4" /> Tambah sertifikat
        </Button>
      }
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pelatihan Eksternal</h2>
          <p className="text-sm text-muted-foreground">
            Unggah sertifikat pelatihan dari luar perusahaan untuk diverifikasi
            admin.
          </p>
        </div>
        {addButton}
      </div>

      {isAdmin ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="mine" className="cursor-pointer">
              Saya
            </TabsTrigger>
            <TabsTrigger value="pending" className="cursor-pointer gap-1">
              Menunggu
            </TabsTrigger>
            <TabsTrigger value="all" className="cursor-pointer">
              Semua
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-4 space-y-3">
            <MyList
              list={myList}
              onDelete={handleDelete}
              isAdmin={false}
              addButton={addButton}
            />
          </TabsContent>
          <TabsContent value="pending" className="mt-4 space-y-3">
            <AdminList
              list={pendingList}
              onReview={handleReview}
              onDelete={handleDelete}
              emptyMessage="Tidak ada sertifikat menunggu review"
            />
          </TabsContent>
          <TabsContent value="all" className="mt-4 space-y-3">
            <AdminList
              list={allList}
              onReview={handleReview}
              onDelete={handleDelete}
              emptyMessage="Belum ada sertifikat eksternal"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <MyList
          list={myList}
          onDelete={handleDelete}
          isAdmin={false}
          addButton={addButton}
        />
      )}
    </div>
  );
}

function MyList({
  list,
  onDelete,
  isAdmin,
  addButton,
}: {
  list: Array<Doc<"externalTrainings">> | undefined;
  onDelete: (id: Id<"externalTrainings">) => void;
  isAdmin: boolean;
  addButton: React.ReactNode;
}) {
  if (list === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (list.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>Belum ada sertifikat eksternal</EmptyTitle>
          <EmptyDescription>
            Dokumentasikan pelatihan Anda dari luar perusahaan agar tercatat.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{addButton}</EmptyContent>
      </Empty>
    );
  }
  return (
    <div className="space-y-3">
      {list.map((row) => (
        <RowItem
          key={row._id}
          row={row}
          isAdmin={isAdmin}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function AdminList({
  list,
  onReview,
  onDelete,
  emptyMessage,
}: {
  list: Array<Row> | undefined;
  onReview: (
    id: Id<"externalTrainings">,
    status: "approved" | "rejected",
  ) => void;
  onDelete: (id: Id<"externalTrainings">) => void;
  emptyMessage: string;
}) {
  if (list === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (list.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {list.map((row) => (
        <RowItem
          key={row._id}
          row={row}
          isAdmin={true}
          onReview={onReview}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
