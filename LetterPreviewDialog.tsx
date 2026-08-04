import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { X, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { type LetterDocumentDetail } from "./LetterDocument.tsx";
import {
  A4_WIDTH_PX,
  renderLetterToImage,
  type RenderedLetterImage,
} from "../_lib/renderLetterImage.ts";
import PagedLetterView from "./PagedLetterView.tsx";

export type PreviewInput = {
  type: string;
  subject: string;
  letterNumber?: string;
  letterDate: string;
  place?: string;
  category: string;
  classification: string;
  signatureMethod?: string;
  fromName: string;
  fromJobTitle?: string;
  fromDepartment?: string;
  fromNip?: string;
  toName: string;
  toJobTitle?: string;
  toOrganization?: string;
  toAddress?: string;
  content: string;
  letterhead: (Doc<"letterheads"> & { logoUrl: string | null }) | null;
  authorSignature?: string | null;
  // Judul area kop untuk NOTA (memo). Kosong = default "NOTA".
  memoHeaderTitle?: string;
  // Logo opsional kop nota (per tenant).
  memoLogoUrl?: string | null;
  // Gaya garis atas & bawah kop nota (per tenant).
  memoLine?: LetterDocumentDetail["memoLine"];
};

// Membangun objek LetterDocumentDetail dari data form yang belum disimpan,
// sehingga pratinjau memakai tata letak resmi yang sama dengan hasil cetak/PDF.
export function buildPreviewDetail(input: PreviewInput): LetterDocumentDetail {
  const letter = {
    _id: "preview" as Id<"letters">,
    _creationTime: Date.now(),
    type: input.type,
    status: "draft",
    subject: input.subject,
    letterNumber: input.letterNumber || undefined,
    letterDate: input.letterDate,
    place: input.place || undefined,
    classification: input.classification,
    category: input.category,
    signatureMethod: input.signatureMethod,
    fromName: input.fromName,
    toName: input.toName,
    toJobTitle: input.toJobTitle || undefined,
    toOrganization: input.toOrganization || undefined,
    toAddress: input.toAddress || undefined,
    content: input.content,
    authorId: "preview" as Id<"users">,
  } satisfies Doc<"letters">;

  const fromUser =
    input.fromJobTitle || input.fromDepartment || input.fromNip
      ? {
          _id: "preview" as Id<"users">,
          name: input.fromName,
          jobTitle: input.fromJobTitle,
          department: input.fromDepartment,
          nip: input.fromNip,
        }
      : null;

  return {
    letter,
    author: null,
    pic: null,
    fromUser,
    attachments: [],
    letterhead: input.letterhead,
    approvals: [],
    authorSignature: input.authorSignature ?? null,
    memoHeaderTitle: input.memoHeaderTitle,
    memoLogoUrl: input.memoLogoUrl,
    memoLine: input.memoLine,
  };
}

interface LetterPreviewDialogProps {
  onClose: () => void;
  detail: LetterDocumentDetail;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

// Pratinjau surat langsung dari form (sebelum disimpan). Dokumen dirender menjadi
// satu gambar lalu dibagi menjadi lembar-lembar A4 terpisah (page view) yang
// identik dengan Preview Cetak dan hasil ekspor PDF.
export default function LetterPreviewDialog({ onClose, detail }: LetterPreviewDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rendered, setRendered] = useState<RenderedLetterImage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const autoFitRef = useRef(true);

  const pageCount = rendered?.pageCount ?? 1;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    renderLetterToImage(detail)
      .then((res) => {
        if (cancelled) return;
        setRendered(res);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Gagal menyiapkan pratinjau surat:", err);
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [detail]);

  const fitToWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const available = el.clientWidth - 32;
    const next = Math.min(1, Math.max(MIN_ZOOM, available / A4_WIDTH_PX));
    setZoom(next);
  }, []);

  useEffect(() => {
    fitToWidth();
    const handle = () => {
      if (autoFitRef.current) fitToWidth();
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [fitToWidth]);

  const zoomIn = () => {
    autoFitRef.current = false;
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.15) * 100) / 100));
  };
  const zoomOut = () => {
    autoFitRef.current = false;
    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - 0.15) * 100) / 100));
  };
  const resetFit = () => {
    autoFitRef.current = true;
    fitToWidth();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex flex-col gap-0 p-0 overflow-hidden max-w-none w-screen h-[100dvh] rounded-none sm:h-[95vh] sm:w-auto sm:max-w-3xl sm:rounded-lg">
        <DialogHeader className="shrink-0 border-b p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">
              Pratinjau Surat
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {status === "ready" ? `${pageCount} halaman` : "Menyiapkan…"}
              </span>
            </DialogTitle>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                <Button size="icon" variant="ghost" className="size-8 cursor-pointer" onClick={zoomOut} aria-label="Perkecil">
                  <ZoomOut className="size-4" />
                </Button>
                <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button size="icon" variant="ghost" className="size-8 cursor-pointer" onClick={zoomIn} aria-label="Perbesar">
                  <ZoomIn className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8 cursor-pointer" onClick={resetFit} aria-label="Sesuaikan lebar">
                  <Maximize className="size-4" />
                </Button>
              </div>
              <Button size="icon" variant="ghost" className="size-8 cursor-pointer" onClick={onClose} aria-label="Tutup">
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-muted/40 p-4"
        >
          {status === "loading" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <span className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <p className="text-sm">Menyiapkan pratinjau halaman…</p>
            </div>
          ) : status === "error" || !rendered ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <p className="text-sm font-medium">Gagal menyiapkan pratinjau</p>
              <p className="max-w-md text-xs">Silakan tutup dan coba buka kembali pratinjau.</p>
              {errorMsg && (
                <p className="max-w-md break-words rounded bg-muted px-2 py-1 text-[10px] font-mono text-muted-foreground/80">
                  {errorMsg}
                </p>
              )}
            </div>
          ) : (
            <PagedLetterView rendered={rendered} zoom={zoom} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
