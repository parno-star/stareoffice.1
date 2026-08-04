import { createRoot, type Root } from "react-dom/client";
import { createElement, type ReactElement } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import LetterDocument, { type LetterDocumentDetail } from "./LetterDocument.tsx";
import IncomingLetterDocument from "./IncomingLetterDocument.tsx";
import {
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  computePageSegments,
  type PageSegment,
} from "../_lib/paginate.ts";
import { ensureLetterFontLoaded, getLetterFontEmbedCSS } from "../_lib/letterFont.ts";

// Sebuah kanvas tidak boleh melebihi ukuran/area maksimum peramban. Untuk surat
// yang sangat panjang (3+ halaman) kita turunkan pixelRatio agar sisi terpanjang
// tetap dalam batas aman, alih-alih gagal total (toPng mengembalikan gambar
// kosong / melempar error).
const MAX_CANVAS_SIDE = 12000;

// Tunggu hingga React benar-benar memasang (commit) elemen dokumen. Di React 19
// render lewat createRoot bersifat asinkron, jadi satu frame saja sering belum
// cukup — kita polling beberapa frame sampai elemen punya tinggi nyata.
async function waitForTarget(
  container: HTMLElement,
  timeoutMs = 4000,
): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = container.firstElementChild as HTMLElement | null;
    if (el && (el.scrollHeight > 0 || el.getBoundingClientRect().height > 0)) {
      return el;
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  return container.firstElementChild as HTMLElement | null;
}

