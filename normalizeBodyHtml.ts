// Menyelaraskan cara isi surat DITAMPILKAN antara editor (ProseMirror) dan
// Pratinjau/Cetak (HTML statis).
//
// Masalah: editor teks kaya (ProseMirror) menambahkan satu "baris jeda akhir"
// (trailing break) tak-terlihat pada setiap blok yang diakhiri <br> agar baris
// kosong terakhir tetap tampak saat mengetik. HTML statis (dangerouslySetInnerHTML
// pada dokumen resmi) TIDAK melakukan ini, sehingga blok yang diakhiri Enter/<br>
// tampil lebih pendek satu baris di Pratinjau dibanding di editor. Akibatnya
// jarak menjelang tanda tangan berbeda dan batas halaman meleset.
//
// Solusi: tiru perilaku editor pada HTML Pratinjau — untuk setiap blok yang
// anak terakhirnya <br>, tambahkan satu <br> lagi. Dengan begitu tinggi blok di
// Pratinjau/Cetak SAMA PERSIS dengan di editor. Konten tersimpan tidak diubah
// (sumber kebenaran tetap isi editor); normalisasi hanya untuk tampilan.
export function normalizeBodyHtmlForDisplay(html: string): string {
  // Butuh DOM (browser). Di lingkungan tanpa DOM, kembalikan apa adanya.
  if (typeof document === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const blocks = doc.body.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, li, blockquote",
  );

  blocks.forEach((block) => {
    // Cari anak terakhir yang bukan teks kosong (spasi/baris baru murni).
    let last: ChildNode | null = block.lastChild;
    while (
      last &&
      last.nodeType === Node.TEXT_NODE &&
      !(last.textContent ?? "").trim()
    ) {
      last = last.previousSibling;
    }
    // Bila blok diakhiri <br>, tambahkan satu <br> untuk meniru baris jeda akhir
    // editor. Blok yang benar-benar kosong (<p></p>) dilewati karena sudah
    // ditangani lewat CSS `:empty` (tinggi minimum 1 baris) di kedua tempat.
    if (
      last &&
      last.nodeType === Node.ELEMENT_NODE &&
      (last as Element).tagName === "BR"
    ) {
      block.appendChild(doc.createElement("br"));
    }
  });

  return doc.body.innerHTML;
}
