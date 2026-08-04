import { forwardRef } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { LETTER_FONT_FAMILY, type LetterDocumentDetail } from "./LetterDocument.tsx";

interface IncomingLetterDocumentProps {
  detail: LetterDocumentDetail;
}

const classificationLabel = (c: string) =>
  c === "biasa" ? "Biasa" : c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const fmtDate = (iso?: string) =>
  iso ? format(new Date(iso), "d MMMM yyyy", { locale: localeId }) : "—";

// Official A4 registration sheet ("Lembar Registrasi Surat Masuk") used as the
// permanent PDF archive for incoming letters. Incoming letters are recorded,
// not authored, so this presents the received metadata rather than a formal
// letter body with signature.
const IncomingLetterDocument = forwardRef<HTMLDivElement, IncomingLetterDocumentProps>(
  function IncomingLetterDocument({ detail }, ref) {
    const { letter, letterhead, attachments, author } = detail;
    const accentColor = letterhead?.accentColor ?? "#0d9488";

    const rows: { label: string; value: string }[] = [
      { label: "Nomor Agenda", value: letter.agendaNumber || "—" },
      { label: "Nomor Surat", value: letter.letterNumber || "—" },
      { label: "Tanggal Surat", value: fmtDate(letter.letterDate) },
      { label: "Tanggal Diterima", value: fmtDate(letter.receivedAt) },
      { label: "Pengirim", value: letter.fromName || "—" },
      { label: "Instansi Pengirim", value: letter.fromOrganization || "—" },
      { label: "Alamat Pengirim", value: letter.fromAddress || "—" },
      { label: "Diterima Oleh", value: letter.toName || "—" },
      { label: "Kategori", value: letter.category || "—" },
      { label: "Klasifikasi", value: classificationLabel(letter.classification) },
      {
        label: "Bentuk Surat",
        value: letter.isPhysical ? "Surat fisik (dipindai)" : "Surat digital",
      },
    ];

    return (
      <div
        ref={ref}
        className="mx-auto bg-white p-10 text-black"
        style={{
          minHeight: "297mm",
          maxWidth: "210mm",
          fontFamily: LETTER_FONT_FAMILY,
          fontSize: "12pt",
          lineHeight: 1.7,
        }}
      >
        {/* KOP */}
        {letterhead ? (
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
            <p className="text-center text-lg font-bold">LEMBAR REGISTRASI SURAT MASUK</p>
          </div>
        )}

        {/* Title */}
        <div className="mb-5 text-center">
          <p className="text-base font-bold uppercase tracking-wide">Lembar Registrasi Surat Masuk</p>
          <p className="text-xs text-gray-600">Bukti pencatatan surat masuk</p>
        </div>

        {/* Perihal */}
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Perihal</p>
          <p className="text-sm font-bold">{letter.subject}</p>
        </div>

        {/* Metadata table */}
        <table className="mb-6 w-full border-collapse text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderBottom: "1px solid #d1d5db" }}>
                <td className="py-1.5 pr-3 align-top font-semibold" style={{ width: "38%" }}>{r.label}</td>
                <td className="py-1.5 align-top">: {r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Isi ringkas / catatan */}
        {letter.content && letter.content.replace(/<[^>]*>/g, "").trim().length > 0 && (
          <div className="mb-5">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Ringkasan / Isi</p>
            <div
              className="rounded border border-gray-300 p-3 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: letter.content }}
              style={{ textAlign: "justify" }}
            />
          </div>
        )}

        {letter.notes && (
          <div className="mb-5">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Catatan</p>
            <p className="text-sm">{letter.notes}</p>
          </div>
        )}

        {/* Lampiran */}
        {attachments.length > 0 && (
          <div className="mb-5 text-sm">
            <p className="mb-1 font-semibold">Lampiran ({attachments.length}):</p>
            {attachments.map((att, i) => (
              <p key={att._id}>{i + 1}. {att.fileName}</p>
            ))}
          </div>
        )}

        {letter.isPhysical && letter.physicalDocFileName && (
          <div className="mb-5 text-sm">
            <p className="font-semibold">Dokumen Fisik Terpindai:</p>
            <p>{letter.physicalDocFileName}</p>
            <p className="text-xs text-gray-500">Berkas hasil pindai tersimpan terpisah dan dapat diunduh dari sistem.</p>
          </div>
        )}

        {/* Petugas pencatat */}
        <div className="mt-10 flex justify-end text-sm">
          <div className="text-center" style={{ minWidth: 200 }}>
            <p>Dicatat oleh,</p>
            <div style={{ height: 56 }} />
            <p className="font-bold underline">{author?.name ?? "_________________"}</p>
            <p className="text-xs">{author?.jobTitle ?? "Petugas Persuratan"}</p>
          </div>
        </div>
      </div>
    );
  },
);

export default IncomingLetterDocument;
