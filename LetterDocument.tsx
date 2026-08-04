import { forwardRef } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import LetterQRCode from "./LetterQRCode.tsx";
import { formatJobTitle, formatJobTitleSentence } from "../_lib/formatJobTitle.ts";
import { normalizeBodyHtmlForDisplay } from "../_lib/normalizeBodyHtml.ts";

export type LetterDocumentDetail = {
  letter: Doc<"letters">;
  author: Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department"> | null;
  pic: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null;
  fromUser?: Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department" | "nip"> | null;
  attachments: Doc<"letterAttachments">[];
  letterhead: (Doc<"letterheads"> & { logoUrl: string | null }) | null;
  approvals: (Doc<"letterApprovals"> & {
    approver: Pick<Doc<"users">, "_id" | "name" | "jobTitle"> | null;
  })[];
  authorSignature: string | null;
  // Tembusan internal (dari direktori karyawan). Opsional agar pratinjau editor
  // yang tak menyertakannya tetap valid.
  ccUsers?: Array<Pick<Doc<"users">, "_id" | "name" | "jobTitle" | "department">>;
  // Judul area kop khusus NOTA (memo), diatur per tenant. Bila kosong, dipakai
  // default "NOTA". Hanya relevan saat letter.type === "memo".
  memoHeaderTitle?: string;
  // Logo opsional untuk kop NOTA (memo). Bila ada, ditampilkan di sebelah judul.
  // Hanya relevan saat letter.type === "memo".
  memoLogoUrl?: string | null;
  // Gaya garis atas & bawah area kop nota (diatur per tenant). Bila tidak
  // disertakan, dipakai nilai default. Hanya relevan saat letter.type === "memo".
  memoLine?: {
    topShow: boolean;
    topColor: string;
    topWidth: number;
    bottomShow: boolean;
    bottomColor: string;
    bottomWidth: number;
  };
};

interface LetterDocumentProps {
  detail: LetterDocumentDetail;
  // When true, hide preview-only sections (approval chain) so the rendered
  // output matches what is printed / archived as the official document.
  forCapture?: boolean;
}

// ————————————————————————————————————————————————————————————————
// Konstanta tata letak BERSAMA. Dipakai oleh dokumen resmi ini DAN oleh editor
// (LetterEditor mode kertas) supaya isi surat membungkus (wrap) baris & tinggi
// dengan CARA YANG SAMA PERSIS. Inilah kunci agar batas halaman di editor sama
// dengan Pratinjau/Cetak: lebar area teks, jenis & ukuran huruf, spasi baris,
// indent daftar, dan tabel harus identik di kedua tempat.
export const LETTER_FONT_FAMILY = "'Noto Serif Letter', 'Noto Serif', serif";
// Margin kiri/kanan dokumen resmi (mm). Editor memakai nilai yang sama agar
// lebar area teks (yang menentukan titik pemenggalan baris) persis sama.
export const LETTER_MARGIN_X_MM = 25;
// Kelas gaya isi surat: huruf, spasi baris, indent daftar, gambar, sorotan, dan
// tabel. Tidak menyertakan gaya pemutus halaman (page-break) karena tampilannya
// berbeda: di editor terlihat sebagai garis putus-putus, di dokumen resmi tak
// terlihat. Itu ditambahkan terpisah di masing-masing tempat.
export const LETTER_BODY_CLASS =
  "text-sm leading-loose [tab-size:4] [&_p]:whitespace-pre-wrap [&_p:empty]:min-h-[1lh] [&_ul]:list-disc [&_ul]:pl-8 [&_ol]:list-decimal [&_ol]:pl-8 [&_li]:my-1 [&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square] [&_ol_ol]:list-[lower-alpha] [&_ol_ol_ol]:list-[lower-roman] [&_img]:max-w-full [&_img]:h-auto [&_mark]:rounded [&_mark]:px-0.5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-400 [&_td]:p-2 [&_th]:border [&_th]:border-gray-400 [&_th]:p-2 [&_th]:font-semibold [&_th]:align-top [&_td]:align-top";

// Padding luar dokumen resmi (atas 20mm, kanan/kiri 25mm, bawah 30mm). Diekspor
// agar editor (mode kertas WYSIWYG) memakai nilai yang sama persis sehingga kop
// dan tanda tangan sejajar dengan hasil cetak.
export const LETTER_PADDING = "20mm 25mm 30mm 25mm";

