import { useState } from "react";
import { Download, FileText, ImageOff, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";

/**
 * Renders a "Lihat bukti transfer" link that opens the proof inside an in-app
 * dialog instead of a blank new tab. Uses the file's real content type (from
 * Convex storage metadata) to reliably decide between an image and a PDF, and
 * offers a download button that hands the file to the device's native app.
 */
export default function ProofViewer({
  url,
  contentType,
  title = "Bukti transfer",
}: {
  url: string;
  contentType?: string | null;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Prefer the real content type from storage metadata. Fall back to the URL
  // extension only when metadata is missing.
  const isPdf = contentType
    ? contentType.toLowerCase().includes("pdf")
    : /\.pdf($|\?)/i.test(url);

  // Download the file as a blob so the device opens it with its native app
  // (same behaviour as a PDF download button), rather than a blank browser tab.
  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await fetch(url);
      if (!response.ok) throw new Error("gagal");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const extension = isPdf
        ? "pdf"
        : (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `bukti-transfer.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Gagal mengunduh bukti. Silakan coba lagi.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setImgFailed(false);
          setOpen(true);
        }}
        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
      >
        <FileText className="size-3" />
        Lihat bukti transfer
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Bukti pembayaran yang diunggah oleh organisasi.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/30">
            {isPdf ? (
              <iframe src={url} title={title} className="h-[70vh] w-full" />
            ) : imgFailed ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <ImageOff className="size-8" />
                <p className="text-sm">Bukti tidak dapat ditampilkan di sini.</p>
                <p className="text-xs">
                  Gunakan tombol di bawah untuk mengunduhnya.
                </p>
              </div>
            ) : (
              <img
                src={url}
                alt={title}
                className="mx-auto max-h-[70vh] w-auto object-contain"
                onError={() => setImgFailed(true)}
              />
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setOpen(false)}
            >
              Tutup
            </Button>
            <Button
              className="cursor-pointer"
              onClick={() => {
                void handleDownload();
              }}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Unduh bukti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
