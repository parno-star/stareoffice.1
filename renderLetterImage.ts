import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { toPng } from "html-to-image";
import LetterDocument, { type LetterDocumentDetail } from "../_components/LetterDocument.tsx";
import { computePageSegments, type PageSegment } from "./paginate.ts";
import { ensureLetterFontLoaded, getLetterFontEmbedCSS } from "./letterFont.ts";

// A4 dimensions in CSS pixels at 96dpi (210mm x 297mm).
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = Math.round((A4_WIDTH_PX * 297) / 210); // ≈ 1123

export type RenderedLetterImage = {
  dataUrl: string;
  // Natural pixel size of the captured image.
  width: number;
  height: number;
  // Height the image occupies when scaled to A4 page width (used to paginate).
  scaledHeight: number;
  // Tinggi dokumen (px) pada DOM asli tempat segmen halaman dihitung. Gambar
  // ditampilkan pada tinggi ini (bukan scaledHeight) agar koordinat potongan
  // halaman selaras PERSIS dengan gambar — tanpa drift yang membuat baris
  // berikutnya "mengintip" di tepi bawah halaman.
  docHeight: number;
  // Number of A4 pages the letter spans.
  pageCount: number;
  // Segmen tiap halaman (koordinat px pada gambar yang ditampilkan selebar A4).
  // Titik potong selalu jatuh DI ANTARA baris sehingga tidak ada baris terpotong.
  segments: PageSegment[];
};

// A canvas cannot exceed the browser's maximum dimension/area. We keep the
// captured image within safe bounds by lowering the pixel ratio for very long
// letters instead of failing outright.
const MAX_CANVAS_SIDE = 12000;

// Wait until React has committed the rendered document into the container and
// the element has a real height. createRoot renders asynchronously in React 19,
// so we poll a few frames instead of assuming it is ready after one frame.
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
    if (qrReady && imgs.length === 0) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

// Renders the official LetterDocument off-screen at full A4 width, captures it as
// a single PNG, and reports how many A4 pages it spans. This mirrors exactly how
// the PDF export slices the letter (by height), so the on-screen page preview is
// guaranteed to match the printed/exported output.
export async function renderLetterToImage(
  detail: LetterDocumentDetail,
): Promise<RenderedLetterImage> {
  const container = document.createElement("div");
  // Off-screen but still rendered at full A4 width so layout is correct.
  container.style.cssText =
    "position:fixed;top:0;left:-10000px;width:794px;background:#ffffff;z-index:-1;";
  document.body.appendChild(container);

  const root: Root = createRoot(container);
  try {
    root.render(createElement(LetterDocument, { detail, forCapture: true }));

    // Tunggu hingga React benar-benar memasang (commit) elemen dokumen. Di
    // React 19 render lewat createRoot bersifat asinkron, jadi satu frame saja
    // sering belum cukup — kita polling beberapa frame sampai elemen muncul.
    const target = await waitForTarget(container);
    if (!target) throw new Error("Gagal menyiapkan dokumen surat");

    await waitForImages(target);
    // Pastikan font surat (Noto Serif) benar-benar termuat SEBELUM menghitung
    // segmen halaman & menangkap gambar, agar pengukuran memakai metrik font
    // yang benar (bukan font sementara) — kunci konsistensi PC vs Android.
    await ensureLetterFontLoaded();

    // Hitung segmen halaman yang sadar-baris SEBELUM menangkap gambar, memakai
    // DOM asli yang masih hidup (getClientRects hanya bekerja pada DOM nyata).
    // Titik potong dijamin jatuh di antara baris → tidak ada baris terpotong.
    const segments = computePageSegments(target, A4_HEIGHT_PX);

    // Measure the rendered document. Very long letters produce a tall element;
    // at pixelRatio 2 the resulting canvas can exceed the browser's maximum
    // canvas size and make toPng fail (or return a blank image). Cap the pixel
    // ratio so the tallest side stays within a safe bound.
    const rect = target.getBoundingClientRect();
    const domHeight = Math.max(rect.height, target.scrollHeight, A4_HEIGHT_PX);
    const domWidth = Math.max(rect.width, A4_WIDTH_PX);
    const desiredRatio = 2;
    const maxRatioByHeight = MAX_CANVAS_SIDE / domHeight;
    const maxRatioByWidth = MAX_CANVAS_SIDE / domWidth;
    const pixelRatio = Math.max(
      1,
      Math.min(desiredRatio, maxRatioByHeight, maxRatioByWidth),
    );

    // Siapkan CSS @font-face mandiri (Noto Serif base64) untuk disematkan ke
    // gambar hasil tangkapan. Bila gagal diambil, jatuh ke skipFonts agar capture
    // tetap berjalan (fallback serif) — tak pernah membatalkan seluruh proses.
    let fontEmbedCSS: string | null = null;
    try {
      fontEmbedCSS = await getLetterFontEmbedCSS();
    } catch {
      fontEmbedCSS = null;
    }

    // Capture the letter as a single PNG. Some browsers intermittently taint
    // the canvas on the first pass when a cross-origin image (e.g. the CDN logo)
    // hasn't fully settled, so we retry once before giving up.
    const captureOptions = {
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
      // Explicit width/height keep the capture stable for off-screen elements.
      width: Math.ceil(domWidth),
      height: Math.ceil(domHeight),
      // Sematkan HANYA font surat (Noto Serif) yang sudah di-encode base64 agar
      // gambar identik di semua perangkat. Bila tidak tersedia, lewati embed font.
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    } as const;

    let dataUrl: string;
    try {
      dataUrl = await toPng(target, captureOptions);
    } catch {
      await new Promise((r) => setTimeout(r, 300));
      dataUrl = await toPng(target, captureOptions);
    }

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Gagal memproses gambar surat"));
      img.src = dataUrl;
    });

    // Height the image takes when its width is scaled to a full A4 page width.
    const scaledHeight = (img.height * A4_WIDTH_PX) / img.width;
    const pageCount = Math.max(1, segments.length);

    return {
      dataUrl,
      width: img.width,
      height: img.height,
      scaledHeight,
      // Tinggi dokumen asli (px) — sama dengan tinggi yang dipakai untuk
      // menghitung segmen halaman & menangkap gambar, sehingga tidak ada drift.
      docHeight: domHeight,
      pageCount,
      segments,
    };
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
