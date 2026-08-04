import { A4_WIDTH_PX, A4_HEIGHT_PX, type RenderedLetterImage } from "../_lib/renderLetterImage.ts";

// Jarak vertikal antar-lembar halaman pada tampilan (px, sebelum zoom).
export const PAGE_GAP_PX = 24;

interface PagedLetterViewProps {
  rendered: RenderedLetterImage;
  zoom: number;
}

/**
 * Menampilkan surat sebagai lembar-lembar A4 TERPISAH (seperti Word/PDF).
 *
 * Berbeda dengan cara lama yang memotong satu gambar panjang pada tinggi A4 tetap
 * (sehingga baris bisa terpotong di tengah dan isi halaman berikut "bocor"),
 * komponen ini memakai segmen halaman yang sadar-baris: setiap lembar hanya
 * menampilkan potongan isi dari `segment.start` sampai `segment.end` (batas yang
 * jatuh DI ANTARA baris), lalu sisanya dibiarkan putih seperti kertas kosong.
 * Hasilnya mencerminkan realitas hasil cetak.
 */
export default function PagedLetterView({ rendered, zoom }: PagedLetterViewProps) {
  const { segments, dataUrl, docHeight } = rendered;
  const pageCount = Math.max(1, segments.length);

  return (
    <div
      className="relative mx-auto"
      style={{
        width: A4_WIDTH_PX * zoom,
        height: (pageCount * A4_HEIGHT_PX + (pageCount - 1) * PAGE_GAP_PX) * zoom,
      }}
    >
      <div
        className="absolute left-0 top-0 flex flex-col"
        style={{
          width: A4_WIDTH_PX,
          gap: PAGE_GAP_PX,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        {segments.map((seg, i) => {
          // Tinggi isi yang ditampilkan pada lembar ini (tidak boleh melebihi A4
          // dikurangi ruang atas margin halaman lanjutan).
          const segHeight = Math.min(
            seg.end - seg.start,
            A4_HEIGHT_PX - seg.topPad,
          );
          return (
            <div
              key={i}
              className="relative overflow-hidden bg-white shadow-lg ring-1 ring-black/5"
              style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX }}
            >
              {/* Jendela klip: hanya menampilkan potongan isi [start, end], digeser
                  ke bawah sebesar margin atas halaman (topPad) sehingga halaman
                  lanjutan punya ruang kosong di atas seperti halaman pertama.
                  Sisa lembar tetap putih (kertas kosong). */}
              <div
                className="absolute left-0 overflow-hidden"
                style={{ left: 0, top: seg.topPad, width: A4_WIDTH_PX, height: segHeight }}
              >
                <img
                  src={dataUrl}
                  alt={`Halaman ${i + 1}`}
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: -seg.start,
                    width: A4_WIDTH_PX,
                    // Tampilkan gambar pada tinggi dokumen ASLI (koordinat yang
                    // sama dengan perhitungan segmen) supaya potongan tiap
                    // halaman selaras persis, tanpa drift.
                    height: docHeight,
                  }}
                />
              </div>
              {/* Nomor halaman */}
              <div className="pointer-events-none absolute bottom-2 right-3">
                <span className="rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white shadow">
                  Halaman {i + 1} / {pageCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
