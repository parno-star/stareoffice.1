import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { X, ZoomIn, ZoomOut, Maximize, Download } from "lucide-react";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { renderLetterPdfBlob } from "./_components/letterPdf.ts";
import {
  A4_WIDTH_PX,
  renderLetterToImage,
  type RenderedLetterImage,
} from "./_lib/renderLetterImage.ts";
import PagedLetterView from "./_components/PagedLetterView.tsx";

type LetterDetail = {
  letter: Doc<"letters">;
  author: Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department"> | null;
  pic: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null;
  fromUser?: Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department" | "nip"> | null;
  attachments: Doc<"letterAttachments">[];
  letterhead: (Doc<"letterheads"> & { logoUrl: string | null }) | null;
  dispositions: Doc<"letterDispositions">[];
  approvals: (Doc<"letterApprovals"> & { approver: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null })[];
  history: Doc<"letterHistory">[];
  authorSignature: string | null;
  ccUsers?: Array<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department">>;
  // Judul area kop untuk NOTA (memo), diatur per tenant. Kosong = default "NOTA".
  memoHeaderTitle?: string;
  // Logo opsional kop nota (per tenant).
  memoLogoUrl?: string | null;
  // Gaya garis atas & bawah kop nota (per tenant).
  memoLine?: {
    topShow: boolean;
    topColor: string;
    topWidth: number;
    bottomShow: boolean;
    bottomColor: string;
    bottomWidth: number;
  };
};

interface LetterPrintViewProps {
  letter: LetterDetail;
  onClose: () => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

export default function LetterPrintView({ letter: detail, onClose }: LetterPrintViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  // Gambar hasil render dokumen (dipotong per halaman untuk ditampilkan).
  const [rendered, setRendered] = useState<RenderedLetterImage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const autoFitRef = useRef(true);

  const pageCount = rendered?.pageCount ?? 1;

  // PDF disiapkan di LATAR BELAKANG segera setelah pratinjau siap, lalu disimpan
  // ke object URL. Kenapa? Membuat PDF surat multi-halaman butuh waktu; bila baru
  // dibuat SAAT tombol ditekan, di Android izin "gestur pengguna" untuk mengunduh
  // sudah kadaluarsa saat berkas selesai → unduhan diblokir diam-diam (persis
  // gejala: "berhasil" muncul tapi file tidak ada). Dengan menyiapkan lebih dulu,
  // penekanan tombol langsung mengunduh dalam jendela gestur yang valid.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);

  // Render dokumen resmi menjadi satu gambar, lalu bagi tingginya menjadi
  // halaman-halaman A4. Cara ini identik dengan pembuatan PDF, jadi jumlah &
  // batas halaman DIJAMIN sama dengan hasil ekspor/cetak. Jauh lebih andal
  // dibanding mengukur elemen DOM tersembunyi (yang bisa keliru terbaca 1 halaman).
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

  // Bangun PDF di latar belakang setelah pratinjau siap. Simpan blob + object URL
  // agar penekanan tombol "Simpan PDF" bisa langsung mengunduh tanpa menunggu.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setPdfBuilding(true);
    renderLetterPdfBlob(detail)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setPdfUrl(createdUrl);
      })
      .catch((err) => {
        console.error("Gagal menyiapkan PDF surat:", err);
      })
      .finally(() => {
        if (!cancelled) setPdfBuilding(false);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [status, detail]);

  // Fit the document to the available preview width (used on first render and resize).
  const fitToWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const available = el.clientWidth - 32; // padding allowance
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

  // Pinch-to-zoom support on touch devices.
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const getDist = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: getDist(e.touches), startZoom: zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      autoFitRef.current = false;
      const ratio = getDist(e.touches) / pinchRef.current.startDist;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.startZoom * ratio));
      setZoom(Math.round(next * 100) / 100);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  // Simpan PDF asli memakai mesin PDF aplikasi (jsPDF). Jauh lebih bersih dan
  // konsisten dibanding "Cetak" browser di HP. PDF sudah disiapkan di latar
  // belakang (lihat useEffect di atas), jadi penekanan tombol langsung mengunduh
  // dalam jendela gestur pengguna yang valid — kunci agar Android tidak memblokir
  // unduhan diam-diam pada surat multi-halaman yang lama dibuat.
  const safeName =
    (detail.letter.letterNumber || detail.letter.subject || "surat")
      .replace(/[^\w-]+/g, "_")
      .slice(0, 80) || "surat";
  const filename = `${safeName}.pdf`;

  const handleDownloadPdf = () => {
    if (!pdfUrl) {
      toast.info("PDF sedang disiapkan, mohon tunggu sebentar…");
      return;
    }
    // Unduh langsung memakai object URL yang sudah jadi. Sinkron & dalam gestur
    // → Android/desktop menyimpannya ke folder Unduhan dengan andal.
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("PDF surat berhasil diunduh");
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent
        className="flex flex-col gap-0 p-0 overflow-hidden max-w-none w-screen h-[100dvh] rounded-none sm:h-[95vh] sm:w-auto sm:max-w-3xl sm:rounded-lg"
      >
        <DialogHeader className="shrink-0 border-b p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">
              Preview Cetak
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {status === "ready" ? `${pageCount} halaman` : "Menyiapkan…"}
              </span>
            </DialogTitle>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Kontrol zoom */}
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
              <Button size="sm" className="cursor-pointer" onClick={handleDownloadPdf} disabled={pdfBuilding || status !== "ready"}>
                <Download className="size-4" /> <span className="hidden sm:inline">{pdfBuilding ? "Menyiapkan…" : "Simpan PDF"}</span>
              </Button>
              <Button size="icon" variant="ghost" className="size-8 cursor-pointer" onClick={onClose} aria-label="Tutup">
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Page view. Dokumen dirender menjadi satu gambar lalu dibagi menjadi
            lembar-lembar A4 terpisah yang ditumpuk vertikal (seperti Word/PDF).
            Cara ini identik dengan pembuatan PDF sehingga jumlah & batas halaman
            selalu sama persis dengan hasil ekspor/cetak. */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto bg-muted/40 p-4"
          style={{ touchAction: "pan-x pan-y" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
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

        {/* Bilah aksi bawah – tombol Simpan PDF & Batal langsung di pratinjau
            agar mudah dijangkau. "Simpan PDF" mengunduh berkas PDF asli yang
            rapi & lengkap dengan kop surat. */}
        {status === "ready" && (
          <div className="shrink-0 flex items-center justify-end gap-2 border-t bg-background p-3">
            <Button variant="ghost" className="cursor-pointer" onClick={onClose}>
              <X className="size-4" /> Batal
            </Button>
            <Button className="cursor-pointer" onClick={handleDownloadPdf} disabled={pdfBuilding}>
              <Download className="size-4" /> {pdfBuilding ? "Menyiapkan PDF…" : "Simpan PDF"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
