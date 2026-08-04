import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Download, Image as ImageIcon } from "lucide-react";
import CertificateView from "./CertificateView.tsx";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

export default function CertificateDialog({
  certificate,
  trigger,
}: {
  certificate: Doc<"courseCertificates">;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const waitForImages = async () => {
    const el = ref.current;
    if (!el) return;
    const imgs = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    );
  };

  const exportImage = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await waitForImages();
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `sertifikat-${certificate.serial}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Gambar diunduh");
    } catch {
      toast.error("Gagal mengekspor gambar");
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await waitForImages();
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "px" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, "PNG", 0, 0, pageW, pageH);
      pdf.save(`sertifikat-${certificate.serial}.pdf`);
      toast.success("PDF diunduh");
    } catch {
      toast.error("Gagal mengekspor PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sertifikat Penyelesaian</DialogTitle>
          <DialogDescription>
            Unduh sebagai gambar atau PDF untuk arsip pribadi.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto py-2">
          <div className="mx-auto min-w-[720px] max-w-4xl">
            <CertificateView certificate={certificate} ref={ref} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          <Button
            variant="secondary"
            onClick={exportImage}
            disabled={busy}
            className="cursor-pointer"
          >
            <ImageIcon className="size-4" /> Unduh PNG
          </Button>
          <Button
            onClick={exportPdf}
            disabled={busy}
            className="cursor-pointer"
          >
            <Download className="size-4" /> Unduh PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
