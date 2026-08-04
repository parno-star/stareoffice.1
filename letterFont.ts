// Font BERSAMA untuk semua dokumen surat (pratinjau layar, editor mode kertas,
// dan PDF). Kunci konsistensi lintas perangkat: dulu surat memakai "Times New
// Roman" yang HANYA ada di Windows/PC. Di Android font itu tidak terpasang,
// sehingga peramban menggantinya dengan Noto Serif — yang metrik (tinggi baris,
// lebar huruf) sedikit berbeda → pemenggalan baris & batas halaman ikut berbeda.
//
// Solusinya: paksa SEMUA perangkat memakai satu font yang SAMA dan SUDAH DIBUNDEL
// bersama aplikasi (Noto Serif, berkas di /public/fonts). Dengan begitu tampilan
// PC = Android = perangkat lain, persis sama.
//
// Nama keluarga khusus ("Noto Serif Letter") dipakai agar tidak bentrok dengan
// Noto Serif dari Google Fonts yang mungkin dimuat di tempat lain.
export const LETTER_FONT_FAMILY = "'Noto Serif Letter', 'Noto Serif', serif";

// Nama keluarga tunggal untuk dipakai saat memuat/menunggu font.
const LETTER_FONT_NAME = "Noto Serif Letter";

// Berkas font lokal (same-origin) + gaya/berat yang sesuai dengan @font-face di
// index.css. Diambil sekali lalu di-cache.
const FONT_FACES: Array<{
  url: string;
  weight: number;
  style: "normal" | "italic";
}> = [
  { url: "/fonts/noto-serif-400.woff2", weight: 400, style: "normal" },
  { url: "/fonts/noto-serif-700.woff2", weight: 700, style: "normal" },
  { url: "/fonts/noto-serif-400-italic.woff2", weight: 400, style: "italic" },
  { url: "/fonts/noto-serif-700-italic.woff2", weight: 700, style: "italic" },
];

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Gagal memuat font: ${url}`);
  const buf = await res.arrayBuffer();
  // Konversi ke base64 tanpa membebani stack pada berkas kecil (~15KB).
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return `data:font/woff2;base64,${base64}`;
}

let embedCssPromise: Promise<string> | null = null;

/**
 * Membuat CSS @font-face MANDIRI (self-contained) berisi font Noto Serif yang
 * di-encode base64. Diberikan ke html-to-image sebagai `fontEmbedCSS` sehingga
 * gambar hasil tangkapan (untuk pratinjau & PDF) menyematkan font ini secara
 * penuh — tidak bergantung pada font sistem perangkat. Hasilnya di-cache.
 */
export function getLetterFontEmbedCSS(): Promise<string> {
  if (!embedCssPromise) {
    embedCssPromise = (async () => {
      const faces = await Promise.all(
        FONT_FACES.map(async (f) => {
          const dataUrl = await fetchAsDataUrl(f.url);
          return `@font-face{font-family:'${LETTER_FONT_NAME}';font-style:${f.style};font-weight:${f.weight};font-display:swap;src:url(${dataUrl}) format('woff2');}`;
        }),
      );
      return faces.join("\n");
    })().catch((err) => {
      // Bila gagal, jangan cache kegagalan agar percobaan berikutnya bisa ulang.
      embedCssPromise = null;
      throw err;
    });
  }
  return embedCssPromise;
}

/**
 * Menunggu hingga font surat benar-benar siap dipakai di DOM (semua berat &
 * gaya). Dipanggil sebelum menghitung segmen halaman / menangkap gambar supaya
 * pengukuran memakai metrik font yang benar, bukan font sementara.
 */
export async function ensureLetterFontLoaded(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`400 12pt '${LETTER_FONT_NAME}'`),
      document.fonts.load(`700 12pt '${LETTER_FONT_NAME}'`),
      document.fonts.load(`italic 400 12pt '${LETTER_FONT_NAME}'`),
      document.fonts.load(`italic 700 12pt '${LETTER_FONT_NAME}'`),
    ]);
    await document.fonts.ready;
  } catch {
    // Abaikan kegagalan pemuatan — fallback serif tetap menghasilkan surat valid.
  }
}