// Hitung data penandatangan dari detail surat. Penandatangan dokumen resmi selalu
// PENGIRIM surat (bukan pembuat/konseptor). Tanda tangan gambar mengikuti
// penyetuju terakhir (bila ada rantai persetujuan) atau tanda tangan tersimpan.
function resolveSigner(detail: LetterDocumentDetail) {
  const { letter, approvals, authorSignature } = detail;
  const approvedApprovals = approvals.filter((a) => a.status === "approved");
  const signerApproval =
    [...approvedApprovals].sort((a, b) => b.order - a.order)[0] ??
    [...approvals].sort((a, b) => b.order - a.order)[0] ??
    null;
  return {
    name: letter.fromName ?? detail.fromUser?.name ?? null,
    jobTitle: detail.fromUser?.jobTitle ?? "",
    department: detail.fromUser?.department ?? "",
    nip: detail.fromUser?.nip ?? "",
    signature: signerApproval ? (signerApproval.signatureData ?? null) : authorSignature,
  };
}

/**
 * Bagian ATAS dokumen (kop surat + blok nomor + tanggal/tujuan). Dipakai oleh
 * dokumen resmi DAN oleh editor mode kertas agar tampilan editor identik dengan
 * hasil cetak.
 */
export function LetterHeaderBlocks({ detail }: { detail: LetterDocumentDetail }) {
  const { letter, letterhead, attachments } = detail;
  const accentColor = letterhead?.accentColor ?? "#1d4ed8";
  // Khusus memo: kop surat dinonaktifkan. Area kop hanya menampilkan label judul
  // yang dapat diatur tiap tenant (mis. "NOTA", "NOTA DINAS", "MEMO").
  const isMemo = letter.type === "memo";
  const memoTitle = (detail.memoHeaderTitle ?? "").trim() || "NOTA";
  // Gaya garis kop nota (per tenant). Nilai default bila tidak disetel.
  const memoLine = detail.memoLine ?? {
    topShow: true,
    topColor: "#1f2937",
    topWidth: 4,
    bottomShow: true,
    bottomColor: "#1f2937",
    bottomWidth: 2,
  };
  return (
    <>
      {/* KOP SURAT */}
      {isMemo ? (
        <div
          className="mb-4 py-2"
          style={{
            borderTopStyle: memoLine.topShow ? "solid" : "none",
            borderTopWidth: memoLine.topShow ? memoLine.topWidth : 0,
            borderTopColor: memoLine.topColor,
            borderBottomStyle: memoLine.bottomShow ? "solid" : "none",
            borderBottomWidth: memoLine.bottomShow ? memoLine.bottomWidth : 0,
            borderBottomColor: memoLine.bottomColor,
          }}
        >
          {detail.memoLogoUrl ? (
            // Dengan logo: logo di kiri, judul mengisi sisa lebar dan tetap
            // berada di tengah secara visual (offset selebar logo di kanan).
            <div className="flex items-center gap-4">
              <img
                src={detail.memoLogoUrl}
                alt="Logo"
                className="h-16 w-16 object-contain shrink-0"
                crossOrigin="anonymous"
              />
              <p className="flex-1 text-center text-lg font-bold">{memoTitle}</p>
              <div className="h-16 w-16 shrink-0" aria-hidden />
            </div>
          ) : (
            <p className="text-center text-lg font-bold">{memoTitle}</p>
          )}
        </div>
      ) : letterhead ? (
        <div className="mb-4">
          {(letterhead.showTopLine ?? true) && <div style={{ height: 2.5, background: accentColor }} />}
          <div className="flex items-center gap-4 py-2">
            {letterhead.logoUrl && (
              <img src={letterhead.logoUrl} alt="Logo" className="h-16 w-16 object-contain shrink-0" crossOrigin="anonymous" />
            )}
            <div className="flex-1">
              <p className="text-lg font-bold" style={{ color: accentColor }}>{letterhead.organizationName}</p>
              <p className="text-xs text-gray-600">{letterhead.organizationAddress}</p>
              {(letterhead.organizationPhone || letterhead.organizationEmail || letterhead.organizationWebsite) && (
                <p className="text-xs text-gray-600">
                  {[
                    letterhead.organizationPhone ? `Telp: ${letterhead.organizationPhone}` : null,
                    letterhead.organizationEmail ? `Email: ${letterhead.organizationEmail}` : null,
                    letterhead.organizationWebsite ? `Website: ${letterhead.organizationWebsite}` : null,
                  ].filter(Boolean).join(" | ")}
                </p>
              )}
            </div>
          </div>
          {(letterhead.showBottomLine ?? true) && <div style={{ height: 1.2, background: accentColor }} />}
        </div>
      ) : (
        <div className="mb-4 border-b-2 border-t-4 border-gray-800 py-2">
          <p className="text-center text-lg font-bold">SURAT RESMI</p>
        </div>
      )}

      {/* Nomor surat — label & titik dua dibuat rata menggunakan lebar tetap.
          Tanggal ditempatkan pada baris yang sama dengan Nomor, rata tepi kanan. */}
      <div className="mb-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {letter.letterNumber && (
              <p className="flex">
                <span className="font-semibold shrink-0" style={{ width: 88 }}>Nomor</span>
                <span className="shrink-0">:&nbsp;</span>
                <span>{letter.letterNumber}</span>
              </p>
            )}
            {letter.classification !== "biasa" && (
              <p className="flex">
                <span className="font-semibold shrink-0" style={{ width: 88 }}>Sifat</span>
                <span className="shrink-0">:&nbsp;</span>
                <span className="uppercase font-bold">{letter.classification.replace("_", " ")}</span>
              </p>
            )}
            {attachments.length > 0 && (
              <p className="flex">
                <span className="font-semibold shrink-0" style={{ width: 88 }}>Lampiran</span>
                <span className="shrink-0">:&nbsp;</span>
                <span>{attachments.length} berkas</span>
              </p>
            )}
            <p className="flex">
              <span className="font-semibold shrink-0" style={{ width: 88 }}>Perihal</span>
              <span className="shrink-0">:&nbsp;</span>
              <span>{letter.subject}</span>
            </p>
            {/* Baris No. selalu tampil. Sebelum nomor terbentuk dibiarkan kosong
                untuk diisi manual; setelah terbentuk otomatis diisi nomor asli. */}
            <p className="flex">
              <span className="font-semibold shrink-0" style={{ width: 88 }}>No.</span>
              <span className="shrink-0">:&nbsp;</span>
              <span>{letter.letterNumber ?? ""}</span>
            </p>
          </div>
          <p className="text-right whitespace-nowrap shrink-0">{[letter.place, format(new Date(letter.letterDate), "d MMMM yyyy", { locale: localeId })].filter(Boolean).join(", ")}</p>
        </div>
      </div>

      {/* Kepada */}
      <div className="mb-4 text-sm">
        <p>Kepada Yth.</p>
        <p className="font-semibold">{letter.toName}</p>
        {letter.toJobTitle && <p>{formatJobTitleSentence(letter.toJobTitle)}</p>}
        {letter.toOrganization && <p>{letter.toOrganization}</p>}
        {letter.toAddress && <p>{letter.toAddress}</p>}
      </div>
    </>
  );
}

