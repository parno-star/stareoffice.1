import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import AdminEditEmployeeDialog from "./AdminEditEmployeeDialog.tsx";

type Props = {
  employee: Doc<"users">;
  canDelete?: boolean;
  variant?: "icon" | "button";
};

// Dropdown menu with "Edit Data" and "Hapus" actions for administrators.
// Used on directory cards, list rows, and detail page.
export default function EmployeeActionsMenu({
  employee,
  canDelete,
  variant = "icon",
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteEmployee = useMutation(api.users.deleteEmployeeByAdmin);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteEmployee({ userId: employee._id });
      toast.success(`${employee.name ?? "Karyawan"} telah dihapus`);
      setConfirmOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal menghapus karyawan");
      } else {
        toast.error("Gagal menghapus karyawan");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Menu tindakan"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              aria-label="Menu tindakan"
            >
              <MoreHorizontal className="size-4" />
              Kelola
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
            className="cursor-pointer gap-2"
          >
            <Pencil className="size-4" />
            Edit Data
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                }}
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Hapus Karyawan
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen ? (
        <AdminEditEmployeeDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          employee={employee}
        />
      ) : null}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!deleting) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {employee.name ?? "karyawan ini"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Karyawan akan dihapus dari direktori dan tidak dapat lagi masuk ke
              sistem. Data historis (cuti, dokumen, dll.) tetap tersimpan untuk
              keperluan audit. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
