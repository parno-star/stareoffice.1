// Utilitas paginasi bersama untuk surat. Dipakai oleh editor (mode kertas),
// Pratinjau, dan Preview Cetak agar SEMUANYA menghitung batas halaman dengan
// CARA YANG SAMA PERSIS — dan yang terpenting: pergantian halaman selalu jatuh
// DI ANTARA baris (tidak pernah memotong sebuah baris di tengah), persis seperti
// yang dilakukan browser saat mencetak.

// Ukuran A4 dalam piksel CSS pada 96dpi (210mm x 297mm).
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = Math.round((A4_WIDTH_PX * 297) / 210); // ≈ 1123

const MM_TO_PX = 96 / 25.4;
// Margin (ruang kosong) atas & bawah pada setiap lembar, seperti hasil cetak.
// - Margin atas: halaman pertama sudah punya ruang atas bawaan dari padding
//   dokumen resmi (20mm), jadi hanya halaman LANJUTAN yang perlu diberi ruang
//   atas kosong ini agar terlihat sama seperti halaman pertama.
// - Margin bawah: disisakan di SEMUA halaman supaya tidak ada baris yang menempel
//   di tepi bawah kertas (pada halaman terakhir, padding bawah dokumen resmi 30mm
//   sudah menangani ini).
export const PAGE_MARGIN_TOP_PX = Math.round(20 * MM_TO_PX); // ≈ 76 (20mm)
export const PAGE_MARGIN_BOTTOM_PX = Math.round(20 * MM_TO_PX); // ≈ 76 (20mm)

// Satu segmen halaman: rentang vertikal (px, relatif terhadap atas dokumen) yang
// ditampilkan pada satu lembar A4. `start` = batas atas isi halaman, `end` =
// batas bawah (di baris mana halaman dipotong). `topPad` = tinggi ruang kosong
// (px) yang harus digambar di ATAS potongan isi pada lembar ini (margin atas
// halaman lanjutan; 0 untuk halaman pertama).
export type PageSegment = { start: number; end: number; topPad: number };

// Sebuah "baris" tak-terpisahkan: kotak baris teks, gambar, atau baris tabel.
// Pergantian halaman tidak boleh jatuh di tengah salah satu dari ini.
type LineBox = { top: number; bottom: number };

/**
 * Kumpulkan posisi setiap baris teks, gambar, dan baris tabel dalam dokumen.
 * Kotak baris teks diambil lewat Range.getClientRects() sehingga kita tahu tinggi
 * & posisi TIAP baris hasil pembungkusan (word wrap), bukan sekadar per paragraf.
 * Elemen "atomik" (gambar, <tr>, <hr>) diperlakukan sebagai satu kesatuan agar
 * tidak terpotong.
 */