/**
 * Bagian BAWAH dokumen (tanda tangan + rantai persetujuan + daftar lampiran).
 * Dipakai oleh dokumen resmi DAN editor mode kertas.
 */
export function LetterSignatureBlocks({
  detail,
  forCapture = false,
}: {
  detail: LetterDocumentDetail;
  forCapture?: boolean;
}) {
  const { letter, attachments, approvals } = detail;
  const signer = resolveSigner(detail);
  // Metode "basah": kosongkan gambar tanda tangan agar ditandatangani manual,
  // namun ruang tanda tangan, nama, jabatan, NIP, dan QR tetap dipertahankan.
  const isWetSignature = letter.signatureMethod === "basah";
  // Daftar tembusan gabungan: internal (direktori) + eksternal (manual).
  const ccInternal = detail.ccUsers ?? [];
  const ccExternal = letter.ccExternal ?? [];
  const ccItems = [
    ...ccInternal.map((u) =>
      [u.name, u.jobTitle ? formatJobTitle(u.jobTitle) : null].filter(Boolean).join(" - "),
    ),
    ...ccExternal,
  ];
  return (
    <>
      {/* Signature. Ditandai data-keep-together agar paginasi memperlakukannya
          sebagai satu kesatuan: bila tidak muat di sisa halaman, seluruh blok
          pindah ke halaman berikutnya (tidak terpotong di tengah). */}
      <div
        data-keep-together
        className="mt-8 flex items-end justify-end gap-4 text-sm"
      >
        {/* QR verifikasi keaslian – ditempatkan tepat di sebelah kiri tanda tangan */}
        {letter.verificationCode && (
          <div className="flex flex-col items-center text-center shrink-0 self-end">
            <LetterQRCode code={letter.verificationCode} size={92} />
            <p className="mt-1 text-[8px] leading-tight text-gray-500" style={{ maxWidth: 100 }}>
              Pindai untuk verifikasi keaslian
            </p>
            {letter.letterNumber && (
              <p className="text-[8px] leading-tight text-gray-500" style={{ maxWidth: 100 }}>
                No: {letter.letterNumber}
              </p>
            )}
            <p className="text-[8px] font-mono text-gray-500">{letter.verificationCode}</p>
          </div>
        )}

        <div className="text-center">
          <p>Hormat kami,</p>
          {signer.jobTitle && <p>{formatJobTitle(signer.jobTitle)}</p>}
          {signer.department && <p>{signer.department}</p>}
          <div className="mt-4 flex flex-col items-center" style={{ minHeight: 64 }}>
            {signer.signature && !isWetSignature ? (
              <img src={signer.signature} alt="Tanda tangan" className="h-16 object-contain" style={{ maxWidth: 180 }} />
            ) : (
              <div style={{ height: 48 }} />
            )}
            <p className="font-bold underline mt-1">{signer.name ?? "_________________"}</p>
            {signer.nip && <p>NIP. {signer.nip}</p>}
          </div>
        </div>
      </div>

      {/* Approval chain – preview only, not part of the official printed/archived document */}
      {!forCapture && approvals.length > 0 && (
        <div className="mt-6 no-print">
          <p className="mb-2 text-xs font-semibold uppercase">Diketahui / Disetujui:</p>
          <div className="flex gap-4 flex-wrap">
            {approvals.map((a) => (
              <div key={a._id} className="border border-gray-400 p-2 text-center flex flex-col items-center justify-between" style={{ width: 130, minHeight: 100 }}>
                {a.signatureData ? (
                  <img src={a.signatureData} alt="TTD" style={{ height: 48, maxWidth: 110, objectFit: "contain" }} />
                ) : (
                  <div style={{ height: 48 }} />
                )}
                <div>
                  <p className="text-xs font-semibold">{a.approver?.name ?? "-"}</p>
                  <p className="text-[9px] text-gray-500">{formatJobTitle(a.approver?.jobTitle)}</p>
                  {a.status === "approved" && <p className="text-[9px] text-green-600">✓ Disetujui</p>}
                  {a.status === "pending" && <p className="text-[9px] text-gray-400">Menunggu</p>}
                  {a.status === "rejected" && <p className="text-[9px] text-red-500">✗ Ditolak</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tembusan (CC). Ditempatkan di kiri bawah, di bawah blok tanda tangan,
          sesuai tata naskah dinas. Menggabungkan tembusan internal (direktori)
          dan tembusan eksternal (manual). */}
      {ccItems.length > 0 && (
        <div data-keep-together className="mt-8 text-sm">
          <p className="font-semibold">Tembusan:</p>
          <ol className="list-decimal pl-6">
            {ccItems.map((label, i) => (
              <li key={i}>{label}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="mt-6 text-xs">
          <p className="font-semibold">Lampiran:</p>
          {attachments.map((att, i) => (
            <p key={att._id}>{i + 1}. {att.fileName}</p>
          ))}
        </div>
      )}
    </>
  );
}

// The official A4 letter document. Shared between the on-screen print preview
// (LetterPrintView) and the PDF archive generator so both produce identical
// output. Uses forwardRef so callers can capture the node for PDF export.
const LetterDocument = forwardRef<HTMLDivElement, LetterDocumentProps>(
  function LetterDocument({ detail, forCapture = false }, ref) {
    const { letter } = detail;

    return (
      <div
        ref={ref}
        className="mx-auto bg-white text-black"
        style={{
          minHeight: "297mm",
          maxWidth: "210mm",
          padding: LETTER_PADDING,
          fontFamily: LETTER_FONT_FAMILY,
          fontSize: "12pt",
          lineHeight: 1.8,
        }}
      >
        <LetterHeaderBlocks detail={detail} />

        {/* Body. Catatan: sapaan "Dengan hormat," sudah menjadi bagian dari
            isi surat (template body), sehingga tidak ditulis ulang di sini agar
            tidak muncul dua kali di hasil cetak/PDF. Isi dinormalisasi agar baris
            kosong terakhir (trailing break) tampil sama seperti di editor. */}
        <div
          data-letter-body
          className={`mb-6 ${LETTER_BODY_CLASS} [&_.page-break]:h-0 [&_.page-break]:border-0`}
          dangerouslySetInnerHTML={{ __html: normalizeBodyHtmlForDisplay(letter.content) }}
          style={{ textAlign: "justify" }}
        />

        <LetterSignatureBlocks detail={detail} forCapture={forCapture} />
      </div>
    );
  },
);

export default LetterDocument;
