import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import QRCode from "qrcode";
import type { LetterDocumentDetail } from "../_components/LetterDocument.tsx";
import { formatJobTitle, formatJobTitleSentence } from "./formatJobTitle.ts";

// Mengekspor surat menjadi berkas Word (.docx) asli yang dapat dibuka & diedit
// langsung di Microsoft Word / LibreOffice / WPS. Isi surat (HTML) dikonversi
// menjadi Office Open XML (.docx) memakai pustaka @turbodocx/html-to-docx yang
// berjalan sepenuhnya di peramban. Format dasar (tebal, miring, tabel, daftar,
// perataan) dipertahankan. Tata letak tidak akan sepersis PDF resmi (kop, QR,
// tanda tangan bisa sedikit bergeser) karena Word menata ulang isi — cocok untuk
// konsep yang masih akan disunting, bukan dokumen final.

// Escape teks biasa agar aman dimasukkan ke HTML.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Baris metadata "Label : Nilai" dengan lebar label tetap agar titik dua rata.
function metaRow(label: string, value: string): string {
  return `<p style="margin:0"><span style="display:inline-block;width:90pt;font-weight:bold">${escapeHtml(
    label,
  )}</span>: ${escapeHtml(value)}</p>`;
}

// Membangun potongan HTML isi surat yang akan dikonversi ke .docx.
export function buildLetterWordHtml(detail: LetterDocumentDetail, qrDataUri?: string | null): string {
  const { letter, letterhead, attachments } = detail;
  const accentColor = letterhead?.accentColor ?? "#1d4ed8";

  const signerName = letter.fromName ?? detail.fromUser?.name ?? "";
  const signerJobTitle = detail.fromUser?.jobTitle ?? "";
  const signerDepartment = detail.fromUser?.department ?? "";
  const signerNip = detail.fromUser?.nip ?? "";

  const dateStr = [
    letter.place,
    format(new Date(letter.letterDate), "d MMMM yyyy", { locale: localeId }),
  ]
    .filter(Boolean)
    .join(", ");

  // KOP SURAT
  // Catatan: logo TIDAK disertakan sebagai gambar. Menyisipkan gambar di dalam
  // sel tabel membuat pustaka konverter (build peramban) menghasilkan XML yang
  // ditolak Microsoft Word ("isi tidak dapat dibaca"). Sesuai permintaan, kop
  // surat dibuat teks saja (nama organisasi, alamat, kontak) tanpa logo.
  const contactLine = [
    letterhead?.organizationPhone ? `Telp: ${letterhead.organizationPhone}` : null,
    letterhead?.organizationEmail ? `Email: ${letterhead.organizationEmail}` : null,
    letterhead?.organizationWebsite ? `Website: ${letterhead.organizationWebsite}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  // Gaya garis kop nota (per tenant) untuk ekspor Word. Lebar dikonversi px→pt.
  const ml = detail.memoLine ?? {
    topShow: true,
    topColor: "#1f2937",
    topWidth: 4,
    bottomShow: true,
    bottomColor: "#1f2937",
    bottomWidth: 2,
  };
  const pxToPt = (px: number) => Math.max(0.5, Math.round(px * 0.75 * 10) / 10);
  const memoTopBorder = ml.topShow
    ? `border-top:${pxToPt(ml.topWidth)}pt solid ${ml.topColor};`
    : "";
  const memoBottomBorder = ml.bottomShow
    ? `border-bottom:${pxToPt(ml.bottomWidth)}pt solid ${ml.bottomColor};`
    : "";

  const header =
    letter.type === "memo"
      ? `<div style="${memoTopBorder}${memoBottomBorder}padding:6pt 0;margin-bottom:12pt">
         <p style="margin:0;text-align:center;font-size:15pt;font-weight:bold">${escapeHtml(
           (detail.memoHeaderTitle ?? "").trim() || "NOTA",
         )}</p>
       </div>`
      : letterhead
    ? `
      <div style="text-align:center;margin-bottom:4pt">
        <p style="margin:0;font-size:16pt;font-weight:bold;color:${accentColor}">${escapeHtml(
          letterhead.organizationName,
        )}</p>
        ${
          letterhead.organizationAddress
            ? `<p style="margin:0;font-size:10pt">${escapeHtml(letterhead.organizationAddress)}</p>`
            : ""
        }
        ${contactLine ? `<p style="margin:0;font-size:9pt">${escapeHtml(contactLine)}</p>` : ""}
      </div>
      <div style="border-bottom:2pt solid ${accentColor};margin-bottom:12pt"></div>`
    : `<div style="border-top:3pt solid #333;border-bottom:1pt solid #333;padding:6pt 0;margin-bottom:12pt">
         <p style="margin:0;text-align:center;font-size:15pt;font-weight:bold">SURAT RESMI</p>
       </div>`;

  // Metadata surat
  const metaRows: string[] = [];
  if (letter.letterNumber) metaRows.push(metaRow("Nomor", letter.letterNumber));
  if (letter.classification !== "biasa")
    metaRows.push(metaRow("Sifat", letter.classification.replace("_", " ").toUpperCase()));
  if (attachments.length > 0) metaRows.push(metaRow("Lampiran", `${attachments.length} berkas`));
  metaRows.push(metaRow("Perihal", letter.subject));

  // Blok nomor + tanggal pada satu baris: metadata (Nomor, Perihal, dst.) di
  // kolom kiri, tanggal rata tepi kanan di kolom kanan (sejajar baris Nomor).
  const metaWithDate = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12pt">
      <tr>
        <td style="vertical-align:top">${metaRows.join("")}</td>
        <td style="vertical-align:top;text-align:right;white-space:nowrap;width:35%">${escapeHtml(dateStr)}</td>
      </tr>
    </table>`;

  // Tujuan (tanpa tanggal — tanggal sudah dipindah sejajar dengan Nomor).
  const recipient = `
    <div style="margin:0 0 12pt 0">
      <p style="margin:0">Kepada Yth.</p>
      <p style="margin:0;font-weight:bold">${escapeHtml(letter.toName ?? "")}</p>
      ${letter.toJobTitle ? `<p style="margin:0">${escapeHtml(formatJobTitleSentence(letter.toJobTitle))}</p>` : ""}
      ${letter.toOrganization ? `<p style="margin:0">${escapeHtml(letter.toOrganization)}</p>` : ""}
      ${letter.toAddress ? `<p style="margin:0">${escapeHtml(letter.toAddress)}</p>` : ""}
    </div>`;

  // Isi surat (HTML dari editor, dibiarkan apa adanya agar format tetap).
  const body = `<div style="text-align:justify;line-height:1.6">${letter.content}</div>`;

  // Tanda tangan
  const signature = `
    <table style="width:100%;border-collapse:collapse;margin-top:24pt">
      <tr>
        <td style="width:60%"></td>
        <td style="text-align:center">
          <p style="margin:0">Hormat kami,</p>
          ${signerJobTitle ? `<p style="margin:0">${escapeHtml(formatJobTitle(signerJobTitle))}</p>` : ""}
          ${signerDepartment ? `<p style="margin:0">${escapeHtml(signerDepartment)}</p>` : ""}
          <br /><br /><br />
          <p style="margin:0;font-weight:bold;text-decoration:underline">${escapeHtml(
            signerName || "_________________",
          )}</p>
          ${signerNip ? `<p style="margin:0">NIP. ${escapeHtml(signerNip)}</p>` : ""}
        </td>
      </tr>
    </table>`;

  const attachmentList =
    attachments.length > 0
      ? `<div style="margin-top:18pt;font-size:10pt">
           <p style="margin:0;font-weight:bold">Lampiran:</p>
           ${attachments.map((a, i) => `<p style="margin:0">${i + 1}. ${escapeHtml(a.fileName)}</p>`).join("")}
         </div>`
      : "";

  // Daftar tembusan (CC) – kiri bawah, gabungan internal + eksternal.
  const ccInternal = detail.ccUsers ?? [];
  const ccExternal = letter.ccExternal ?? [];
  const ccItems = [
    ...ccInternal.map((u) =>
      [u.name, u.jobTitle ? formatJobTitle(u.jobTitle) : null].filter(Boolean).join(" - "),
    ),
    ...ccExternal,
  ];
  const ccList =
    ccItems.length > 0
      ? `<div style="margin-top:18pt;font-size:10pt">
           <p style="margin:0;font-weight:bold">Tembusan:</p>
           ${ccItems.map((label, i) => `<p style="margin:0">${i + 1}. ${escapeHtml(label)}</p>`).join("")}
         </div>`
      : "";

  // Blok QR verifikasi keaslian (kecil, rata kiri). Ditempatkan sebagai gambar
  // paragraf mandiri (BUKAN di dalam sel tabel) karena gambar dalam sel tabel
  // membuat konverter (build peramban) menghasilkan XML yang ditolak Word.
  const qrBlock =
    qrDataUri && letter.verificationCode
      ? `<div style="margin-top:12pt;text-align:right">
           <img src="${qrDataUri}" width="92" height="92" alt="QR verifikasi" />
           <p style="margin:0;font-size:8pt;color:#555">Pindai untuk verifikasi keaslian</p>
           ${letter.letterNumber ? `<p style="margin:0;font-size:8pt;color:#555">No: ${escapeHtml(letter.letterNumber)}</p>` : ""}
           <p style="margin:0;font-size:8pt;color:#555">${escapeHtml(letter.verificationCode)}</p>
         </div>`
      : "";

  // Dokumen HTML lengkap sebagai masukan untuk konverter .docx.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(letter.subject)}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; }
    p { margin: 0; }
    table { font-size: 12pt; }
    ul { list-style-type: disc; padding-left: 24pt; }
    ol { list-style-type: decimal; padding-left: 24pt; }
    li { margin: 2pt 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${header}
  ${metaWithDate}
  ${recipient}
  ${body}
  ${signature}
  ${qrBlock}
  ${ccList}
  ${attachmentList}
</body>
</html>`;
}

// Mengambil satu gambar dan mengubahnya menjadi data URI (base64) agar bisa
// ditanam langsung ke dokumen tanpa perlu unduhan jaringan saat konversi.
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Mengganti semua src gambar http(s) di HTML menjadi data URI. Gambar yang gagal
// dimuat (mis. terblokir CORS) dihapus agar tidak menggagalkan proses ekspor.
async function inlineImages(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs = Array.from(doc.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:")) return;
      const dataUri = await toDataUri(src);
      if (dataUri) {
        img.setAttribute("src", dataUri);
      } else {
        img.remove();
      }
    }),
  );
  return doc.body.innerHTML;
}

// Memperbaiki cacat XML yang dihasilkan pustaka konverter (versi 1.22.0) yang
// membuat Microsoft Word menolak berkas dengan pesan "isi tidak dapat dibaca":
//
//   1) Elemen <w:sectPr> (properti bagian/section) diletakkan sebagai anak
//      PERTAMA dari <w:body>. Skema OOXML mengharuskan sectPr tingkat-body
//      menjadi anak TERAKHIR. Kita pindahkan ke akhir.
//   2) Elemen <w:br> kadang muncul langsung di dalam <w:p> tanpa dibungkus
//      <w:r> (run). Ini terjadi bila sebuah <br> menjadi anak pertama dari
//      <strong>/<em>. Setiap <w:br> telanjang kita bungkus ke dalam run.
//
// Perbaikan dilakukan langsung pada string XML document.xml (bukan lewat DOM),
// karena membuat elemen ber-namespace seperti createElement("w:r") di DOM XML
// peramban tidak dapat diandalkan lintas-peramban dan bisa merusak prefiks.
function repairDocumentXml(xml: string): string {
  // 1) Pindahkan <w:sectPr> tingkat-body dari anak pertama ke anak terakhir.
  const bodyOpen = xml.indexOf("<w:body>");
  const bodyClose = xml.indexOf("</w:body>");
  if (bodyOpen >= 0 && bodyClose >= 0) {
    const start = bodyOpen + "<w:body>".length;
    let inner = xml.slice(start, bodyClose);
    const match = inner.match(/^\s*(<w:sectPr>[\s\S]*?<\/w:sectPr>)/);
    if (match) {
      const sectPr = match[1];
      inner = inner.slice(match[0].length) + "\n" + sectPr + "\n";
      xml = xml.slice(0, start) + inner + xml.slice(bodyClose);
    }
  }

  // 2) Bungkus setiap <w:br .../> yang menjadi anak langsung <w:p> (yaitu tepat
  //    setelah </w:r>, </w:pPr>, atau <w:p>) ke dalam sebuah run <w:r>.
  //    Ulangi hingga stabil untuk menangkap beberapa <w:br> berurutan.
  let prev = "";
  while (xml !== prev) {
    prev = xml;
    xml = xml.replace(
      /(<\/w:r>|<\/w:pPr>|<w:p>)(\s*)(<w:br\b[^>]*\/>)/g,
      (_full, before: string, ws: string, br: string) =>
        `${before}${ws}<w:r><w:rPr/>${br}</w:r>`,
    );
  }

  return xml;
}

// Memicu unduhan berkas Word (.docx) asli dari data surat.
export async function exportLetterToWord(detail: LetterDocumentDetail): Promise<void> {
  // Buat QR verifikasi (bila surat punya kode) sebagai data URI agar bisa
  // ditanam langsung ke dokumen Word tanpa unduhan jaringan.
  let qrDataUri: string | null = null;
  const code = detail.letter.verificationCode;
  if (code) {
    try {
      const verifyUrl = `${window.location.origin}/verifikasi-surat/${encodeURIComponent(code)}`;
      qrDataUri = await QRCode.toDataURL(verifyUrl, {
        width: 128,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
    } catch {
      qrDataUri = null;
    }
  }

  const rawHtml = buildLetterWordHtml(detail, qrDataUri);

  // Tanam gambar sebagai data URI lebih dulu supaya konverter tidak perlu
  // mengunduh dari jaringan (sumber utama kegagalan ekspor).
  const bodyHtml = await inlineImages(rawHtml);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${bodyHtml}</body></html>`;

  // Pustaka konverter (build peramban) memakai identifier `global` telanjang
  // saat menentukan keluaran Buffer vs Blob:
  //   Object.prototype.hasOwnProperty.call(global, "Buffer")
  // Di peramban `global` tidak ada sehingga memicu ReferenceError dan ekspor
  // gagal diam-diam. Kita sediakan `global` yang menunjuk ke globalThis agar
  // referensi itu bisa diselesaikan (dan library memilih jalur Blob).
  const g = globalThis as unknown as { global?: unknown };
  if (typeof g.global === "undefined") {
    g.global = globalThis;
  }

  // Impor dinamis agar pustaka konversi tidak masuk ke bundel utama.
  const mod = await import("@turbodocx/html-to-docx");
  const htmlToDocx = (mod.default ?? mod) as typeof import("@turbodocx/html-to-docx");

  // Konfigurasi dokumen: kertas A4 (twips: 1 cm ≈ 567 twip) & Times New Roman.
  const result = await htmlToDocx(html, null, {
    orientation: "portrait",
    pageSize: { width: 11906, height: 16838 }, // A4 dalam twip
    margins: { top: 1134, right: 1418, bottom: 1701, left: 1418 },
    title: detail.letter.subject,
    font: "Times New Roman",
    fontSize: 24, // half-points → 12pt
    table: { row: { cantSplit: true } },
  });

  // Konverter mengembalikan Blob di peramban; jaga-jaga bila ArrayBuffer.
  const rawBlob =
    result instanceof Blob
      ? result
      : new Blob([result as ArrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

  // Buka ulang .docx, perbaiki document.xml (sectPr & <w:br> telanjang), lalu
  // kemas kembali agar dapat dibuka Microsoft Word tanpa peringatan.
  const blob = await repairDocxBlob(rawBlob);

  const url = URL.createObjectURL(blob);

  // Nama berkas: gunakan nomor surat bila ada, jika tidak pakai perihal.
  const rawName = detail.letter.letterNumber ?? detail.letter.subject ?? "surat";
  const safeName = rawName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "surat";

  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// Membuka .docx (arsip zip), memperbaiki word/document.xml, dan mengemasnya
// kembali menjadi Blob .docx yang valid.
async function repairDocxBlob(blob: Blob): Promise<Blob> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const docFile = zip.file("word/document.xml");
    if (!docFile) return blob;

    const xml = await docFile.async("string");
    const fixed = repairDocumentXml(xml);
    zip.file("word/document.xml", fixed);

    return await zip.generateAsync({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  } catch {
    // Bila perbaikan gagal karena alasan tak terduga, kembalikan berkas asli
    // agar pengguna tetap mendapat sesuatu (walau mungkin perlu "pulihkan").
    return blob;
  }
}