function collectLineBoxes(root: HTMLElement, docTop: number): LineBox[] {
  const boxes: LineBox[] = [];

  // Elemen yang tidak boleh dipotong: gambar, baris tabel, garis pemisah, dan
  // blok yang ditandai data-keep-together (mis. blok tanda tangan) — bila tidak
  // muat di sisa halaman, seluruhnya pindah ke halaman berikutnya.
  const atomics = Array.from(
    root.querySelectorAll<HTMLElement>("img, tr, hr, [data-keep-together]"),
  );
  const atomicSet = new Set<HTMLElement>(atomics);
  for (const el of atomics) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) boxes.push({ top: r.top - docTop, bottom: r.bottom - docTop });
  }

  // Baris KOSONG. <br> dan paragraf kosong tetap memakan tinggi vertikal, tapi
  // tidak menghasilkan kotak baris teks. Tanpa ini, spasi kosong (mis. beberapa
  // Enter berturut-turut) tak terdeteksi sehingga titik potong meleset dari yang
  // sebenarnya. Kita ukur kotaknya agar ruang kosong ikut diperhitungkan.
  const blanks = Array.from(
    root.querySelectorAll<HTMLElement>("br, p:empty, h1:empty, h2:empty, h3:empty, li:empty"),
  );
  for (const el of blanks) {
    // Lewati elemen di dalam elemen atomik (mis. <br> di dalam sel tabel).
    let p = el.parentElement;
    let skip = false;
    while (p && p !== root) {
      if (atomicSet.has(p)) { skip = true; break; }
      p = p.parentElement;
    }
    if (skip) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0) boxes.push({ top: r.top - docTop, bottom: r.bottom - docTop });
  }

  // Kotak baris teks. Lewati teks yang berada di dalam elemen atomik (mis. teks
  // di dalam sel tabel) karena sudah diwakili oleh kotak baris tabel (<tr>).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let p = node.parentElement;
      while (p && p !== root) {
        if (atomicSet.has(p)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const range = document.createRange();
  let node = walker.nextNode();
  while (node) {
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    for (const r of rects) {
      if (r.height > 0) boxes.push({ top: r.top - docTop, bottom: r.bottom - docTop });
    }
    node = walker.nextNode();
  }

  boxes.sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  return boxes;
}

/**
 * Cari titik potong halaman yang jatuh DI ANTARA baris.
 *
 * @param lines  daftar kotak baris (terurut menaik)
 * @param limit  batas bawah alami halaman saat ini (start + tinggi halaman)
 * @param start  batas atas isi halaman saat ini
 * @param total  tinggi total dokumen
 * @returns posisi potong (px). Bila seluruh sisa isi muat, kembalikan `total`.
 */
function snapBreak(
  lines: LineBox[],
  limit: number,
  start: number,
  total: number,
): number {
  let lastFitBottom = start;
  for (const line of lines) {
    // Abaikan baris yang seluruhnya berada di atas awal halaman ini.
    if (line.bottom <= start + 0.5) continue;
    if (line.bottom > limit) {
      // Baris ini tidak muat penuh pada halaman saat ini.
      if (line.top > start + 1) {
        // Potong TEPAT di bawah baris terakhir yang muat penuh. Ini menjamin
        // tidak ada bagian mana pun dari baris berikutnya (termasuk sisi atas
        // glyph) yang "mengintip" di tepi bawah halaman. Ruang antar-baris di
        // atas baris berikutnya dibiarkan kosong.
        return lastFitBottom > start ? lastFitBottom : line.top;
      }
      // Baris tunggal lebih tinggi dari satu halaman (mis. gambar besar).
      // Tidak ada pilihan selain menaruhnya utuh; potong setelahnya.
      return line.bottom;
    }
    // Baris ini muat penuh → catat batas bawahnya sebagai kandidat titik potong.
    lastFitBottom = line.bottom;
  }
  // Tidak ada baris yang melewati batas → sisa isi (termasuk padding bawah) muat
  // pada halaman ini.
  return total;
}

/**
 * Hitung segmen tiap halaman untuk dokumen yang dirender penuh (mengalir).
 * Tinggi halaman = `pageHeightPx` (satu A4). Pemutus halaman manual
 * (`[data-page-break]`/`.page-break`) memaksa ganti halaman lebih awal. Titik
 * potong SELALU jatuh di antara baris.
 */
export function computePageSegments(
  docEl: HTMLElement,
  pageHeightPx: number,
): PageSegment[] {
  const total = docEl.scrollHeight;
  if (total <= 0) return [{ start: 0, end: 0, topPad: 0 }];

  const docTop = docEl.getBoundingClientRect().top;
  const lines = collectLineBoxes(docEl, docTop);

  const manualBreaks = Array.from(
    docEl.querySelectorAll<HTMLElement>("[data-page-break], .page-break"),
  )
    .map((el) => el.getBoundingClientRect().top - docTop)
    .filter((top) => top > 1)
    .sort((a, b) => a - b);

  const segments: PageSegment[] = [];
  let start = 0;
  let bi = 0;
  const MAX_PAGES = 500;

  while (segments.length < MAX_PAGES) {
    if (start >= total - 1) break;

    // Ruang kosong di atas isi pada lembar ini: 0 untuk halaman pertama (padding
    // atas dokumen resmi sudah menyediakannya), dan margin atas untuk halaman
    // lanjutan agar terlihat sama seperti halaman pertama.
    const topPad = segments.length === 0 ? 0 : PAGE_MARGIN_TOP_PX;
    // Tinggi isi yang muat pada lembar ini = tinggi kertas − ruang atas − margin
    // bawah. Margin bawah menjaga baris terakhir tidak menempel di tepi kertas.
    const usable = Math.max(
      1,
      pageHeightPx - topPad - PAGE_MARGIN_BOTTOM_PX,
    );
    const naturalNext = start + usable;

    // Lewati pemutus manual yang sudah di atas/di posisi awal halaman ini.
    while (bi < manualBreaks.length && manualBreaks[bi] <= start + 1) bi++;

    let end: number;
    if (bi < manualBreaks.length && manualBreaks[bi] < naturalNext) {
      // Ada pemutus manual sebelum batas alami → paksa potong di sana.
      end = manualBreaks[bi];
      bi++;
    } else {
      end = snapBreak(lines, naturalNext, start, total);
    }

    // Pengaman anti-macet: pastikan selalu maju.
    if (end <= start + 1) end = Math.min(naturalNext, total);

    if (end >= total) {
      segments.push({ start, end: total, topPad });
      break;
    }

    segments.push({ start, end, topPad });
    start = end;
  }

  if (segments.length === 0) segments.push({ start: 0, end: total, topPad: 0 });
  return segments;
}

/**
 * Posisi (px, dari atas dokumen) awal tiap halaman. Halaman pertama = 0.
 * Disediakan untuk kompatibilitas dengan pemakai lama (mis. garis batas editor).
 */
export function computePageOffsets(docEl: HTMLElement, pageHeightPx: number): number[] {
  return computePageSegments(docEl, pageHeightPx).map((s) => s.start);
}

/**
 * Jumlah halaman untuk sebuah elemen dokumen yang dirender penuh.
 */
export function computePageCount(docEl: HTMLElement, pageHeightPx: number): number {
  return Math.max(1, computePageSegments(docEl, pageHeightPx).length);
}

/**
 * Hitung garis batas halaman untuk editor dengan MENGUNCI-nya ke hasil paginasi
 * DOKUMEN RESMI (yang dipakai Pratinjau/Cetak), lalu memetakannya ke koordinat
 * isi editor per-BLOK (paragraf/judul/daftar), bukan per-piksel dari atas.
 *
 * Kenapa per-blok? Karena isi editor dan isi dokumen resmi dibuat dari HTML yang
 * SAMA, urutan bloknya identik satu-per-satu. Dengan menetapkan garis relatif
 * terhadap blok yang bersangkutan, selisih kecil tinggi antar-blok (mis. spasi
 * judul/daftar) TIDAK menumpuk sepanjang dokumen. Jadi garis batas editor jatuh
 * di blok yang SAMA persis seperti pada Pratinjau.
 *
 * @param officialDocEl  elemen dokumen resmi tersembunyi (kop + isi + ttd)
 * @param editorRootEl   elemen isi editor yang diukur (measureRef)
 * @param pageHeightPx   tinggi satu halaman A4 (px)
 * @returns { offset, page } — offset (px, dari atas isi editor) & nomor halaman.
 */
export function computeEditorBreakLinesAnchored(
  officialDocEl: HTMLElement,
  editorRootEl: HTMLElement,
  pageHeightPx: number,
): { offset: number; page: number }[] | null {
  const segments = computePageSegments(officialDocEl, pageHeightPx);
  if (segments.length <= 1) return [];

  const officialBody = officialDocEl.querySelector<HTMLElement>("[data-letter-body]");
  if (!officialBody) return null;
  // Isi editor sebenarnya berada di dalam root ProseMirror (.tiptap).
  const editorBody =
    editorRootEl.querySelector<HTMLElement>(".tiptap") ?? editorRootEl;

  const officialDocTop = officialDocEl.getBoundingClientRect().top;
  const editorRootTop = editorRootEl.getBoundingClientRect().top;

  // Kumpulkan blok tingkat-atas di kedua sisi (urutannya identik).
  const officialBlocks = Array.from(officialBody.children).map((c) => {
    const r = c.getBoundingClientRect();
    return { top: r.top - officialDocTop, bottom: r.bottom - officialDocTop };
  });
  const editorBlocks = Array.from(editorBody.children).map((c) => {
    const r = c.getBoundingClientRect();
    return { top: r.top - editorRootTop, bottom: r.bottom - editorRootTop };
  });

  // Bila jumlah blok tak cocok (mis. ProseMirror menyisipkan paragraf kosong),
  // kembalikan null agar pemanggil memakai metode cadangan.
  if (
    officialBlocks.length === 0 ||
    officialBlocks.length !== editorBlocks.length
  ) {
    return null;
  }

  const result: { offset: number; page: number }[] = [];
  for (let i = 1; i < segments.length; i++) {
    const breakDoc = segments[i].start; // koordinat dokumen resmi
    const page = i + 1;

    // Cari blok pertama yang belum sepenuhnya berada di atas titik potong.
    let k = officialBlocks.findIndex((b) => b.bottom > breakDoc + 0.5);
    if (k < 0) {
      // Titik potong berada di bawah seluruh blok isi (mis. di area tanda
      // tangan). Editor hanya menampilkan isi surat, jadi tidak perlu garis.
      continue;
    }
    if (k >= editorBlocks.length) continue;

    let offset: number;
    if (breakDoc <= officialBlocks[k].top + 0.5) {
      // Potongan jatuh SEBELUM blok k (di ruang antar-blok) → garis di atas blok
      // k pada editor.
      offset = editorBlocks[k].top;
    } else {
      // Potongan jatuh DI DALAM blok k → interpolasi proporsional HANYA dalam
      // blok itu (galat kecil & tidak menumpuk ke blok lain).
      const oh = Math.max(1, officialBlocks[k].bottom - officialBlocks[k].top);
      const eh = editorBlocks[k].bottom - editorBlocks[k].top;
      const frac = (breakDoc - officialBlocks[k].top) / oh;
      offset = editorBlocks[k].top + frac * eh;
    }
    result.push({ offset, page });
  }

  return result;
}

/**
 * (CADANGAN) Hitung posisi garis batas halaman LANGSUNG pada elemen isi editor
 * sendiri. Dipakai bila penguncian per-blok ke dokumen resmi tidak tersedia
 * (mis. jumlah blok tak cocok). Mengukur baris nyata di area ketik memakai
 * anggaran tinggi halaman yang sama dengan dokumen resmi.
 *
 * @param bodyEl                elemen isi editor (yang diukur)
 * @param firstPageBodyBudget   tinggi isi yang muat di halaman 1 (px)
 * @param contBodyBudget        tinggi isi yang muat di tiap halaman lanjutan (px)
 * @returns daftar { offset, page } — offset (px, dari atas isi editor) tempat
 *          garis batas digambar; page = nomor halaman yang DIMULAI garis itu.
 */
export function computeEditorBreakLines(
  bodyEl: HTMLElement,
  firstPageBodyBudget: number,
  contBodyBudget: number,
): { offset: number; page: number }[] {
  const total = bodyEl.scrollHeight;
  if (total <= 0) return [];

  const docTop = bodyEl.getBoundingClientRect().top;
  const lines = collectLineBoxes(bodyEl, docTop);

  const manualBreaks = Array.from(
    bodyEl.querySelectorAll<HTMLElement>("[data-page-break], .page-break"),
  )
    .map((el) => el.getBoundingClientRect().top - docTop)
    .filter((top) => top > 1)
    .sort((a, b) => a - b);

  const result: { offset: number; page: number }[] = [];
  let start = 0;
  let bi = 0;
  let page = 1;
  const MAX_PAGES = 500;

  while (page < MAX_PAGES) {
    if (start >= total - 1) break;

    const budget = page === 1 ? firstPageBodyBudget : contBodyBudget;
    const naturalNext = start + Math.max(1, budget);

    while (bi < manualBreaks.length && manualBreaks[bi] <= start + 1) bi++;

    let end: number;
    if (bi < manualBreaks.length && manualBreaks[bi] < naturalNext) {
      end = manualBreaks[bi];
      bi++;
    } else {
      end = snapBreak(lines, naturalNext, start, total);
    }

    if (end <= start + 1) end = Math.min(naturalNext, total);
    if (end >= total) break; // sisa isi muat di halaman ini → tidak ada batas lagi

    // `end` adalah awal halaman berikutnya (page + 1) → gambar garis di sana.
    result.push({ offset: end, page: page + 1 });
    start = end;
    page += 1;
  }

  return result;
}