// Wait until every <img> inside the node has finished loading (or errored),
// so the captured snapshot includes the logo, signature, and QR code.
async function waitForImages(node: HTMLElement, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  // Give async-rendered images (e.g. the QR code, generated in an effect) a
  // moment to mount before we start checking.
  await new Promise((r) => setTimeout(r, 400));

  while (Date.now() - start < timeoutMs) {
    // The QR code renders asynchronously; its wrapper flips data-qr-ready to
    // "true" only once the QR <img> exists. Wait for every QR to be ready so
    // the snapshot never captures an empty placeholder box.
    const qrWrappers = Array.from(node.querySelectorAll("[data-letter-qr]"));
    const qrReady = qrWrappers.every((el) => el.getAttribute("data-qr-ready") === "true");

    const imgs = Array.from(node.querySelectorAll("img"));
    const allLoaded = imgs.every((img) => img.complete && img.naturalWidth > 0);
    if (qrReady && imgs.length > 0 && allLoaded) return;
    // No images at all also means we are ready.
    if (qrReady && imgs.length === 0) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

// Renders a document element off-screen, captures it as a PNG, and assembles it
// into a paginated A4 PDF. Returns the PDF as a Blob.
//
// IMPORTANT: pagination uses the SAME line-aware page segments as the on-screen
// preview (computePageSegments). Slicing the tall capture by a raw A4 height
// caused a mismatch — a few overflow pixels produced an extra near-blank page in
// the PDF that the preview (which snaps breaks between lines) never showed.
async function renderElementToPdfBlob(element: ReactElement): Promise<Blob> {
  const container = document.createElement("div");
  // Position far off-screen but still rendered at full A4 width so layout is
  // correct. 794px ≈ 210mm at 96dpi.
  container.style.cssText =
    "position:fixed;top:0;left:-10000px;width:794px;background:#ffffff;z-index:-1;";
  document.body.appendChild(container);

  const root: Root = createRoot(container);
  try {
    root.render(element);

    // Tunggu hingga React benar-benar memasang elemen dokumen (React 19 async).
    const target = await waitForTarget(container);
    if (!target) throw new Error("Gagal menyiapkan dokumen surat");

    await waitForImages(target);
    // Pastikan font surat (Noto Serif) benar-benar termuat sebelum paginasi &
    // capture agar hasil PDF identik dengan pratinjau di semua perangkat.
    await ensureLetterFontLoaded();

    // Compute line-aware page segments on the live DOM (identical to preview).
    const segments: PageSegment[] = computePageSegments(target, A4_HEIGHT_PX);

    // Batasi pixelRatio agar kanvas surat panjang tidak melampaui ukuran maksimum
    // peramban (yang membuat toPng gagal / mengembalikan gambar kosong).
    const rect = target.getBoundingClientRect();
    const domHeight = Math.max(rect.height, target.scrollHeight, A4_HEIGHT_PX);
    const domWidth = Math.max(rect.width, A4_WIDTH_PX);
    const desiredRatio = 2;
    const pixelRatio = Math.max(
      1,
      Math.min(desiredRatio, MAX_CANVAS_SIDE / domHeight, MAX_CANVAS_SIDE / domWidth),
    );

    // Siapkan CSS @font-face mandiri (Noto Serif base64). Bila gagal, null →
    // capture memakai skipFonts (fallback serif) tanpa membatalkan proses.
    let fontEmbedCSS: string | null = null;
    try {
      fontEmbedCSS = await getLetterFontEmbedCSS();
    } catch {
      fontEmbedCSS = null;
    }

    const captureOptions = {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
      width: Math.ceil(domWidth),
      height: Math.ceil(domHeight),
      // Sematkan font surat (Noto Serif) base64 agar PDF identik lintas perangkat.
      // Bila gagal diambil, lewati embed font (fallback serif) tanpa membatalkan.
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    } as const;

    // Beberapa peramban sesekali menodai (taint) kanvas pada percobaan pertama
    // saat gambar lintas-asal (logo CDN) belum benar-benar mapan → coba sekali lagi.
    let dataUrl: string;
    try {
      dataUrl = await toPng(target, captureOptions);
    } catch {
      await new Promise((r) => setTimeout(r, 300));
      dataUrl = await toPng(target, captureOptions);
    }

    // Build a multi-page A4 PDF from the captured image.
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Gagal memproses gambar surat"));
      img.src = dataUrl;
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Scale between the captured image's natural pixels and CSS px / mm. Both the
    // segments and the capture use the same 794px A4-width coordinate space.
    const pxPerCss = img.width / A4_WIDTH_PX; // image px per CSS px (≈ pixelRatio)
    const mmPerCssPx = pageWidth / A4_WIDTH_PX;

    // Draw one A4 page per segment. IMPORTANT: instead of embedding the full tall
    // image on every page (which balloons file size and fails to render/share on
    // phones for 3+ page letters), we crop each segment into its OWN small image
    // and place only that slice. This keeps the PDF small and reliable.
    segments.forEach((seg, i) => {
      if (i > 0) pdf.addPage();
      const segCssHeight = Math.min(seg.end - seg.start, A4_HEIGHT_PX - seg.topPad);
      if (segCssHeight <= 0) return;

      // Source rectangle (in image pixels) for this page's slice.
      const srcY = Math.max(0, Math.round(seg.start * pxPerCss));
      const srcH = Math.min(
        img.height - srcY,
        Math.round(segCssHeight * pxPerCss),
      );
      if (srcH <= 0) return;

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = srcH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Gagal memproses halaman surat");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, img.width, srcH);
      const sliceUrl = canvas.toDataURL("image/png");

      // Place the slice below the page's top margin (topPad), at page width.
      const yMm = seg.topPad * mmPerCssPx;
      const sliceHmm = (srcH / pxPerCss) * mmPerCssPx;
      pdf.addImage(sliceUrl, "PNG", 0, yMm, pageWidth, sliceHmm);
    });

    // Nomor halaman otomatis — hanya bila dokumen lebih dari satu halaman.
    const totalPages = pdf.getNumberOfPages();
    if (totalPages > 1) {
      pdf.setFont("times", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.text(
          `Halaman ${p} dari ${totalPages}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: "center" },
        );
      }
      pdf.setTextColor(0, 0, 0);
    }

    return pdf.output("blob");
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}


// PDF archive for outgoing / internal letters and memos (formal letter body).
export async function renderLetterPdfBlob(detail: LetterDocumentDetail): Promise<Blob> {
  return renderElementToPdfBlob(createElement(LetterDocument, { detail, forCapture: true }));
}

// PDF archive for incoming letters (registration / record sheet).
export async function renderIncomingLetterPdfBlob(detail: LetterDocumentDetail): Promise<Blob> {
  return renderElementToPdfBlob(createElement(IncomingLetterDocument, { detail }));
}
