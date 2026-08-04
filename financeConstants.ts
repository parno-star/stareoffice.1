// Shared constants for finance approval. Kept free of server imports so both
// frontend and backend can import them without pulling Convex server code
// into the browser bundle.
export const REQUEST_TYPES = [
  { key: "operational", label: "Operasional Rutin" },
  { key: "procurement", label: "Pengadaan Barang/Jasa" },
  { key: "reimbursement", label: "Reimbursement" },
  { key: "petty_cash", label: "Petty Cash" },
  { key: "capital", label: "Anggaran Besar / Investasi" },
  { key: "travel", label: "Perjalanan Dinas" },
  { key: "custom", label: "Lainnya" },
] as const;

// Finance function keys for role mapping
export const FINANCE_FUNCTIONS = [
  { key: "ppk", label: "Pejabat Pembuat Komitmen (PPK)", description: "Mengikat komitmen anggaran" },
  { key: "ppspm", label: "Pejabat Penandatangan SPM (PPSPM)", description: "Menandatangani Surat Perintah Membayar" },
  { key: "bendahara", label: "Bendahara Pengeluaran", description: "Eksekusi pembayaran & pencatatan" },
  { key: "kpa", label: "Kuasa Pengguna Anggaran (KPA)", description: "Otorisasi final untuk nilai besar" },
  { key: "verifikator", label: "Verifikator Keuangan", description: "Cek kelengkapan dokumen & ketersediaan dana" },
] as const;
