import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PenLine, Trash2, ShieldCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import SignaturePad from "./SignaturePad.tsx";

type Props = {
  letterId: Id<"letters">;
};

const ROLE_LABELS: Record<string, string> = {
  penandatangan: "Penandatangan",
  mengetahui: "Mengetahui",
  menyetujui: "Menyetujui",
  saksi: "Saksi",
  penerima: "Penerima",
};

export default function SignatureSection({ letterId }: Props) {
  const [open, setOpen] = useState(false);
  const signatures = useQuery(api.letters.listLetterSignatures, { letterId });
  const mySignature = useQuery(api.letters.getUserSignature, { letterId });
  const saveSignature = useMutation(api.letters.saveSignature);
  const deleteSignature = useMutation(api.letters.deleteSignature);

  const handleSave = async (data: string, type: "drawn" | "typed" | "upload", role: string) => {
    try {
      await saveSignature({ letterId, signatureData: data, signatureType: type, role });
      toast.success("Tanda tangan berhasil disimpan");
      setOpen(false);
    } catch {
      toast.error("Gagal menyimpan tanda tangan");
    }
  };

  const handleDelete = async (sigId: Id<"letterSignatures">) => {
    try {
      await deleteSignature({ signatureId: sigId });
      toast.success("Tanda tangan dihapus");
    } catch {
      toast.error("Gagal menghapus tanda tangan");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Tanda Tangan Digital</h4>
          {signatures && signatures.length > 0 && (
            <Badge variant="secondary">{signatures.length}</Badge>
          )}
        </div>
        {!mySignature && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1">
            <PenLine className="h-3 w-3" />
            Tambah Tanda Tangan
          </Button>
        )}
      </div>

      {/* Signature list */}
      {signatures && signatures.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {signatures.map((sig) => (
            <div
              key={sig._id}
              className="border rounded-lg p-3 bg-muted/30 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{sig.user?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{sig.user?.jobTitle ?? ""}</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {ROLE_LABELS[sig.role ?? ""] ?? sig.role}
                  </Badge>
                </div>
                {mySignature?._id === sig._id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(sig._id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Signature image */}
              <div className="border rounded bg-white p-2 flex items-center justify-center h-20">
                <img
                  src={sig.signatureData}
                  alt="Tanda tangan"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(sig.signedAt), "d MMM yyyy HH:mm", { locale: localeId })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Belum ada tanda tangan digital</p>
      )}

      {/* Re-sign button if user already signed */}
      {mySignature && (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="gap-1 text-xs">
          <PenLine className="h-3 w-3" />
          Perbarui Tanda Tangan Saya
        </Button>
      )}

      {/* Signature Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tanda Tangan Digital</DialogTitle>
          </DialogHeader>
          <SignaturePad
            onSave={handleSave}
            onCancel={() => setOpen(false)}
            initialRole={mySignature?.role ?? "penandatangan"}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
