/**
 * Data panduan otomatis — setiap key harus match dengan MenuKey
 * di navGroups (DashboardLayout). Jika ada menu baru, cukup
 * tambahkan entri di sini dan panduan otomatis muncul.
 *
 * Untuk menu yang belum memiliki konten panduan eksplisit,
 * sistem akan men-generate placeholder "Segera Hadir".
 */

export type GuideStep = {
  title: string;
  description: string;
};

export type MenuGuide = {
  /** Deskripsi singkat tujuan menu */
  purpose: string;
  /** Flow proses dalam bentuk langkah-langkah */
  flow: string[];
  /** Langkah pengoperasian detail */
  steps: GuideStep[];
  /** Status: "active" jika sudah tersedia, "coming_soon" jika belum */
  status: "active" | "coming_soon";
};

/**
 * Registry panduan — kunci = MenuKey.
 * Ketika menu baru ditambahkan ke navGroups tapi belum ada
 * di sini, fungsi `getGuideForMenu` akan mengembalikan
 * panduan placeholder.
 */
export const guideRegistry: Record<string, MenuGuide> = {
  // ═══════════════════════════════════════════════
  // UMUM
  // ═══════════════════════════════════════════════
  dashboard: {
    purpose:
      "Dashboard adalah halaman utama setelah login. Menampilkan 4 kartu statistik (Surat Masuk, Surat Keluar, Surat Bulan Ini, Total Karyawan), banner perayaan hari ini, pengumuman terbaru, event mendatang, dan pintasan cepat ke fitur utama.",
    flow: [
      "Klik menu 'Dashboard' di sidebar kiri (ikon kotak grid)",
      "Periksa 4 kartu statistik di bagian atas halaman",
      "Scroll ke bawah untuk melihat banner perayaan, pengumuman, dan event",
      "Gunakan tombol 'Kelola Surat' atau 'Lihat Semua' pada kartu untuk navigasi langsung",
      "Klik pintasan cepat (Quick Access) di bagian bawah untuk akses fitur lain",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "Di bagian atas ada 4 kartu: 'Surat Masuk' (jumlah surat masuk), 'Surat Keluar' (jumlah surat keluar), 'Surat Bulan Ini' (total surat bulan berjalan), dan 'Total Karyawan'. Setiap kartu menampilkan angka dan persentase tren naik/turun. Klik kartu untuk langsung membuka halaman Kelola Surat.",
      },
      {
        title: "Banner Perayaan",
        description:
          "Jika ada karyawan yang berulang tahun atau anniversary kerja hari ini, banner ucapan otomatis muncul di bawah kartu statistik. Klik nama karyawan untuk melihat profilnya.",
      },
      {
        title: "Pengumuman Terbaru",
        description:
          "Daftar pengumuman terbaru ditampilkan di kolom utama. Admin dapat membuat pengumuman baru langsung dari Dashboard dengan mengisi judul dan isi, lalu klik 'Kirim'. Karyawan dapat membaca pengumuman dengan klik judul.",
      },
      {
        title: "Event Mendatang",
        description:
          "Di kolom kanan (atau bawah di mobile), daftar event perusahaan yang akan datang ditampilkan beserta tanggal dan lokasi. Klik event untuk melihat detail lengkap.",
      },
      {
        title: "Pintasan Cepat (Quick Access)",
        description:
          "Grid pintasan cepat di bagian bawah menampilkan ikon-ikon menuju fitur yang sering digunakan seperti Pesan, Kalender, Absensi, dan lainnya. Klik ikon untuk langsung membuka halaman tersebut.",
      },
    ],
    status: "active",
  },

  messages: {
    purpose:
      "Menu Pesan untuk berkomunikasi langsung dengan rekan kerja. Tampilan dibagi dua: daftar percakapan di sisi kiri dan area chat di sisi kanan. Di mobile, daftar dan chat ditampilkan bergantian.",
    flow: [
      "Klik menu 'Pesan' di sidebar kiri (ikon balon chat)",
      "Daftar percakapan muncul di panel kiri dengan nama dan pesan terakhir",
      "Klik nama kontak untuk membuka riwayat chat di panel kanan",
      "Ketik pesan di kolom input bawah, lalu tekan Enter atau klik tombol kirim",
      "Untuk percakapan baru, klik ikon '+' (Percakapan baru) di pojok kanan atas panel daftar",
    ],
    steps: [
      {
        title: "Mencari Percakapan",
        description:
          "Di bagian atas daftar percakapan terdapat kolom 'Cari percakapan...'. Ketik nama rekan kerja untuk memfilter daftar. Hasil langsung tampil saat Anda mengetik.",
      },
      {
        title: "Membuat Percakapan Baru",
        description:
          "Klik tombol ikon '+' (Percakapan baru) di pojok kanan atas. Dialog akan terbuka menampilkan daftar rekan kerja. Pilih nama penerima, lalu mulai ketik pesan pertama Anda.",
      },
      {
        title: "Mengirim & Membaca Pesan",
        description:
          "Klik percakapan di daftar kiri untuk membuka chat. Riwayat pesan ditampilkan dari atas ke bawah. Ketik pesan di kolom input paling bawah, lalu tekan Enter untuk mengirim. Pesan terkirim langsung muncul di layar.",
      },
      {
        title: "Navigasi di Mobile",
        description:
          "Di layar mobile, hanya satu panel yang tampil. Saat membuka chat, klik tombol panah kembali di pojok kiri atas untuk kembali ke daftar percakapan.",
      },
      {
        title: "Badge Pesan Belum Dibaca",
        description:
          "Di sidebar, menu 'Pesan' menampilkan badge angka merah jika ada pesan belum dibaca. Angka menunjukkan jumlah percakapan dengan pesan baru. Badge otomatis hilang setelah percakapan dibuka.",
      },
    ],
    status: "active",
  },

  notifications: {
    purpose:
      "Pusat Notifikasi menampilkan semua pemberitahuan penting: pengumuman baru, persetujuan cuti, disposisi surat, tugas baru, dan aktivitas lainnya. Terdapat dua tab filter dan tiga tombol aksi di header.",
    flow: [
      "Klik ikon lonceng di header atas, atau klik menu 'Notifikasi' di sidebar",
      "Halaman 'Pusat Notifikasi' terbuka dengan jumlah belum dibaca di subtitle",
      "Gunakan tab 'Semua' atau 'Belum dibaca' untuk memfilter",
      "Klik notifikasi untuk langsung menuju halaman terkait",
      "Gunakan tombol aksi di header untuk mengelola notifikasi",
    ],
    steps: [
      {
        title: "Tab Filter",
        description:
          "Di bawah judul terdapat 2 tab: 'Semua' (menampilkan seluruh notifikasi) dan 'Belum dibaca' (hanya yang belum dibuka). Klik tab untuk beralih tampilan.",
      },
      {
        title: "Membuka Detail Notifikasi",
        description:
          "Klik item notifikasi mana saja untuk langsung diarahkan ke halaman terkait. Contoh: notifikasi persetujuan cuti akan membuka halaman Pengajuan Cuti. Notifikasi otomatis ditandai sudah dibaca saat diklik.",
      },
      {
        title: "Tombol 'Pengaturan'",
        description:
          "Klik tombol 'Pengaturan' (ikon gerigi) di pojok kanan atas untuk membuka halaman pengaturan notifikasi. Di sini Anda bisa mengatur jenis notifikasi yang ingin diterima.",
      },
      {
        title: "Tombol 'Tandai semua dibaca'",
        description:
          "Klik tombol 'Tandai semua dibaca' (ikon centang ganda) untuk menandai semua notifikasi sebagai sudah dibaca sekaligus. Badge angka di ikon lonceng akan hilang.",
      },
      {
        title: "Tombol 'Hapus semua'",
        description:
          "Klik tombol 'Hapus semua' (ikon tempat sampah merah) untuk menghapus seluruh notifikasi secara permanen. Dialog konfirmasi akan muncul bertuliskan 'Hapus semua notifikasi?' — klik 'Hapus semua' untuk konfirmasi atau 'Batal' untuk membatalkan.",
      },
    ],
    status: "active",
  },

  calendar: {
    purpose:
      "Kalender menampilkan jadwal kegiatan, rapat, deadline, hari libur nasional, dan event perusahaan. Tersedia tampilan 'Bulanan' (kalender grid) dan 'Daftar' (list view) dengan filter kategori dan cakupan.",
    flow: [
      "Klik menu 'Kalender' di sidebar kiri (ikon kalender)",
      "Secara default tampilan 'Bulanan' aktif dengan grid kalender bulan ini",
      "Gunakan tombol panah kiri/kanan di header untuk pindah bulan",
      "Klik tombol 'Hari ini' untuk kembali ke bulan dan tanggal sekarang",
      "Klik tanggal yang memiliki titik warna untuk melihat event di tanggal tersebut",
    ],
    steps: [
      {
        title: "Tampilan Bulanan",
        description:
          "Tab 'Bulanan' menampilkan grid kalender. Tanggal yang memiliki event ditandai dengan titik warna. Klik tanggal untuk melihat daftar event pada hari itu. Tanggal hari ini diberi highlight khusus.",
      },
      {
        title: "Tampilan Daftar",
        description:
          "Klik tab 'Daftar' untuk melihat semua event dalam bentuk list kronologis. Tersedia dropdown filter 'Kategori' (Rapat, Deadline, Libur, dll) dan 'Cakupan' (Semua, Pribadi, Tim, Perusahaan) untuk mempersempit hasil.",
      },
      {
        title: "Navigasi Bulan",
        description:
          "Di header kalender, klik tombol panah '<' untuk mundur satu bulan dan '>' untuk maju satu bulan. Klik tombol 'Hari ini' untuk langsung kembali ke bulan berjalan.",
      },
      {
        title: "Membuat Event (Admin)",
        description:
          "Jika Anda admin, tombol 'Buat Event' muncul di pojok kanan atas. Klik untuk membuka dialog pembuatan event. Isi judul, tanggal mulai, tanggal selesai, kategori, dan deskripsi, lalu klik 'Simpan'.",
      },
      {
        title: "Detail & Hapus Event",
        description:
          "Klik event yang sudah ada untuk melihat detail lengkap: waktu, kategori, deskripsi, dan pembuat. Admin dapat menghapus event dengan klik tombol 'Hapus' di dalam detail event.",
      },
    ],
    status: "active",
  },

  letters: {
    purpose:
      "Kelola Surat adalah pusat manajemen surat digital perusahaan. Terdapat 9 tab: Semua, Surat Masuk, Surat Keluar, Internal, Nota, Konsep, Persetujuan, Disposisi, dan Pengaturan. Setiap tab memiliki fungsi spesifik untuk mengelola alur surat.",
    flow: [
      "Klik menu 'Kelola Surat' di sidebar (ikon amplop terbuka)",
      "Halaman terbuka dengan tab 'Semua' aktif menampilkan seluruh surat",
      "Klik tab lain untuk memfilter berdasarkan jenis surat",
      "Gunakan kolom pencarian di atas daftar untuk mencari surat tertentu",
      "Klik surat untuk membuka panel detail di sisi kanan",
    ],
    steps: [
      {
        title: "Tab 'Semua'",
        description:
          "Menampilkan seluruh surat dari semua jenis. Setiap baris menunjukkan nomor surat, perihal, pengirim/penerima, tanggal, dan badge status (Draft, Review, Terkirim, dll). Klik baris surat untuk membuka detail di panel kanan.",
      },
      {
        title: "Membuat Surat Keluar",
        description:
          "Klik tombol hijau '+ Buat Surat' di pojok kanan atas. Pilih 'Buat Surat Keluar'. Dialog form terbuka: isi nomor surat, perihal, penerima, klasifikasi (Biasa/Rahasia/Sangat Rahasia), prioritas, dan isi surat. Klik 'Simpan sebagai Konsep' atau 'Kirim untuk Review'.",
      },
      {
        title: "Mencatat Surat Masuk",
        description:
          "Klik tombol '+ Buat Surat' lalu pilih 'Catat Surat Masuk'. Isi data surat masuk: nomor surat, pengirim, tanggal terima, perihal, dan upload lampiran jika ada. Klik 'Simpan'.",
      },
      {
        title: "Membuat Nota",
        description:
          "Klik tombol '+ Buat Surat' lalu pilih 'Buat Nota'. Isi penerima nota, perihal, dan isi nota. Klik 'Kirim' untuk mengirim langsung.",
      },
      {
        title: "Tab 'Disposisi'",
        description:
          "Tab Disposisi menampilkan surat yang didisposisikan kepada Anda. Badge ungu di tab menunjukkan jumlah disposisi belum dibaca. Klik surat, lalu klik 'Disposisi' untuk meneruskan ke orang lain dengan instruksi.",
      },
      {
        title: "Tab 'Persetujuan'",
        description:
          "Menampilkan surat yang menunggu persetujuan Anda. Klik surat lalu pilih 'Setujui' atau 'Tolak'. Surat yang disetujui akan otomatis dikirim.",
      },
      {
        title: "Tab 'Pengaturan'",
        description:
          "Khusus admin: kelola template nomor surat, klasifikasi, dan pengaturan alur persetujuan.",
      },
    ],
    status: "active",
  },

  chatbot: {
    purpose:
      "Asisten AI adalah chatbot pintar yang menjawab pertanyaan tentang kebijakan perusahaan, prosedur kerja, dan informasi umum. Bisa diakses dari menu sidebar atau tombol chat melayang (bubble) di pojok kanan bawah layar.",
    flow: [
      "Klik menu 'Asisten AI' di sidebar, atau klik tombol chat melayang di pojok kanan bawah",
      "Halaman chat terbuka dengan riwayat sesi di panel kiri dan area percakapan di kanan",
      "Ketik pertanyaan di kolom input bawah, lalu tekan Enter atau klik tombol kirim",
      "AI memproses dan menampilkan jawaban di area chat",
      "Klik 'Percakapan Baru' untuk memulai topik baru",
    ],
    steps: [
      {
        title: "Memulai Percakapan",
        description:
          "Di area chat utama, ketik pertanyaan di kolom input bawah. Contoh: 'Bagaimana cara mengajukan cuti?' atau 'Apa kebijakan reimbursement?'. Tekan Enter untuk mengirim. AI akan memproses dan menjawab dalam beberapa detik.",
      },
      {
        title: "Saran Pertanyaan Cepat",
        description:
          "Saat percakapan kosong, beberapa tombol saran pertanyaan muncul di tengah layar (seperti 'Cara mengajukan cuti', 'Kebijakan lembur', dll). Klik salah satu untuk langsung mengirim pertanyaan tanpa mengetik.",
      },
      {
        title: "Riwayat Sesi (Panel Kiri)",
        description:
          "Panel kiri menampilkan daftar semua sesi percakapan sebelumnya. Klik sesi untuk membuka kembali riwayat chat. Di mobile, klik ikon menu hamburger untuk membuka panel ini.",
      },
      {
        title: "Percakapan Baru",
        description:
          "Klik tombol 'Baru' atau 'Percakapan Baru' di atas panel kiri untuk memulai sesi chat baru dengan konteks bersih.",
      },
      {
        title: "Mengelola Sesi",
        description:
          "Arahkan kursor ke sesi di panel kiri — muncul ikon menu titik tiga. Klik untuk opsi: 'Ubah judul' (ganti nama sesi) atau 'Hapus sesi' (hapus permanen dengan dialog konfirmasi 'Hapus Sesi Chat?' — klik 'Hapus' atau 'Batal').",
      },
      {
        title: "Tombol Chat Melayang",
        description:
          "Di halaman mana pun dalam aplikasi, tombol bulat chat AI muncul di pojok kanan bawah. Klik untuk langsung membuka Asisten AI tanpa harus kembali ke sidebar.",
      },
    ],
    status: "active",
  },

  // ═══════════════════════════════════════════════
  // HUMAN RESOURCES
  // ═══════════════════════════════════════════════
  directory: {
    purpose:
      "Direktori Karyawan menampilkan daftar seluruh karyawan perusahaan. Tersedia 5 mode tampilan (Kartu, Daftar, Departemen, Hierarki, Keahlian), pencarian real-time, filter lanjutan multi-kriteria, pengurutan, dan ekspor ke CSV/PDF.",
    flow: [
      "Klik menu 'Direktori Karyawan' di sidebar kiri (ikon orang-orang)",
      "Halaman terbuka dengan header berisi 4 kartu statistik: Total Karyawan, Departemen, Lokasi, Keahlian Unik",
      "Gunakan kolom pencarian 'Cari nama, jabatan, email, departemen, keahlian...' untuk menemukan karyawan",
      "Klik tombol 'Filter Lanjutan' untuk filter multi-kriteria atau 'Urut' untuk mengubah pengurutan",
      "Pilih mode tampilan (Kartu/Daftar/Departemen/Hierarki/Keahlian) menggunakan tab di bawah area pencarian",
      "Klik kartu karyawan untuk membuka profil detail di halaman baru",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "Di bagian atas halaman terdapat 4 kartu statistik: 'Total Karyawan' (jumlah seluruh karyawan), 'Departemen' (jumlah departemen), 'Lokasi' (jumlah lokasi kerja), dan 'Keahlian Unik' (jumlah keahlian berbeda). Data ini otomatis terupdate.",
      },
      {
        title: "Pencarian Real-Time",
        description:
          "Ketik di kolom 'Cari nama, jabatan, email, departemen, keahlian...' di area pencarian. Hasil langsung diperbarui saat Anda mengetik. Klik ikon 'X' di sisi kanan kolom untuk menghapus pencarian.",
      },
      {
        title: "Filter Lanjutan",
        description:
          "Klik tombol 'Filter Lanjutan' (ikon slider). Panel popup muncul dengan 5 dropdown: Departemen, Lokasi, Jabatan, Keahlian, dan Atasan (Semua/Memiliki atasan/Tanpa atasan). Pilih kriteria yang diinginkan. Badge angka di tombol menunjukkan jumlah filter aktif. Klik 'Reset' di dalam popup untuk menghapus semua filter. Filter aktif ditampilkan sebagai chip berwarna di bawah kolom pencarian — klik 'X' pada chip untuk menghapus filter tertentu.",
      },
      {
        title: "Pengurutan",
        description:
          "Klik tombol 'Urut' (ikon panah atas-bawah). Pilih 'Nama', 'Departemen', 'Jabatan', atau 'Jumlah Bawahan'. Klik lagi untuk beralih antara 'Naik (A-Z)' dan 'Turun (Z-A)'. Tanda centang (✓) menunjukkan opsi yang sedang aktif.",
      },
      {
        title: "Mode Tampilan",
        description:
          "Gunakan 5 tab di bawah area pencarian: 'Kartu' (tampilan grid kartu dengan foto), 'Daftar' (tabel baris), 'Departemen' (dikelompokkan per departemen), 'Hierarki' (pohon atasan-bawahan), 'Keahlian' (dikelompokkan per skill). Angka di sebelah kanan menunjukkan jumlah karyawan yang ditemukan.",
      },
      {
        title: "Profil Karyawan",
        description:
          "Klik nama atau kartu karyawan untuk membuka halaman profil detail. Di sini Anda dapat melihat informasi kontak, jabatan, departemen, riwayat karier, dan keahlian.",
      },
      {
        title: "Edit Profil Saya",
        description:
          "Di header halaman terdapat tombol 'Edit Profil' yang memungkinkan Anda memperbarui data profil Anda sendiri: foto, nomor telepon, lokasi, keahlian, dan lainnya.",
      },
      {
        title: "Tambah Karyawan (Admin)",
        description:
          "Admin melihat tombol 'Tambah Karyawan' (ikon +) di pojok kanan atas header. Klik untuk membuka dialog pendaftaran karyawan baru.",
      },
      {
        title: "Ekspor Data",
        description:
          "Klik tombol 'Ekspor' (ikon unduh) di header. Pilih format: 'CSV (Excel)' untuk spreadsheet atau 'PDF' untuk dokumen cetak. File akan otomatis terunduh dengan nama berisi tanggal hari ini.",
      },
    ],
    status: "active",
  },

  organization: {
    purpose:
      "Struktur Organisasi adalah halaman lengkap untuk melihat dan mengelola hierarki perusahaan. Tersedia 16 tab: Bagan (org chart interaktif), Visualisasi (grafik lanjutan), Hierarki (pohon teks), Departemen, Analitik, Rentang Kendali, 9-Box, Jobdesk & KPI, Suksesi, Keahlian, Headcount, Benchmark, Skenario, AI Insight, Riwayat, dan Import & Export.",
    flow: [
      "Klik menu 'Struktur Organisasi' di sidebar kiri (ikon jaringan)",
      "Halaman terbuka dengan 5 kartu statistik: Total Karyawan, Departemen, Atasan/Manager, Tanpa Atasan, Kandidat Suksesi",
      "Gunakan 'Smart Search' atau kolom 'Cari karyawan, jabatan, atau departemen...' untuk menemukan orang",
      "Klik tab untuk berpindah antara 16 mode tampilan",
      "Klik kartu karyawan di bagan untuk melihat profil detail",
      "Admin dapat mengaktifkan 'Mode Tata Ulang Atasan' di tab Bagan untuk drag-and-drop",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "Di bagian atas: 5 kartu menunjukkan 'Total Karyawan', 'Departemen', 'Atasan/Manager' (jumlah orang yang menjadi atasan), 'Tanpa Atasan' (karyawan belum punya atasan), dan 'Kandidat Suksesi' (jumlah rencana suksesi). Data otomatis terupdate.",
      },
      {
        title: "Tab 'Bagan' (Org Chart)",
        description:
          "Tab default. Menampilkan bagan organisasi visual dari atas ke bawah. Klik kartu untuk melihat profil. Admin: aktifkan switch 'Mode Tata Ulang Atasan' di atas bagan — lalu seret kartu karyawan ke kartu atasan baru untuk memindahkan hubungan pelaporan. Klik tombol 'Ekspor Bagan' di header untuk mengunduh sebagai PNG atau PDF.",
      },
      {
        title: "Tab 'Visualisasi'",
        description:
          "Menampilkan grafik lanjutan seperti radial tree, bubble chart, dan representasi visual organisasi dari perspektif berbeda.",
      },
      {
        title: "Tab 'Hierarki'",
        description:
          "Menampilkan pohon teks hierarki atasan-bawahan yang bisa di-expand/collapse. Admin bisa klik menu pada setiap node untuk mengubah atasan karyawan.",
      },
      {
        title: "Tab 'Departemen'",
        description:
          "Menampilkan kartu per departemen dengan daftar anggota dan kepala departemen. Admin klik tombol 'Tambah Departemen' untuk membuat departemen resmi baru, atau ikon pensil untuk edit, dan ikon tempat sampah merah untuk hapus (dialog konfirmasi muncul).",
      },
      {
        title: "Tab 'Analitik'",
        description:
          "Dashboard grafik dan metrik organisasi: distribusi per departemen, rasio atasan, dan statistik lainnya.",
      },
      {
        title: "Tab 'Rentang Kendali'",
        description:
          "Analisis span of control — berapa banyak bawahan langsung per atasan. Membantu mengidentifikasi bottleneck manajemen.",
      },
      {
        title: "Tab '9-Box'",
        description:
          "Matriks 9-Box untuk penilaian potensi vs performa. Admin klik karyawan untuk mengisi assessment 9-Box.",
      },
      {
        title: "Tab 'Suksesi'",
        description:
          "Menampilkan posisi kunci (atasan dan admin) dengan rencana suksesi. Klik 'Kelola Suksesi' pada kartu untuk menetapkan kandidat pengganti, tingkat kesiapan, dan catatan pengembangan.",
      },
      {
        title: "Tab 'Keahlian'",
        description:
          "Peta keahlian seluruh karyawan. Admin bisa klik karyawan untuk menambah/edit keahlian dan mengelola dotted-line relationship.",
      },
      {
        title: "Tombol 'Jalur Pelaporan Saya'",
        description:
          "Di pojok kanan atas header, klik 'Jalur Pelaporan Saya' untuk melihat rantai pelaporan dari Anda ke pimpinan tertinggi dalam dialog pop-up.",
      },
      {
        title: "Tombol 'Ekspor Bagan'",
        description:
          "Klik 'Ekspor Bagan' di header. Dialog pengaturan ekspor terbuka: pilih format (PNG/PDF), ukuran kertas, orientasi, skala, warna latar, dan judul. Klik 'Unduh' untuk mengunduh file.",
      },
    ],
    status: "active",
  },

  teams: {
    purpose:
      "Tim Lintas Departemen untuk mengelola squad dan tim kolaboratif yang melintasi batas departemen. Setiap tim memiliki warna, ikon, Team Lead, dan daftar anggota. Admin dapat membuat, mengedit, dan menghapus tim serta mengelola anggota.",
    flow: [
      "Klik menu 'Tim' di sidebar kiri (ikon orang berkelompok)",
      "Halaman 'Tim Lintas Departemen' terbuka dengan pencarian dan grid kartu tim",
      "Gunakan kolom 'Cari tim atau anggota...' untuk mencari",
      "Klik avatar anggota untuk melihat profil karyawan",
      "Admin: klik 'Tim Baru' di pojok kanan atas untuk membuat tim",
    ],
    steps: [
      {
        title: "Melihat Daftar Tim",
        description:
          "Semua tim ditampilkan sebagai kartu grid (2 kolom di desktop). Setiap kartu menampilkan: nama tim, ikon dan warna, deskripsi, badge jumlah anggota, kotak Team Lead (nama dan avatar), dan deretan avatar anggota (maks 8 ditampilkan, sisanya '+N').",
      },
      {
        title: "Pencarian",
        description:
          "Ketik di kolom 'Cari tim atau anggota...' di bagian atas. Filter bekerja pada nama tim, deskripsi, dan nama/jabatan anggota. Hasil langsung diperbarui saat mengetik.",
      },
      {
        title: "Melihat Profil Anggota",
        description:
          "Klik avatar anggota mana saja pada kartu tim. Dialog profil karyawan muncul dengan detail lengkap: foto, nama, jabatan, departemen, kontak, dan lainnya.",
      },
      {
        title: "Membuat Tim Baru (Admin)",
        description:
          "Klik tombol 'Tim Baru' (ikon +) di pojok kanan atas. Dialog editor terbuka: isi nama tim, pilih warna dan ikon, tulis deskripsi, dan pilih Team Lead dari daftar karyawan. Klik 'Simpan' untuk membuat tim.",
      },
      {
        title: "Mengedit Tim (Admin)",
        description:
          "Pada kartu tim, klik ikon pensil di pojok kanan atas. Dialog editor sama seperti pembuatan terbuka dengan data terisi. Ubah nama, warna, deskripsi, atau Team Lead, lalu klik 'Simpan'.",
      },
      {
        title: "Menghapus Tim (Admin)",
        description:
          "Klik ikon tempat sampah merah di pojok kanan atas kartu tim. Dialog konfirmasi muncul: 'Hapus tim? Tim ... akan dihapus beserta seluruh anggotanya. Tindakan ini tidak dapat dibatalkan.' Klik 'Hapus' untuk konfirmasi atau 'Batal' untuk membatalkan.",
      },
      {
        title: "Kelola Anggota (Admin)",
        description:
          "Klik tombol 'Kelola Anggota' (ikon UserPlus) di bagian bawah kartu. Dialog daftar anggota terbuka — admin dapat menambah atau mengeluarkan anggota dari tim.",
      },
      {
        title: "Lihat Anggota (Karyawan)",
        description:
          "Karyawan biasa melihat tombol 'Lihat Anggota' (ikon UserMinus) di bagian bawah kartu. Klik untuk membuka daftar seluruh anggota tim dalam dialog read-only.",
      },
    ],
    status: "active",
  },

  attendance: {
    purpose:
      "Absensi & Jam Kerja untuk mencatat kehadiran harian (clock-in/clock-out), melihat ringkasan bulanan, riwayat absensi, dan siapa saja yang sudah hadir hari ini. Layout 2 kolom: konten utama di kiri (kartu jam, statistik bulanan, riwayat), dan daftar kehadiran tim di kanan.",
    flow: [
      "Klik menu 'Absensi' di sidebar kiri (ikon jam/fingerprint)",
      "Halaman 'Absensi & Jam Kerja' terbuka dengan kartu clock-in di bagian atas",
      "Klik tombol 'Clock-in' saat mulai bekerja",
      "Klik tombol 'Clock-out' saat selesai bekerja",
      "Scroll ke bawah untuk melihat statistik bulanan dan riwayat absensi",
    ],
    steps: [
      {
        title: "Kartu Clock-In/Out",
        description:
          "Kartu utama di bagian atas kiri menampilkan tanggal dan jam saat ini (format Indonesia). Jika belum clock-in, muncul tombol besar 'Clock-in' (ikon masuk). Klik untuk membuka dialog: isi 'Lokasi' (opsional: Kantor pusat/Remote/Client site) dan 'Catatan' (opsional), lalu klik 'Konfirmasi'. Setelah clock-in berhasil, kartu menampilkan waktu clock-in dan tombol berubah menjadi 'Clock-out'.",
      },
      {
        title: "Clock-Out",
        description:
          "Setelah clock-in, klik tombol 'Clock-out' (ikon keluar). Dialog muncul: isi 'Catatan' (opsional), lalu klik 'Konfirmasi'. Setelah berhasil, banner hijau muncul: 'Selamat, Anda telah menyelesaikan pekerjaan hari ini'. Waktu clock-in dan clock-out ditampilkan dalam kotak di kartu.",
      },
      {
        title: "Badge Terlambat",
        description:
          "Jika Anda clock-in melewati batas waktu yang ditetapkan, badge merah 'Terlambat' muncul di pojok kanan atas kartu clock-in.",
      },
      {
        title: "Statistik Bulanan",
        description:
          "Di bawah kartu clock-in terdapat section 'Statistik Bulanan' menampilkan ringkasan kehadiran bulan berjalan: total hari hadir, hari terlambat, total jam kerja, dan rata-rata jam per hari.",
      },
      {
        title: "Riwayat Bulan Ini",
        description:
          "Tabel 'Riwayat Bulan Ini' menampilkan catatan harian: tanggal, waktu clock-in, waktu clock-out, durasi kerja, lokasi, dan status (Hadir/Terlambat). Data otomatis terisi setiap hari Anda melakukan absensi.",
      },
      {
        title: "Kehadiran Tim Hari Ini",
        description:
          "Di kolom kanan (atau bawah di mobile) terdapat daftar 'Tim Hari Ini' yang menampilkan siapa saja rekan kerja yang sudah clock-in, beserta waktu dan lokasi mereka.",
      },
    ],
    status: "active",
  },

  leave: {
    purpose:
      "Cuti & Izin untuk mengajukan, melacak, dan mengelola cuti karyawan. Menampilkan saldo cuti tahunan (progress bar), 4 kartu statistik (Menunggu, Disetujui, Ditolak, Total Hari Disetujui), info siapa yang sedang cuti hari ini, daftar cuti mendatang, dan tab pengajuan/review.",
    flow: [
      "Klik menu 'Pengajuan Cuti' di sidebar kiri",
      "Halaman 'Cuti & Izin' terbuka dengan saldo cuti dan 4 kartu statistik",
      "Klik tombol 'Ajukan Cuti' di pojok kanan atas untuk membuat pengajuan baru",
      "Isi form: jenis cuti, tanggal mulai/selesai, alasan",
      "Kirim pengajuan dan pantau status di tab 'Pengajuan Saya'",
    ],
    steps: [
      {
        title: "Saldo Cuti Tahunan",
        description:
          "Kartu besar di kiri atas menampilkan 'Saldo cuti tahunan [tahun]'. Menunjukkan sisa hari dari kuota (contoh: '8 / 12 hari') dengan progress bar visual dan badge jumlah yang terpakai. Progress bar terisi sesuai persentase cuti yang sudah digunakan.",
      },
      {
        title: "Kartu Statistik",
        description:
          "4 kartu di kanan menampilkan: 'Menunggu' (pengajuan pending, ikon jam kuning), 'Disetujui' (pengajuan disetujui, ikon centang hijau), 'Ditolak' (pengajuan ditolak, ikon X merah), dan 'Total Hari Disetujui' (total hari cuti disetujui semua jenis, ikon briefcase biru).",
      },
      {
        title: "Siapa Sedang Cuti Hari Ini",
        description:
          "Kartu 'Sedang Cuti Hari Ini' menampilkan daftar rekan kerja yang sedang cuti beserta jenis dan periode cuti mereka.",
      },
      {
        title: "Cuti Mendatang",
        description:
          "Kartu 'Cuti Mendatang' menampilkan daftar cuti yang sudah disetujui dan akan berlangsung dalam waktu dekat.",
      },
      {
        title: "Mengajukan Cuti",
        description:
          "Klik tombol 'Ajukan Cuti' di pojok kanan atas header. Dialog form terbuka: pilih 'Jenis Cuti' (Tahunan, Sakit, Izin, dll.), tentukan 'Tanggal Mulai' dan 'Tanggal Selesai', tulis 'Alasan'. Klik 'Kirim' untuk mengirim pengajuan.",
      },
      {
        title: "Tab 'Pengajuan Saya'",
        description:
          "Tab pertama menampilkan semua pengajuan cuti Anda. Setiap kartu menunjukkan jenis cuti, tanggal, alasan, dan status (Menunggu/Disetujui/Ditolak). Anda dapat membatalkan pengajuan yang masih 'Menunggu'.",
      },
      {
        title: "Tab 'Perlu Ditinjau' (Atasan/Admin)",
        description:
          "Tab kedua muncul untuk atasan dan admin. Menampilkan pengajuan bawahan yang perlu ditinjau. Badge merah di tab menunjukkan jumlah pending. Terdapat sub-tab: 'Menunggu', 'Disetujui', 'Ditolak'. Pada pengajuan 'Menunggu', klik 'Setujui' atau 'Tolak' untuk mengambil keputusan.",
      },
      {
        title: "Tab 'Saldo Cuti' (Admin)",
        description:
          "Tab ketiga hanya muncul untuk admin. Menampilkan rekap saldo cuti seluruh karyawan: kuota tahunan, terpakai, dan sisa. Admin dapat menyesuaikan kuota cuti.",
      },
    ],
    status: "active",
  },

  onboarding: {
    purpose:
      "Onboarding memandu karyawan baru melalui proses orientasi perusahaan. Terdapat 4 tab utama: 'Onboarding Saya' (checklist pribadi karyawan baru), 'Semua Onboarding' (daftar proses onboarding aktif), 'Template' (template checklist), dan 'Sumber Daya' (materi dan panduan). Dilengkapi 4 kartu statistik dan fitur check-in.",
    flow: [
      "Klik menu 'Onboarding' di sidebar kiri (ikon sparkles)",
      "Halaman terbuka dengan 4 kartu statistik: Proses Aktif, Selesai, Tingkat Penyelesaian, dan Tugas Tersisa",
      "Karyawan baru: lihat tab 'Onboarding Saya' untuk checklist tugas yang harus diselesaikan",
      "Admin: lihat tab 'Semua Onboarding' untuk memantau seluruh proses onboarding",
      "Admin: kelola tab 'Template' untuk membuat template checklist standar",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "4 kartu di bagian atas: 'Proses Aktif' (jumlah onboarding berjalan, ikon Users), 'Selesai' (onboarding yang sudah tuntas, ikon centang hijau), 'Tingkat Penyelesaian' (persentase rata-rata progres, ikon TrendingUp), dan 'Tugas Tersisa' (total tugas belum selesai, ikon LayoutList).",
      },
      {
        title: "Tab 'Onboarding Saya'",
        description:
          "Karyawan baru melihat checklist tugas yang harus diselesaikan: upload dokumen, ikuti pelatihan, selesaikan orientasi, dll. Setiap item memiliki checkbox — centang setelah selesai. Progress bar di atas menunjukkan persentase penyelesaian. Tugas dikelompokkan per fase dan kategori.",
      },
      {
        title: "Tab 'Semua Onboarding' (Admin)",
        description:
          "Menampilkan kartu untuk setiap karyawan yang sedang onboarding. Setiap kartu menunjukkan nama, departemen, tanggal mulai, progress bar, dan jumlah tugas selesai/total. Klik kartu untuk melihat detail checklist karyawan.",
      },
      {
        title: "Memulai Onboarding (Admin)",
        description:
          "Klik tombol 'Mulai Onboarding' di pojok kanan atas. Dialog muncul: pilih karyawan baru dari daftar, pilih template checklist, tentukan tanggal mulai. Klik 'Mulai' untuk mengaktifkan proses onboarding.",
      },
      {
        title: "Tab 'Template' (Admin)",
        description:
          "Kelola template checklist onboarding. Setiap template berisi daftar tugas dengan fase (Pre-boarding, Hari Pertama, Minggu Pertama, Bulan Pertama), kategori, dan penanggung jawab. Klik 'Buat Template' untuk membuat baru, ikon pensil untuk edit, ikon mata untuk show/hide, atau ikon tempat sampah untuk hapus.",
      },
      {
        title: "Tab 'Sumber Daya'",
        description:
          "Koleksi materi onboarding: dokumen kebijakan, video pelatihan, panduan kerja, dan link penting. Admin dapat menambah dan mengelola sumber daya ini.",
      },
      {
        title: "Tab 'Check-in'",
        description:
          "Pantau pertemuan check-in antara mentor/atasan dan karyawan baru. Catat diskusi, feedback, dan action items dari setiap sesi check-in.",
      },
    ],
    status: "active",
  },

  offboarding: {
    purpose:
      "Offboarding & Exit mengelola proses pengunduran diri dan penghentian karyawan. Terdapat multiple tab: 'Kasus Saya' (status offboarding pribadi), 'Semua Kasus' (semua proses aktif), 'Template' (template checklist), 'Analitik' (grafik turnover), dan 'Exit Interview'. Dilengkapi kartu statistik, pencarian, dan form pengajuan resign.",
    flow: [
      "Klik menu 'Offboarding' di sidebar kiri (ikon pintu keluar)",
      "Halaman terbuka dengan kartu statistik: Aktif, Selesai, Menunggu Review, Rata-rata Durasi",
      "Karyawan: klik 'Ajukan Pengunduran Diri' jika ingin resign",
      "Admin: kelola semua kasus offboarding di tab 'Semua Kasus'",
      "Admin: review pengajuan resign dan kelola checklist pengembalian aset",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "Di bagian atas: kartu menampilkan jumlah kasus offboarding Aktif, Selesai, Menunggu Review, dan Rata-rata Durasi proses. Grafik batang di tab Analitik menunjukkan tren turnover per bulan.",
      },
      {
        title: "Mengajukan Pengunduran Diri",
        description:
          "Klik tombol 'Ajukan Pengunduran Diri' di header. Dialog form terbuka: pilih 'Jenis Keluar' (Resign/Pensiun/PHK/dll), tentukan 'Tanggal Efektif', pilih 'Kategori Alasan', tulis alasan detail. Klik 'Kirim' untuk mengirim pengajuan ke atasan.",
      },
      {
        title: "Tab 'Kasus Saya'",
        description:
          "Menampilkan status proses offboarding Anda jika ada: progres checklist pengembalian aset, handover tugas, exit interview, dan timeline. Progress bar menunjukkan persentase tugas selesai.",
      },
      {
        title: "Tab 'Semua Kasus' (Admin)",
        description:
          "Kolom pencarian 'Cari karyawan...' di atas. Daftar semua kasus offboarding ditampilkan: nama karyawan, avatar, jenis keluar, tanggal, status (badge warna: Menunggu/Aktif/Selesai/Ditolak), dan progress bar. Klik kartu untuk membuka detail lengkap.",
      },
      {
        title: "Review Pengajuan (Admin)",
        description:
          "Admin membuka pengajuan resign. Dialog review muncul: lihat detail pengajuan, tulis catatan, lalu klik 'Setujui' atau 'Tolak'. Jika disetujui, sistem otomatis membuat checklist offboarding dari template.",
      },
      {
        title: "Tab 'Template' (Admin)",
        description:
          "Kelola template checklist offboarding. Setiap template berisi tugas: pengembalian laptop, kartu akses, handover password, serah terima dokumen, dll. Klik 'Buat Template' untuk membuat baru, ikon pensil untuk edit, ikon mata untuk show/hide, ikon tempat sampah untuk hapus.",
      },
      {
        title: "Exit Interview",
        description:
          "Tab atau dialog 'Exit Interview': karyawan mengisi form feedback akhir tentang pengalaman kerja, alasan keluar, saran untuk perusahaan. Data anonim dan digunakan untuk analisis retention.",
      },
      {
        title: "Tab 'Analitik'",
        description:
          "Grafik batang turnover per bulan dengan breakdown per kategori alasan. Membantu HR mengidentifikasi pola dan area yang perlu diperbaiki.",
      },
    ],
    status: "active",
  },

  // ── Talent Acquisition ──
  recruitment: {
    purpose:
      "Rekrutmen & ATS (Applicant Tracking System) untuk mengelola lowongan, lamaran, dan proses seleksi kandidat. Terdapat 3 tab utama: 'Lowongan' (daftar posisi terbuka), 'Kandidat' (pipeline pelamar), dan 'Jadwal Interview'. Dilengkapi kartu statistik dan panel detail.",
    flow: [
      "Klik menu 'Rekrutmen' di sidebar kiri (ikon tas kerja)",
      "Halaman terbuka dengan 4 kartu statistik: Lowongan Aktif, Total Kandidat, Interview Minggu Ini, dan Ditawarkan",
      "Klik tab 'Lowongan' untuk melihat daftar posisi terbuka",
      "Klik lowongan untuk melihat detail: deskripsi, persyaratan, dan daftar kandidat",
      "Klik tab 'Kandidat' untuk melihat pipeline seluruh kandidat",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "4 kartu di bagian atas: 'Lowongan Aktif' (ikon dashboard), 'Total Kandidat' (ikon orang-orang), 'Interview Minggu Ini' (ikon kalender), dan 'Ditawarkan' (ikon activity). Data terupdate otomatis.",
      },
      {
        title: "Tab 'Lowongan'",
        description:
          "Daftar semua posisi lowongan. Setiap kartu menampilkan judul posisi, departemen, lokasi, status (Aktif/Draft/Ditutup), dan jumlah pelamar. Klik kartu untuk membuka panel detail di sisi kanan: deskripsi lengkap, persyaratan, gaji, dan daftar kandidat yang melamar.",
      },
      {
        title: "Membuat Lowongan (Admin)",
        description:
          "Klik tombol 'Buat Lowongan' di header. Form terbuka: isi judul posisi, departemen, lokasi, jenis kontrak, rentang gaji, deskripsi, dan persyaratan. Klik 'Publikasi' untuk langsung mempublikasikan atau 'Simpan Draft'.",
      },
      {
        title: "Tab 'Kandidat'",
        description:
          "Pipeline seluruh kandidat dari semua lowongan. Setiap kartu menampilkan nama, posisi yang dilamar, tahap seleksi (Applied/Screening/Interview/Offered/Rejected), dan rating. Klik kandidat untuk melihat detail: CV, catatan interview, dan skor.",
      },
      {
        title: "Tab 'Jadwal Interview'",
        description:
          "Daftar interview yang dijadwalkan. Menampilkan nama kandidat, posisi, tanggal dan jam, interviewer, dan lokasi/link meeting. Admin bisa menambah dan mengelola jadwal.",
      },
      {
        title: "Panel Detail Kandidat",
        description:
          "Klik kandidat untuk membuka panel detail: informasi personal, CV/resume, tahap seleksi saat ini, catatan recruiter, skor interview, dan tombol untuk memindahkan ke tahap berikutnya (Screening → Interview → Offer → Hire).",
      },
    ],
    status: "active",
  },

  jobs: {
    purpose: "Lowongan Internal untuk menampilkan dan melamar posisi yang tersedia di internal perusahaan. Karyawan dapat melihat posisi terbuka dan melamar langsung dari dalam aplikasi.",
    flow: [
      "Klik menu 'Lowongan Internal' di sidebar kiri",
      "Daftar lowongan internal ditampilkan dengan filter departemen dan jabatan",
      "Klik lowongan yang diminati untuk melihat deskripsi dan persyaratan",
      "Klik tombol 'Lamar' lalu lengkapi form lamaran",
      "Pantau status lamaran Anda di tab 'Lamaran Saya'",
    ],
    steps: [
      { title: "Melihat Lowongan", description: "Daftar lowongan ditampilkan dalam kartu. Gunakan filter departemen dan jabatan di bagian atas untuk mempersempit pencarian. Setiap kartu menampilkan judul posisi, departemen, lokasi, dan tenggat lamaran." },
      { title: "Detail Lowongan", description: "Klik kartu lowongan untuk membuka detail: deskripsi posisi, kualifikasi yang dibutuhkan, benefit, dan informasi lainnya." },
      { title: "Melamar Posisi", description: "Klik tombol 'Lamar' di halaman detail. Form lamaran terbuka: lengkapi motivasi, upload CV jika diminta, dan klik 'Kirim Lamaran'." },
      { title: "Status Lamaran", description: "Buka tab 'Lamaran Saya' untuk melihat daftar semua lamaran beserta status: Dikirim, Ditinjau, Interview, Diterima, atau Ditolak." },
    ],
    status: "active",
  },

  talent: {
    purpose: "Talent Management untuk mengidentifikasi, mengembangkan, dan mempertahankan talenta terbaik perusahaan. Menampilkan talent pool, program pengembangan, dan monitoring capaian.",
    flow: [
      "Klik menu 'Talent Management' di sidebar kiri",
      "Lihat daftar karyawan berpotensi tinggi di talent pool",
      "Klik nama karyawan untuk melihat profil kompetensi dan penilaian",
      "Admin: buat dan tetapkan program pengembangan individual",
      "Monitor kemajuan dan capaian setiap talent secara berkala",
    ],
    steps: [
      { title: "Talent Pool", description: "Daftar karyawan berpotensi tinggi dengan badge rating, kompetensi utama, dan departemen. Gunakan filter dan pencarian untuk menemukan talent tertentu." },
      { title: "Profil Talent", description: "Klik nama untuk melihat detail: riwayat penilaian, kompetensi yang dimiliki, program pengembangan yang diikuti, dan catatan atasan." },
      { title: "Program Pengembangan", description: "Admin klik 'Buat Program' untuk menetapkan program pengembangan: target kompetensi, aktivitas, timeline, dan mentor. Klik 'Simpan' untuk mengaktifkan." },
      { title: "Monitoring & Evaluasi", description: "Tab monitoring menampilkan kemajuan setiap talent: persentase program selesai, skill yang berkembang, dan rekomendasi langkah selanjutnya." },
    ],
    status: "active",
  },

  grading: {
    purpose: "Grading & Job Evaluation untuk menetapkan dan mengelola tingkatan jabatan (grade) dan evaluasi pekerjaan. Menampilkan matriks grading, level kompensasi, dan form evaluasi jabatan.",
    flow: [
      "Klik menu 'Grading' di sidebar kiri",
      "Halaman menampilkan matriks grading dengan level dan kompensasi",
      "Klik level grade untuk melihat detail: deskripsi, kompetensi, dan jabatan terkait",
      "Admin: gunakan form evaluasi untuk menilai bobot setiap jabatan",
      "Tetapkan grade karyawan berdasarkan hasil evaluasi",
    ],
    steps: [
      { title: "Matriks Grading", description: "Tabel matriks menampilkan semua level grade (G1 sampai GN) dengan kolom: level, deskripsi, rentang gaji, dan jumlah karyawan. Klik baris untuk detail." },
      { title: "Detail Grade", description: "Klik level untuk melihat: deskripsi detail, kompetensi yang dibutuhkan, benefit, dan daftar jabatan yang termasuk dalam grade ini." },
      { title: "Evaluasi Jabatan (Admin)", description: "Klik 'Evaluasi Jabatan' untuk membuka form: pilih jabatan, beri skor per faktor (tanggung jawab, kompleksitas, dampak, dll.), sistem menghitung grade yang sesuai." },
      { title: "Penetapan Grade", description: "Admin menetapkan grade karyawan berdasarkan hasil evaluasi. Perubahan grade dicatat dalam riwayat." },
    ],
    status: "active",
  },

  career_path: {
    purpose: "Jenjang Karier Saya menampilkan jalur karier yang Anda ikuti beserta level saat ini dan berikutnya, training wajib, serta progres yang dihitung otomatis dari training dan KPI. Tersedia pula katalog jenjang yang dapat dijelajahi.",
    flow: [
      "Klik menu 'Jenjang Karier Saya' di grup Ruang Saya pada sidebar kiri",
      "Tab 'Jenjang Saya' menampilkan jenjang yang ditugaskan kepada Anda",
      "Lihat level saat ini, level target, dan progres Anda",
      "Buka tab 'Katalog Jenjang' untuk menjelajahi jalur karier yang tersedia",
      "Klik sebuah jenjang untuk melihat detail level dan persyaratannya",
    ],
    steps: [
      { title: "Jenjang Saya", description: "Kartu jenjang yang ditugaskan kepada Anda: menampilkan level sekarang, target, status kesiapan, dan progres dari training & KPI." },
      { title: "Katalog Jenjang", description: "Jelajahi semua jenjang karier yang dipublikasikan. Gunakan pencarian dan filter track/departemen untuk menemukan jalur yang relevan." },
      { title: "Detail Jenjang", description: "Klik sebuah jenjang untuk melihat semua level, persyaratan kompetensi, training wajib, dan estimasi waktu kenaikan." },
    ],
    status: "active",
  },

  career_planning: {
    purpose: "Perencanaan Karier adalah ruang kerja HR/administrator untuk merancang dan mengelola jalur karier organisasi: membuat jenjang, mengatur level & persyaratan, menugaskan karyawan, dan memproses promosi. Terintegrasi dengan training dan KPI.",
    flow: [
      "Klik menu 'Perencanaan Karier' di grup Manajemen SDM pada sidebar kiri",
      "Lihat kartu statistik: total jenjang, jenjang aktif, total penugasan",
      "Klik 'Buat Jenjang' untuk membuat jalur karier baru",
      "Buka sebuah jenjang untuk menambah level dan persyaratannya",
      "Tugaskan karyawan ke level tertentu dan proses promosi bila memenuhi syarat",
    ],
    steps: [
      { title: "Kelola Jenjang", description: "Buat, edit, publikasikan, atau sembunyikan jalur karier. Gunakan pencarian dan filter untuk menemukan jenjang yang ingin dikelola." },
      { title: "Atur Level", description: "Pada detail jenjang, tambahkan level bertingkat beserta persyaratan kompetensi, training wajib, dan target jabatan." },
      { title: "Tugaskan Karyawan", description: "Tetapkan karyawan ke jenjang dan level. Progres mereka dihitung otomatis dari penyelesaian training dan pencapaian KPI." },
      { title: "Promosi", description: "Ketika karyawan memenuhi syarat, promosikan mereka ke level berikutnya. Sistem mengirim notifikasi otomatis." },
    ],
    status: "active",
  },

  // ── Learning & Development ──
  training: {
    purpose:
      "Pelatihan adalah pusat pembelajaran komprehensif perusahaan. Terdapat 13+ tab: Katalog (daftar kursus), Learning Path, Analitik, Gamifikasi, Leaderboard, Rekomendasi AI, Skill Gap, Pelatihan Eksternal, Anggaran, Microlearning, Flashcards, ROI, dan Karier. Dilengkapi pencarian, filter, dan kartu statistik.",
    flow: [
      "Klik menu 'Pelatihan' di sidebar kiri (ikon topi wisuda)",
      "Halaman terbuka dengan kartu statistik: Kursus Tersedia, Sedang Diikuti, Selesai, Sertifikat",
      "Gunakan pencarian dan filter kategori untuk menemukan kursus di tab 'Katalog'",
      "Klik kartu kursus untuk melihat detail dan mendaftar",
      "Tab lain menyediakan learning path, analytics, gamifikasi, dan fitur lanjutan",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "4 kartu di atas: 'Kursus Tersedia' (ikon buku), 'Sedang Diikuti' (ikon jam), 'Selesai' (ikon centang), dan 'Sertifikat' (ikon penghargaan). Menampilkan progress belajar Anda.",
      },
      {
        title: "Tab 'Katalog'",
        description:
          "Daftar semua kursus tersedia dalam grid kartu. Setiap kartu menampilkan judul, kategori, durasi, level, dan status (Baru/Aktif/Selesai). Kolom pencarian 'Cari pelatihan...' dan dropdown filter kategori di atas. Klik kartu untuk detail dan pendaftaran.",
      },
      {
        title: "Membuat Kursus (Admin)",
        description:
          "Admin klik tombol 'Buat Kursus' (ikon +). Dialog form terbuka: isi judul, kategori, level (Beginner/Intermediate/Advanced), durasi, deskripsi, modul, dan jadwal. Tersedia juga 'AI Course Builder' untuk membuat kursus otomatis dengan AI.",
      },
      {
        title: "Tab 'Learning Path'",
        description:
          "Jalur pembelajaran terstruktur yang terdiri dari beberapa kursus berurutan. Admin bisa membuat learning path baru. Karyawan mengikuti path sesuai posisi atau minat.",
      },
      {
        title: "Tab 'Analitik'",
        description:
          "Dashboard statistik pelatihan: grafik partisipasi, tingkat penyelesaian, kursus paling populer, dan tren belajar per periode.",
      },
      {
        title: "Tab 'Gamifikasi'",
        description:
          "Sistem poin dan badge untuk memotivasi pembelajaran. Lihat poin yang dikumpulkan, badge yang didapat, dan tantangan aktif.",
      },
      {
        title: "Tab 'Leaderboard'",
        description:
          "Papan peringkat karyawan berdasarkan poin pembelajaran. Lihat posisi Anda dibandingkan rekan kerja.",
      },
      {
        title: "Tab 'Rekomendasi AI'",
        description:
          "Rekomendasi kursus berbasis AI berdasarkan jabatan, skill gap, dan riwayat belajar Anda. Klik 'Daftar' untuk langsung mengikuti kursus yang direkomendasikan.",
      },
      {
        title: "Tab 'Skill Gap'",
        description:
          "Analisis gap keahlian: bandingkan skill yang Anda miliki dengan yang dibutuhkan posisi Anda. Sistem menyarankan pelatihan untuk menutup gap.",
      },
      {
        title: "Tab 'Pelatihan Eksternal'",
        description:
          "Daftar pelatihan dari penyedia eksternal: seminar, workshop, sertifikasi luar. Karyawan bisa mengajukan keikutsertaan. Admin mengelola daftar pelatihan eksternal.",
      },
    ],
    status: "active",
  },

  mentorship: {
    purpose: "Mentorship untuk menghubungkan mentor dan mentee dalam program bimbingan profesional. Menampilkan daftar mentor tersedia, sesi mentoring terjadwal, dan evaluasi program.",
    flow: [
      "Klik menu 'Mentorship' di sidebar kiri",
      "Lihat daftar mentor yang tersedia dengan keahlian dan pengalaman mereka",
      "Klik 'Ajukan Mentoring' untuk mengirim permintaan ke mentor pilihan",
      "Jadwalkan sesi mentoring dan catat diskusi serta action items",
      "Berikan feedback setelah sesi dan evaluasi kemajuan program",
    ],
    steps: [
      { title: "Menemukan Mentor", description: "Halaman menampilkan daftar mentor yang tersedia. Setiap kartu menunjukkan foto, nama, jabatan, departemen, keahlian utama, dan jumlah mentee aktif. Gunakan pencarian dan filter keahlian untuk menemukan mentor yang sesuai." },
      { title: "Mengajukan Mentoring", description: "Klik 'Ajukan Mentoring' pada kartu mentor. Dialog terbuka: tulis tujuan mentoring, topik yang ingin dibahas, dan jadwal yang diinginkan. Klik 'Kirim Permintaan'. Mentor akan menerima notifikasi." },
      { title: "Sesi Mentoring", description: "Setelah permintaan disetujui, jadwalkan sesi di tab 'Sesi Saya'. Setiap sesi mencatat: tanggal, durasi, topik diskusi, catatan, dan action items yang disepakati." },
      { title: "Evaluasi & Feedback", description: "Setelah setiap sesi, isi form feedback: rating sesi (1-5), catatan kemajuan, dan area yang perlu difokuskan selanjutnya. Mentor dan mentee saling memberikan feedback." },
    ],
    status: "active",
  },

  // ── Performance Management ──
  performance: {
    purpose:
      "Penilaian Kinerja untuk mengevaluasi performa karyawan secara berkala. Terdapat tab 'Penilaian Saya' (daftar review yang diterima), 'Buat Penilaian' (untuk atasan), dan 'Riwayat'. Dilengkapi kartu statistik dan detail rating per kompetensi.",
    flow: [
      "Klik menu 'Penilaian Kinerja' di sidebar kiri (ikon target)",
      "Halaman terbuka dengan 4 kartu statistik: Total Penilaian, Rata-rata Rating, Penilaian Tertinggi, dan Pending",
      "Tab 'Penilaian Saya': lihat semua penilaian yang diberikan atasan kepada Anda",
      "Atasan/Admin: klik 'Buat Penilaian' untuk mengevaluasi bawahan",
      "Klik kartu penilaian untuk melihat detail rating dan komentar",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "4 kartu di atas: 'Total Penilaian' (ikon target), 'Rata-rata Rating' (ikon bintang), 'Penilaian Tertinggi' (ikon clipboard centang), dan 'Menunggu Review' (ikon grafik). Angka rating ditampilkan dengan label (Sangat Baik/Baik/Cukup/Perlu Perbaikan) dan warna.",
      },
      {
        title: "Tab 'Penilaian Saya'",
        description:
          "Daftar semua penilaian kinerja yang Anda terima. Setiap kartu menampilkan: nama penilai, periode penilaian, rating keseluruhan (dengan label dan warna), status (Draft/Submitted/Acknowledged), dan tanggal. Klik kartu untuk detail lengkap.",
      },
      {
        title: "Detail Penilaian",
        description:
          "Klik kartu untuk melihat: rating per kompetensi (Leadership, Teamwork, Communication, dll.), komentar atasan, strength areas, area of improvement, dan action plan yang disepakati.",
      },
      {
        title: "Membuat Penilaian (Atasan/Admin)",
        description:
          "Klik 'Buat Penilaian' di header. Dialog form terbuka: pilih karyawan yang dinilai, periode penilaian, beri rating per kompetensi (skala 1-5), tulis komentar dan rekomendasi. Klik 'Kirim' untuk mengirim atau 'Simpan Draft' untuk menyimpan.",
      },
      {
        title: "Tab 'Perlu Ditinjau' (Atasan)",
        description:
          "Menampilkan penilaian bawahan yang menunggu persetujuan Anda. Badge merah menunjukkan jumlah pending. Sub-tab filter: Menunggu, Disetujui, Ditolak.",
      },
      {
        title: "Tab 'Riwayat'",
        description:
          "Arsip seluruh penilaian kinerja dari periode-periode sebelumnya. Gunakan untuk membandingkan tren performa dari waktu ke waktu.",
      },
    ],
    status: "active",
  },

  okr: {
    purpose:
      "OKR & Goals untuk menetapkan, melacak, dan mengevaluasi Objectives and Key Results. Terdapat 3 tab: 'OKR Saya' (objectives pribadi), 'Tim' (objectives tim), dan 'Perusahaan' (objectives organisasi). Dilengkapi kartu statistik, filter periode, pencarian, dan panel check-in terbaru.",
    flow: [
      "Klik menu 'OKR & Goals' di sidebar kiri (ikon goal/target)",
      "Halaman terbuka dengan 4 kartu statistik: Total Objectives, Rata-rata Progress, On Track, dan At Risk",
      "Gunakan dropdown periode (Q1/Q2/Q3/Q4 + tahun) untuk memfilter",
      "Tab 'OKR Saya': lihat dan kelola objectives pribadi Anda",
      "Klik tombol 'Buat Objective' untuk menambah objective baru",
    ],
    steps: [
      {
        title: "Kartu Statistik",
        description:
          "4 kartu: 'Total Objectives' (ikon goal), 'Rata-rata Progress' (ikon TrendingUp), 'On Track' (ikon centang hijau), dan 'At Risk' (ikon peringatan kuning). Menampilkan ringkasan OKR periode aktif.",
      },
      {
        title: "Filter Periode & Scope",
        description:
          "Dropdown di atas: pilih periode (Q1 2026, Q2 2026, dll.) dan scope (Pribadi/Tim/Departemen/Perusahaan). Kolom pencarian 'Cari objective...' untuk memfilter berdasarkan judul.",
      },
      {
        title: "Tab 'OKR Saya'",
        description:
          "Daftar objectives pribadi Anda. Setiap kartu menampilkan: judul objective, scope, progress bar keseluruhan, daftar Key Results dengan progress masing-masing, dan status (On Track/At Risk/Behind). Klik untuk expand dan melihat detail.",
      },
      {
        title: "Membuat Objective",
        description:
          "Klik tombol 'Buat Objective' (ikon +) di header. Dialog form: isi judul objective, pilih scope (Personal/Team/Department/Company), tentukan periode, dan tambahkan 2-5 Key Results dengan metrik target. Klik 'Simpan'.",
      },
      {
        title: "Update Progress Key Result",
        description:
          "Pada setiap Key Result, klik untuk membuka editor progress. Masukkan nilai terbaru, tulis catatan check-in, dan klik 'Update'. Progress bar objective otomatis dihitung dari rata-rata Key Results.",
      },
      {
        title: "Tab 'Tim' dan 'Perusahaan'",
        description:
          "Tab 'Tim' menampilkan objectives seluruh anggota tim Anda. Tab 'Perusahaan' menampilkan objectives level organisasi. Admin dapat melihat semua objectives dari seluruh karyawan.",
      },
      {
        title: "Panel Check-in Terbaru",
        description:
          "Panel di sisi kanan (atau bawah di mobile) menampilkan aktivitas check-in terbaru: siapa yang update progress, kapan, dan catatan apa yang ditambahkan.",
      },
    ],
    status: "active",
  },

  feedback360: {
    purpose: "Feedback 360° untuk mengumpulkan umpan balik dari berbagai pihak: atasan, rekan kerja, dan bawahan. Menampilkan siklus feedback, form penilaian multi-perspektif, dan ringkasan hasil dalam grafik radar.",
    flow: [
      "Klik menu 'Feedback 360°' di sidebar kiri",
      "Lihat siklus feedback yang aktif di dashboard utama",
      "Jika Anda diminta memberi feedback, klik 'Isi Feedback' pada nama karyawan",
      "Lengkapi form penilaian berdasarkan kriteria yang ditentukan",
      "Setelah siklus selesai, lihat ringkasan hasil dalam grafik radar",
    ],
    steps: [
      { title: "Dashboard Feedback", description: "Halaman utama menampilkan siklus feedback aktif, statistik (jumlah feedback diberikan/diterima/pending), dan daftar karyawan yang perlu Anda beri feedback. Badge merah menunjukkan jumlah feedback yang belum diisi." },
      { title: "Mengisi Feedback", description: "Klik 'Isi Feedback' pada nama karyawan. Form terbuka: beri rating per kriteria (Leadership, Communication, Teamwork, dll.) dalam skala 1-5, tulis komentar terbuka untuk strengths dan areas for improvement. Klik 'Kirim'. Jawaban Anda bersifat anonim." },
      { title: "Mengelola Siklus (Admin)", description: "Admin klik 'Buat Siklus Baru'. Pilih karyawan yang akan di-review, tentukan responden (atasan, rekan, bawahan), tetapkan deadline, dan pilih kriteria penilaian. Klik 'Aktifkan' untuk memulai." },
      { title: "Hasil Feedback", description: "Setelah siklus selesai, klik 'Lihat Hasil'. Grafik radar menampilkan skor rata-rata per kriteria dari perspektif berbeda (Self, Manager, Peer, Direct Report). Tabel detail menunjukkan skor, komentar, dan perbandingan dengan rata-rata." },
      { title: "Tren & Perbandingan", description: "Jika ada siklus sebelumnya, grafik tren menunjukkan perkembangan skor dari waktu ke waktu. Bandingkan hasil antar periode untuk melihat perbaikan." },
    ],
    status: "active",
  },

  engagement: {
    purpose: "Survei Engagement untuk mengukur tingkat keterlibatan dan kepuasan karyawan. Admin membuat survei, karyawan mengisi secara anonim, dan dashboard menampilkan analisis hasil per kategori.",
    flow: [
      "Klik menu 'Survei Engagement' di sidebar kiri",
      "Jika ada survei aktif, klik 'Isi Survei' untuk berpartisipasi",
      "Jawab semua pertanyaan dengan jujur (anonim)",
      "Admin: lihat dashboard engagement dengan skor per kategori",
      "Buat action plan berdasarkan area yang perlu diperbaiki",
    ],
    steps: [
      { title: "Survei Aktif", description: "Halaman menampilkan survei yang sedang aktif dengan deadline dan jumlah responden. Klik 'Isi Survei' untuk mulai. Indikator progress menunjukkan berapa persen pertanyaan sudah dijawab." },
      { title: "Mengisi Survei", description: "Jawab setiap pertanyaan: pilih rating (Sangat Setuju/Setuju/Netral/Tidak Setuju/Sangat Tidak Setuju) atau tulis jawaban terbuka. Jawaban Anda sepenuhnya anonim. Klik 'Kirim' setelah selesai." },
      { title: "Dashboard Hasil (Admin)", description: "Dashboard menampilkan: skor engagement keseluruhan, grafik batang per kategori (Work-Life Balance, Career Growth, Management, Culture, dll.), tren dari periode sebelumnya, dan response rate." },
      { title: "Detail per Kategori", description: "Klik kategori untuk drill-down: lihat skor per pertanyaan, distribusi jawaban, dan komentar terbuka. Identifikasi area yang paling perlu perhatian." },
      { title: "Action Plan", description: "Berdasarkan hasil, admin membuat action plan: tetapkan PIC, deadline, dan action items untuk meningkatkan engagement. Pantau progres di tab 'Action Plan'." },
    ],
    status: "active",
  },

  pulse: {
    purpose: "Pulse Survey untuk mengukur sentimen karyawan secara cepat dan rutin (mingguan/bulanan). Hanya 1-3 pertanyaan singkat per survei. Dashboard menampilkan tren sentimen dari waktu ke waktu.",
    flow: [
      "Klik menu 'Pulse Survey' di sidebar kiri",
      "Jika ada pulse aktif, jawab 1-3 pertanyaan singkat",
      "Lihat grafik tren sentimen di dashboard",
      "Admin: buat dan jadwalkan pulse survey baru",
      "Identifikasi area yang memerlukan perhatian berdasarkan tren",
    ],
    steps: [
      { title: "Menjawab Pulse", description: "Pulse survey muncul di halaman utama. Jawab 1-3 pertanyaan singkat (rating atau pilihan). Biasanya memakan waktu kurang dari 1 menit. Klik 'Kirim'. Jawaban bersifat anonim." },
      { title: "Dashboard Tren", description: "Grafik garis menampilkan tren skor sentimen karyawan dari waktu ke waktu: mingguan atau bulanan. Hover pada titik grafik untuk melihat skor dan jumlah responden." },
      { title: "Membuat Pulse (Admin)", description: "Klik 'Buat Pulse Baru'. Isi: judul, 1-3 pertanyaan, jenis jawaban (rating/pilihan/teks), frekuensi pengulangan (sekali/mingguan/bulanan), dan target audiens. Klik 'Aktifkan'." },
      { title: "Insights & Alerts", description: "Sistem otomatis mendeteksi penurunan sentimen signifikan dan menampilkan alert. Admin dapat melihat breakdown per departemen dan mengambil tindakan cepat." },
    ],
    status: "active",
  },

  // ── HRIS & Analytics ──
  reports: {
    purpose: "Laporan HR untuk menghasilkan dan mengunduh laporan SDM. Tersedia berbagai jenis laporan: absensi, cuti, turnover, demografi, headcount, dan laporan kustom. Filter berdasarkan periode, departemen, dan kriteria lainnya.",
    flow: [
      "Klik menu 'Laporan HR' di sidebar kiri",
      "Pilih jenis laporan dari daftar template yang tersedia",
      "Tentukan periode dan filter tambahan (departemen, lokasi, dll.)",
      "Klik 'Generate Laporan' untuk membuat laporan",
      "Unduh dalam format PDF atau Excel, atau bagikan via email",
    ],
    steps: [
      { title: "Memilih Jenis Laporan", description: "Halaman menampilkan grid template laporan: Absensi Bulanan, Rekap Cuti, Turnover Rate, Demografi Karyawan, Headcount Report, dan Laporan Kustom. Klik template untuk memulai." },
      { title: "Mengatur Filter", description: "Form filter terbuka: pilih 'Periode' (rentang tanggal), 'Departemen' (semua/spesifik), 'Lokasi', dan kriteria lain sesuai jenis laporan. Klik 'Generate' untuk membuat laporan." },
      { title: "Preview Laporan", description: "Laporan ditampilkan di layar dengan tabel data, grafik ringkasan, dan metrik kunci. Review sebelum mengunduh." },
      { title: "Mengunduh & Berbagi", description: "Klik 'Unduh PDF' untuk dokumen cetak atau 'Unduh Excel' untuk spreadsheet. Tombol 'Bagikan' memungkinkan pengiriman laporan via email ke stakeholder." },
      { title: "Laporan Kustom", description: "Pilih 'Laporan Kustom' untuk membuat laporan dengan field pilihan sendiri. Pilih kolom data, atur pengelompokan, dan tentukan visualisasi yang diinginkan." },
    ],
    status: "active",
  },

  analytics: {
    purpose: "Dashboard Analitik HR menampilkan visualisasi data SDM real-time: headcount, turnover, demografi, distribusi departemen, dan tren dari waktu ke waktu. Tersedia drill-down per departemen dan perbandingan antar periode.",
    flow: [
      "Klik menu 'Dashboard Analitik' di sidebar kiri",
      "Dashboard utama menampilkan metrik kunci dan grafik visual",
      "Gunakan filter periode dan departemen di bagian atas",
      "Klik grafik untuk drill-down ke level detail",
      "Bandingkan metrik antar periode menggunakan toggle perbandingan",
    ],
    steps: [
      { title: "Overview Dashboard", description: "Kartu metrik utama di atas: Total Karyawan, Turnover Rate, Rata-rata Masa Kerja, dan Rasio Gender. Grafik donut menampilkan distribusi per departemen. Grafik batang menunjukkan headcount per bulan." },
      { title: "Drill-Down", description: "Klik segmen grafik (misalnya departemen tertentu) untuk melihat detail: daftar karyawan, sub-metrik, dan tren spesifik departemen tersebut." },
      { title: "Filter & Perbandingan", description: "Dropdown filter di atas: pilih periode (bulan/kuartal/tahun) dan departemen. Toggle 'Bandingkan' untuk menampilkan data periode sebelumnya sebagai perbandingan." },
      { title: "Tren Waktu", description: "Grafik garis menampilkan tren metrik dari waktu ke waktu: headcount growth, turnover monthly, new hires vs exits. Hover untuk detail per titik data." },
      { title: "Ekspor Dashboard", description: "Klik 'Ekspor' untuk mengunduh dashboard sebagai PDF atau mengambil data mentah dalam format CSV." },
    ],
    status: "active",
  },

  // ═══════════════════════════════════════════════
  // KEUANGAN
  // ═══════════════════════════════════════════════
  payroll: {
    purpose: "Payroll & Gaji untuk melihat slip gaji, rincian komponen gaji (pokok, tunjangan, potongan), dan riwayat penggajian. Admin dapat mengelola data payroll dan mendistribusikan slip gaji.",
    flow: [
      "Klik menu 'Payroll & Gaji' di sidebar kiri",
      "Tab 'Slip Gaji Saya': lihat rincian gaji bulan berjalan",
      "Scroll ke bawah untuk melihat breakdown: gaji pokok, tunjangan, potongan, dan total bersih",
      "Tab 'Riwayat': akses slip gaji bulan-bulan sebelumnya",
      "Klik tombol 'Unduh PDF' untuk menyimpan slip gaji",
    ],
    steps: [
      { title: "Melihat Slip Gaji", description: "Tab 'Slip Gaji Saya' menampilkan slip gaji terbaru. Kartu utama menunjukkan: gaji bersih (take-home pay), tanggal pembayaran, dan periode gaji." },
      { title: "Rincian Komponen", description: "Tabel detail menampilkan breakdown: Gaji Pokok, Tunjangan (transport, makan, jabatan, dll.), Potongan (pajak, BPJS, pinjaman, dll.), dan Total Bersih. Setiap baris menunjukkan jumlah dan persentase." },
      { title: "Riwayat Gaji", description: "Tab 'Riwayat' menampilkan daftar slip gaji bulanan dari bulan-bulan sebelumnya. Klik bulan untuk melihat detail slip gaji. Grafik tren menunjukkan perkembangan gaji dari waktu ke waktu." },
      { title: "Mengunduh Slip Gaji", description: "Klik tombol 'Unduh PDF' pada setiap slip gaji untuk menyimpan dokumen resmi ke perangkat Anda. Format PDF sesuai standar perusahaan." },
      { title: "Kelola Payroll (Admin)", description: "Admin mengakses tab 'Kelola': upload data payroll, review sebelum distribusi, lalu klik 'Distribusikan' untuk mengirim slip gaji ke seluruh karyawan." },
    ],
    status: "active",
  },

  expenses: {
    purpose: "Reimbursement untuk mengajukan penggantian biaya operasional yang sudah dikeluarkan. Upload bukti pembayaran (struk/invoice), pantau status approval, dan lacak pencairan.",
    flow: [
      "Klik menu 'Reimbursement' di sidebar kiri",
      "Klik tombol 'Ajukan' di pojok kanan atas",
      "Pilih kategori, isi nominal, dan upload bukti pembayaran (struk/invoice)",
      "Kirim pengajuan dan tunggu persetujuan atasan",
      "Pantau status di tab 'Pengajuan Saya': Menunggu, Disetujui, Ditolak, atau Dicairkan",
    ],
    steps: [
      { title: "Mengajukan Klaim", description: "Klik 'Ajukan'. Form terbuka: pilih kategori (Transport, Makan, Akomodasi, Lainnya), isi nominal rupiah, tulis deskripsi pengeluaran, upload foto bukti (struk/invoice). Klik 'Kirim'." },
      { title: "Melacak Status", description: "Tab 'Pengajuan Saya' menampilkan semua klaim. Setiap kartu menunjukkan: tanggal, kategori, nominal, bukti, dan badge status — Menunggu (kuning), Disetujui (hijau), Ditolak (merah), Dicairkan (biru)." },
      { title: "Riwayat Klaim", description: "Scroll ke bawah atau buka tab 'Riwayat' untuk melihat semua klaim sebelumnya. Ringkasan total klaim disetujui, ditolak, dan dicairkan ditampilkan di kartu statistik atas." },
      { title: "Review Klaim (Atasan/Admin)", description: "Atasan melihat tab 'Perlu Ditinjau'. Klik klaim untuk melihat detail dan bukti. Klik 'Setujui' atau 'Tolak' (isi alasan penolakan). Klaim yang disetujui diteruskan ke tim keuangan." },
    ],
    status: "active",
  },

  fund_requests: {
    purpose: "Pengajuan Dana Terpadu untuk mengajukan berbagai jenis kebutuhan keuangan: operasional, proyek, investasi, darurat, perjalanan dinas, pelatihan, peralatan, dan event. Form multi-langkah dengan preview rantai persetujuan, approval berjenjang otomatis, revisi, SLA tracking, dan delegasi otoritas.",
    flow: [
      "Klik menu 'Pengajuan Dana' di sidebar kiri",
      "Klik 'Buat Pengajuan Baru' di pojok kanan atas",
      "Langkah 1: Pilih jenis pengajuan (Operasional, Proyek, Investasi, dll.)",
      "Langkah 2: Isi detail sesuai jenis — rincian item, nominal, justifikasi, dan informasi khusus",
      "Langkah 3: Upload lampiran pendukung (opsional)",
      "Langkah 4: Preview rantai persetujuan yang akan dilalui, lalu kirim atau simpan draft",
      "Pantau status approval berjenjang, SLA deadline, dan revisi jika diminta",
    ],
    steps: [
      { title: "Memilih Jenis Pengajuan", description: "Di langkah pertama, pilih salah satu dari 8 jenis pengajuan: Operasional, Proyek, Investasi, Darurat, Perjalanan Dinas, Pelatihan & Pengembangan, Peralatan & Infrastruktur, atau Event & Kegiatan. Setiap jenis memiliki form detail yang berbeda sesuai kebutuhan." },
      { title: "Mengisi Detail Pengajuan", description: "Di langkah kedua, isi informasi utama: tujuan, nominal, rincian item (nama, jumlah, harga satuan), dan justifikasi. Form juga menampilkan field khusus sesuai jenis — misalnya untuk Proyek ada nama proyek dan timeline, untuk Perjalanan Dinas ada tujuan kota dan tanggal, untuk Pelatihan ada nama pelatihan dan jumlah peserta." },
      { title: "Upload Lampiran", description: "Di langkah ketiga, upload dokumen pendukung seperti proposal, quotation, invoice, atau bukti lainnya. Sistem menampilkan saran lampiran yang direkomendasikan sesuai jenis pengajuan. Langkah ini opsional namun sangat disarankan." },
      { title: "Preview Rantai Persetujuan", description: "Di langkah keempat, sistem menampilkan rantai persetujuan (approval chain) yang akan dilalui berdasarkan jenis pengajuan dan nominal. Lihat siapa saja approver di setiap level, termasuk delegasi jika ada. Klik 'Kirim' untuk langsung mengirim atau 'Simpan Draft' untuk menyimpan." },
      { title: "Approval Berjenjang", description: "Setelah dikirim, pengajuan otomatis diteruskan ke approver level pertama. Setiap level memiliki SLA deadline yang ditampilkan di detail pengajuan. Status berubah: Menunggu L1 → Menunggu L2 → ... → Disetujui. Badge SLA berwarna merah jika melewati batas waktu." },
      { title: "Revisi & Resubmit", description: "Jika approver meminta revisi, status berubah menjadi 'Perlu Revisi' dengan catatan alasan. Klik tombol 'Revisi & Kirim Ulang' di detail pengajuan untuk mengedit dan mengirim ulang. Pengajuan kembali ke level awal rantai persetujuan." },
      { title: "Filter & Pencarian", description: "Di halaman utama, gunakan tab filter status (Semua, Menunggu, Disetujui, Ditolak, Proses, Selesai, Perlu Revisi) dan kolom pencarian untuk menemukan pengajuan. Badge angka pada tab 'Menunggu' dan 'Perlu Revisi' menunjukkan jumlah yang perlu perhatian." },
      { title: "Detail & Timeline", description: "Klik kartu pengajuan untuk melihat detail lengkap: informasi pengajuan, rincian item, lampiran, rantai persetujuan dengan status per level, catatan reviewer, badge jenis pengajuan, SLA tracking, dan informasi delegasi jika berlaku." },
      { title: "Review Pengajuan (Approver)", description: "Approver melihat tab 'Review'. Klik pengajuan untuk melihat detail, lalu pilih 'Setujui', 'Tolak', atau 'Minta Revisi' dengan catatan alasan. Pengajuan otomatis diteruskan ke level berikutnya setelah disetujui." },
    ],
    status: "active",
  },

  travel: {
    purpose: "Perjalanan Dinas untuk mengajukan dan mengelola perjalanan dinas. Isi detail tujuan, jadwal, estimasi biaya (transport, akomodasi, uang saku), dan laporan setelah perjalanan.",
    flow: [
      "Klik menu 'Perjalanan Dinas' di sidebar kiri",
      "Klik 'Ajukan Perjalanan' di pojok kanan atas",
      "Isi form: tujuan, tanggal berangkat/pulang, transportasi, hotel, dan estimasi biaya",
      "Kirim dan tunggu persetujuan atasan",
      "Setelah kembali, isi laporan dan upload bukti pengeluaran",
    ],
    steps: [
      { title: "Mengajukan Perjalanan", description: "Klik 'Ajukan Perjalanan'. Form terbuka: isi tujuan kota/lokasi, tanggal berangkat dan pulang, pilih moda transportasi, isi nama hotel, dan perkiraan biaya per item." },
      { title: "Estimasi Biaya", description: "Sistem menghitung estimasi total berdasarkan kebijakan perusahaan: uang saku harian, batas hotel, transport, dan biaya lainnya. Review estimasi sebelum mengirim." },
      { title: "Approval", description: "Pengajuan dikirim ke atasan. Status: Menunggu → Disetujui → Dalam Perjalanan → Selesai. Atasan dapat menyetujui, meminta revisi, atau menolak." },
      { title: "Laporan Perjalanan", description: "Setelah kembali, buka pengajuan dan klik 'Isi Laporan'. Tulis ringkasan perjalanan, upload bukti pengeluaran (boarding pass, struk hotel, dll.), dan isi realisasi biaya. Klik 'Kirim Laporan'." },
    ],
    status: "active",
  },

  finance_dashboard: {
    purpose: "Dashboard Keuangan menampilkan ringkasan dan analitik keuangan perusahaan secara real-time. Terdapat kartu statistik (total pengajuan, disetujui, ditolak, dalam proses), grafik tren pengajuan per bulan, breakdown per kategori dan departemen, monitor SLA persetujuan, daftar pengajuan menunggu, dan feed aktivitas terbaru.",
    flow: [
      "Klik menu 'Dashboard Keuangan' di sidebar kiri (ikon grafik batang)",
      "Halaman terbuka dengan 4 kartu statistik: Total Pengajuan, Disetujui, Ditolak, Dalam Proses",
      "Scroll ke bawah untuk melihat grafik tren pengajuan bulanan (line chart dan bar chart)",
      "Lihat breakdown pengajuan per kategori (pie chart) dan per departemen",
      "Periksa monitor SLA untuk melihat persetujuan yang mendekati atau melewati deadline",
      "Lihat daftar pengajuan menunggu persetujuan dan aktivitas keuangan terbaru",
    ],
    steps: [
      { title: "Kartu Statistik", description: "4 kartu di bagian atas: 'Total Pengajuan' (jumlah semua pengajuan dana), 'Disetujui' (jumlah yang telah disetujui semua level), 'Ditolak' (jumlah yang ditolak), dan 'Dalam Proses' (jumlah yang sedang menunggu persetujuan). Setiap kartu menampilkan total nominal rupiah." },
      { title: "Grafik Tren Bulanan", description: "Dua grafik menampilkan tren 6 bulan terakhir: line chart untuk jumlah pengajuan per bulan, dan bar chart untuk total nominal per bulan. Hover pada titik grafik untuk melihat detail angka." },
      { title: "Breakdown Kategori", description: "Pie chart menampilkan distribusi pengajuan berdasarkan kategori (Operasional, Proyek, Investasi, Darurat, dll.). Klik segmen untuk melihat detail." },
      { title: "Breakdown Departemen", description: "Tabel menampilkan ringkasan pengajuan per departemen: jumlah pengajuan, total nominal, dan rata-rata waktu persetujuan. Urutkan kolom untuk analisis." },
      { title: "Monitor SLA", description: "Daftar pengajuan yang mendekati atau sudah melewati SLA deadline. Badge warna menunjukkan status: hijau (dalam batas), kuning (mendekati batas), merah (melewati batas). Klik untuk langsung menuju detail pengajuan." },
      { title: "Pengajuan Menunggu", description: "Daftar pengajuan yang sedang menunggu persetujuan Anda atau tim. Menampilkan: judul, pemohon, nominal, level approval saat ini, dan SLA deadline. Klik untuk langsung mereview." },
      { title: "Aktivitas Terbaru", description: "Feed kronologis aktivitas keuangan terbaru: pengajuan baru dibuat, disetujui, ditolak, atau diminta revisi. Setiap item menampilkan waktu, pelaku, dan aksi yang dilakukan." },
    ],
    status: "active",
  },

  finance_audit: {
    purpose: "Audit Trail & Pelaporan Keuangan mencatat seluruh aktivitas dan perubahan pada pengajuan dana secara lengkap dan transparan. Terdapat statistik audit, filter multi-kriteria, tabel log audit dengan detail aksi, timeline audit per pengajuan, dan ekspor data ke CSV.",
    flow: [
      "Klik menu 'Audit Trail' di sidebar kiri (ikon dokumen)",
      "Halaman terbuka dengan 4 kartu statistik: Total Log, Aksi Hari Ini, Pengguna Aktif, dan Tipe Aksi Unik",
      "Gunakan filter di atas tabel: rentang tanggal, tipe aksi, dan pencarian",
      "Tabel menampilkan semua log audit kronologis dengan detail aksi",
      "Klik pengajuan di halaman Pengajuan Dana untuk melihat timeline audit lengkap",
      "Klik tombol 'Export CSV' untuk mengunduh data audit",
    ],
    steps: [
      { title: "Kartu Statistik", description: "4 kartu di atas: 'Total Log' (jumlah seluruh catatan audit), 'Aksi Hari Ini' (jumlah aktivitas hari ini), 'Pengguna Aktif' (jumlah pengguna unik yang melakukan aksi), dan 'Tipe Aksi Unik' (jumlah jenis aksi berbeda yang tercatat)." },
      { title: "Filter Audit", description: "Di atas tabel terdapat 3 filter: 'Rentang Tanggal' (pilih tanggal mulai dan selesai), 'Tipe Aksi' (dropdown: Semua, Dibuat, Diperbarui, Status Berubah, Disetujui, Ditolak, Revisi Diminta, Dikirim Ulang, Dibatalkan), dan kolom 'Cari...' untuk pencarian berdasarkan nama pengguna atau detail aksi." },
      { title: "Tabel Log Audit", description: "Tabel menampilkan setiap log: tanggal & waktu, nama pengguna (pelaku), tipe aksi (badge warna), referensi pengajuan, dan detail perubahan. Data diurutkan dari yang terbaru. Scroll horizontal jika kolom terlalu banyak di layar kecil." },
      { title: "Timeline Audit per Pengajuan", description: "Di halaman detail setiap pengajuan dana, section 'Timeline Audit' menampilkan kronologi lengkap semua aktivitas pada pengajuan tersebut: siapa melakukan apa, kapan, dan detail perubahan. Tampilan timeline vertikal dengan ikon dan warna sesuai tipe aksi." },
      { title: "Export CSV", description: "Klik tombol 'Export CSV' di pojok kanan atas halaman. File CSV berisi seluruh data audit yang ditampilkan (sesuai filter aktif): tanggal, pengguna, aksi, referensi, dan detail. File otomatis terunduh dengan nama berisi tanggal." },
      { title: "Jenis Aksi yang Dicatat", description: "Sistem mencatat semua aksi penting: pembuatan pengajuan, perubahan data, perubahan status, persetujuan, penolakan, permintaan revisi, pengiriman ulang, pembatalan, dan aksi admin lainnya. Setiap catatan menyimpan data sebelum dan sesudah perubahan jika relevan." },
    ],
    status: "active",
  },

  // ═══════════════════════════════════════════════
  // GENERAL AFFAIRS
  // ═══════════════════════════════════════════════
  assets: {
    purpose: "Inventaris & Aset untuk mengelola aset perusahaan (laptop, kendaraan, peralatan kantor). Lihat daftar aset tersedia, ajukan peminjaman, lacak penggunaan, dan laporkan kerusakan.",
    flow: [
      "Klik menu 'Inventaris & Aset' di sidebar kiri",
      "Lihat daftar aset perusahaan dengan status: tersedia, dipinjam, atau rusak",
      "Klik aset untuk melihat detail: spesifikasi, riwayat peminjaman, dan kondisi",
      "Klik 'Pinjam' pada aset yang tersedia untuk mengajukan peminjaman",
      "Kembalikan aset dengan klik 'Kembalikan' dan laporkan jika ada kerusakan",
    ],
    steps: [
      { title: "Daftar Aset", description: "Halaman menampilkan grid kartu aset. Setiap kartu menunjukkan: foto, nama aset, nomor inventaris, kategori, kondisi, dan badge status (Tersedia hijau, Dipinjam kuning, Rusak merah). Gunakan pencarian dan filter kategori di atas." },
      { title: "Detail Aset", description: "Klik kartu untuk detail: spesifikasi lengkap, tanggal pembelian, nilai aset, lokasi penyimpanan, riwayat peminjaman, dan riwayat perawatan." },
      { title: "Peminjaman Aset", description: "Pada aset berstatus 'Tersedia', klik 'Pinjam'. Form muncul: isi tanggal pinjam, estimasi tanggal kembali, dan keperluan. Klik 'Ajukan'. Admin/GA akan menyetujui permintaan." },
      { title: "Pengembalian", description: "Buka aset yang Anda pinjam, klik 'Kembalikan'. Isi form: kondisi aset saat dikembalikan dan catatan. Jika rusak, pilih 'Laporkan Kerusakan' dan jelaskan detail kerusakan." },
      { title: "Kelola Aset (Admin)", description: "Admin klik 'Tambah Aset': isi nama, kategori, nomor inventaris, foto, spesifikasi, dan nilai. Admin juga dapat memperbarui status aset dan mencatat perawatan." },
    ],
    status: "active",
  },

  rooms: {
    purpose: "Pemesanan Ruangan untuk memesan ruang rapat dan fasilitas bersama. Kalender visual menampilkan ketersediaan setiap ruangan. Pesan ruangan untuk tanggal dan jam tertentu.",
    flow: [
      "Klik menu 'Pemesanan Ruangan' di sidebar kiri",
      "Kalender menampilkan slot kosong dan terisi untuk setiap ruangan",
      "Klik slot kosong pada tanggal dan jam yang diinginkan",
      "Isi form: pilih ruangan, jam mulai dan selesai, judul rapat",
      "Konfirmasi pemesanan. Batalkan jika rencana berubah",
    ],
    steps: [
      { title: "Melihat Ketersediaan", description: "Kalender visual menampilkan semua ruangan di kolom dan jam di baris. Slot hijau = tersedia, slot merah/abu = terisi. Filter per ruangan atau kapasitas di atas kalender." },
      { title: "Memesan Ruangan", description: "Klik slot kosong atau klik 'Pesan Ruangan'. Form muncul: pilih ruangan dari daftar (tampilkan kapasitas dan fasilitas), tanggal, jam mulai, jam selesai, dan judul rapat. Klik 'Konfirmasi Pemesanan'." },
      { title: "Membatalkan Pemesanan", description: "Klik pemesanan Anda (ditandai warna biru) di kalender, lalu klik 'Batalkan Pemesanan'. Dialog konfirmasi muncul — klik 'Ya, Batalkan' untuk mengkonfirmasi." },
      { title: "Detail Ruangan", description: "Klik nama ruangan untuk melihat detail: foto, kapasitas, fasilitas (proyektor, whiteboard, video conference), dan jadwal pemesanan minggu ini." },
    ],
    status: "active",
  },

  events: {
    purpose: "Event Perusahaan untuk merencanakan, mengumumkan, dan mengelola acara internal. Admin membuat event, undang peserta, dan kelola pendaftaran. Karyawan melihat daftar event dan mendaftar.",
    flow: [
      "Klik menu 'Event Perusahaan' di sidebar kiri",
      "Lihat daftar event mendatang dan yang sedang berlangsung",
      "Klik event untuk melihat detail: jadwal, lokasi, deskripsi, dan pendaftar",
      "Klik 'Daftar' untuk mendaftar sebagai peserta",
      "Admin: buat event baru dan kelola undangan",
    ],
    steps: [
      { title: "Daftar Event", description: "Halaman menampilkan kartu event: nama, tanggal, lokasi, deskripsi singkat, kapasitas (terisi/total), dan status (Mendatang/Berlangsung/Selesai). Gunakan filter kategori dan pencarian." },
      { title: "Detail & Pendaftaran", description: "Klik event untuk detail lengkap: deskripsi, agenda, pembicara, lokasi (map jika ada), dan daftar peserta. Klik 'Daftar' untuk mendaftar. Kapasitas ditampilkan real-time." },
      { title: "Membuat Event (Admin)", description: "Klik 'Buat Event'. Isi: nama event, tanggal dan jam, lokasi, deskripsi, kapasitas maksimal, kategori, dan gambar banner. Klik 'Publikasikan'." },
      { title: "Undangan & Notifikasi", description: "Admin mengirim undangan ke departemen atau karyawan tertentu. Peserta menerima notifikasi dan reminder sebelum event dimulai." },
    ],
    status: "active",
  },

  // ═══════════════════════════════════════════════
  // OPERASIONAL
  // ═══════════════════════════════════════════════
  projects: {
    purpose: "Tugas & Proyek untuk mengelola proyek, membuat tugas, assign ke anggota tim, dan melacak progress. Tersedia tampilan Kanban board dan daftar tugas.",
    flow: [
      "Klik menu 'Tugas & Proyek' di sidebar kiri",
      "Lihat daftar proyek aktif atau klik 'Buat Proyek' untuk membuat baru",
      "Klik proyek untuk masuk ke board manajemen tugas",
      "Tambahkan tugas, atur prioritas, dan assign ke anggota tim",
      "Pindahkan tugas antar kolom Kanban untuk update status",
    ],
    steps: [
      { title: "Daftar Proyek", description: "Halaman menampilkan kartu per proyek: nama, deskripsi singkat, progress bar, jumlah tugas, anggota tim, dan deadline. Klik kartu untuk masuk ke detail proyek." },
      { title: "Membuat Proyek", description: "Klik 'Buat Proyek'. Isi: nama proyek, deskripsi, deadline, pilih anggota tim, dan tetapkan project lead. Klik 'Buat'." },
      { title: "Kanban Board", description: "Tampilan Kanban menampilkan kolom: To Do, In Progress, Review, dan Done. Seret kartu tugas antar kolom untuk mengubah status. Setiap kartu menampilkan: judul, assignee, prioritas (badge warna), dan deadline." },
      { title: "Menambah Tugas", description: "Klik '+' di kolom yang diinginkan atau klik 'Tambah Tugas'. Isi: judul, deskripsi, pilih assignee, atur prioritas (Low/Medium/High/Urgent), dan tentukan deadline. Klik 'Simpan'." },
      { title: "Detail Tugas", description: "Klik kartu tugas untuk detail: deskripsi lengkap, komentar tim, lampiran file, sub-tugas, dan log aktivitas. Edit status, assignee, atau prioritas langsung dari detail." },
    ],
    status: "active",
  },

  // ═══════════════════════════════════════════════
  // CORPORATE COMMUNICATION
  // ═══════════════════════════════════════════════
  news: {
    purpose: "Berita & Pengumuman untuk mempublikasikan informasi penting kepada seluruh karyawan. Filter berdasarkan kategori (Penting, Umum, Event, Kebijakan). Admin membuat dan mempublikasikan pengumuman.",
    flow: [
      "Klik menu 'Berita & Pengumuman' di sidebar kiri",
      "Daftar pengumuman terbaru ditampilkan dari yang paling baru",
      "Klik judul untuk membaca selengkapnya",
      "Gunakan filter kategori di atas untuk mempersempit tampilan",
      "Admin: klik 'Buat Pengumuman' untuk mempublikasikan informasi baru",
    ],
    steps: [
      { title: "Membaca Pengumuman", description: "Daftar pengumuman dalam format kartu: judul, tanggal, kategori (badge warna), ringkasan, dan jumlah views. Klik judul untuk membaca isi lengkap termasuk lampiran dan gambar." },
      { title: "Filter Kategori", description: "Tab filter di atas daftar: 'Semua', 'Penting' (merah), 'Umum' (biru), 'Event' (hijau), 'Kebijakan' (ungu). Klik tab untuk memfilter. Kolom pencarian untuk mencari berdasarkan judul atau isi." },
      { title: "Membuat Pengumuman (Admin)", description: "Klik 'Buat Pengumuman'. Form terbuka: isi judul, pilih kategori, tulis isi pengumuman (rich text editor), upload lampiran jika ada, dan pilih target audiens (Semua/Departemen tertentu). Klik 'Publikasikan'." },
      { title: "Merespons", description: "Pada pengumuman tertentu, karyawan dapat memberikan reaksi (like) atau komentar. Jumlah reaksi dan komentar ditampilkan di bawah pengumuman." },
    ],
    status: "active",
  },

  forum: {
    purpose: "Forum Diskusi untuk berdiskusi antar karyawan tentang berbagai topik. Buat topik baru, balas diskusi, vote jawaban terbaik, dan tandai solusi.",
    flow: [
      "Klik menu 'Forum Diskusi' di sidebar kiri",
      "Jelajahi daftar topik diskusi yang ada",
      "Klik topik untuk membaca dan ikut berdiskusi",
      "Klik 'Buat Topik' untuk memulai diskusi baru",
      "Vote jawaban yang bermanfaat dan tandai solusi terbaik",
    ],
    steps: [
      { title: "Melihat Forum", description: "Daftar topik dengan judul, penulis, kategori, jumlah balasan, dan tanggal terakhir aktif. Filter berdasarkan kategori dan urutkan berdasarkan terbaru/terpopuler/belum terjawab." },
      { title: "Membuat Topik", description: "Klik 'Buat Topik'. Isi judul, pilih kategori, dan tulis isi diskusi. Gunakan rich text editor untuk format teks. Klik 'Posting'." },
      { title: "Berdiskusi", description: "Buka topik lalu tulis balasan di kolom komentar bawah. Klik tombol vote (panah atas) pada jawaban yang bermanfaat. Jumlah vote ditampilkan di samping setiap jawaban." },
      { title: "Tandai Solusi", description: "Pembuat topik dapat menandai satu jawaban sebagai 'Solusi Terbaik' dengan klik ikon centang. Jawaban ini akan ditampilkan paling atas dengan highlight khusus." },
    ],
    status: "active",
  },

  polls: {
    purpose: "Polling & Survei untuk membuat dan mengikuti polling cepat. Admin membuat polling dengan pertanyaan dan opsi jawaban. Karyawan memberikan suara dan melihat hasil real-time.",
    flow: [
      "Klik menu 'Polling' di sidebar kiri",
      "Lihat polling yang sedang aktif",
      "Pilih opsi jawaban pada polling, lalu klik 'Vote'",
      "Lihat persentase dan grafik hasil setelah voting",
      "Admin: klik 'Buat Polling' untuk membuat polling baru",
    ],
    steps: [
      { title: "Memberikan Suara", description: "Polling aktif ditampilkan dengan pertanyaan dan opsi jawaban. Pilih satu opsi (atau beberapa jika diizinkan) lalu klik 'Vote'. Anda hanya bisa vote sekali per polling." },
      { title: "Melihat Hasil", description: "Setelah voting, grafik batang menampilkan persentase setiap opsi. Jumlah total voter dan deadline polling ditampilkan. Beberapa polling menampilkan hasil secara real-time sebelum deadline." },
      { title: "Membuat Polling (Admin)", description: "Klik 'Buat Polling'. Isi pertanyaan, tambahkan opsi jawaban (minimal 2), tentukan deadline, dan pilih tipe (single choice/multiple choice). Klik 'Publikasikan'." },
    ],
    status: "active",
  },

  suggestions: {
    purpose: "Kotak Saran untuk mengirim ide, saran, atau masukan. Dapat dikirim secara anonim atau dengan nama. Admin meninjau dan menindaklanjuti saran.",
    flow: [
      "Klik menu 'Kotak Saran' di sidebar kiri",
      "Klik 'Kirim Saran' untuk menulis ide atau masukan baru",
      "Pilih apakah ingin mengirim secara anonim atau dengan nama",
      "Pantau status saran: Diterima, Ditinjau, Diimplementasikan, atau Ditolak",
      "Dukung saran dari karyawan lain dengan memberikan vote",
    ],
    steps: [
      { title: "Mengirim Saran", description: "Klik 'Kirim Saran'. Form terbuka: tulis judul dan isi saran/ide Anda. Centang 'Kirim secara anonim' jika tidak ingin nama Anda ditampilkan. Pilih kategori saran. Klik 'Kirim'." },
      { title: "Status Saran", description: "Tab 'Saran Saya' menampilkan semua saran yang Anda kirim. Status ditampilkan sebagai badge: Diterima (biru), Ditinjau (kuning), Diimplementasikan (hijau), atau Ditolak (merah). Admin menambahkan catatan tindak lanjut." },
      { title: "Vote Saran", description: "Di halaman daftar saran, klik tombol vote (panah atas) pada saran yang Anda dukung. Saran dengan vote terbanyak diprioritaskan oleh admin. Jumlah vote ditampilkan di samping setiap saran." },
      { title: "Review Saran (Admin)", description: "Admin melihat semua saran masuk. Klik saran untuk membaca detail, ubah status, dan tulis catatan tindak lanjut. Notifikasi dikirim ke pengirim saat status berubah." },
    ],
    status: "active",
  },

  celebrations: {
    purpose: "Perayaan untuk merayakan ulang tahun, anniversary kerja, dan momen penting karyawan. Sistem otomatis mendeteksi perayaan dan menampilkan ucapan di beranda.",
    flow: [
      "Klik menu 'Perayaan' di sidebar kiri",
      "Lihat daftar perayaan bulan ini: ulang tahun dan anniversary kerja",
      "Klik 'Ucapkan Selamat' untuk mengirim ucapan kepada rekan kerja",
      "Admin: tambahkan perayaan khusus perusahaan (hari jadi, pencapaian)",
    ],
    steps: [
      { title: "Perayaan Bulan Ini", description: "Daftar kartu menampilkan karyawan yang berulang tahun dan yang merayakan anniversary kerja bulan ini. Setiap kartu menunjukkan: foto, nama, tanggal, dan jenis perayaan (Birthday/Work Anniversary + tahun ke-N)." },
      { title: "Memberikan Ucapan", description: "Klik 'Ucapkan Selamat' pada kartu karyawan. Form muncul: tulis pesan ucapan pribadi. Klik 'Kirim'. Ucapan ditampilkan di profil penerima dan di feed perayaan." },
      { title: "Perayaan Hari Ini", description: "Banner khusus di halaman beranda (home) otomatis menampilkan karyawan yang berulang tahun atau anniversary hari ini." },
      { title: "Perayaan Khusus (Admin)", description: "Admin klik 'Tambah Perayaan': isi nama event, tanggal, deskripsi, dan upload gambar. Cocok untuk hari jadi perusahaan, pencapaian tim, atau event spesial lainnya." },
    ],
    status: "active",
  },

  recognitions: {
    purpose: "Apresiasi untuk memberikan penghargaan dan pengakuan kepada rekan kerja. Pilih badge, tulis pesan apresiasi, dan publikasikan. Feed menampilkan semua apresiasi dan leaderboard.",
    flow: [
      "Klik menu 'Apresiasi' di sidebar kiri",
      "Klik 'Berikan Apresiasi' untuk mengirim penghargaan ke rekan kerja",
      "Pilih penerima, tulis pesan apresiasi, dan pilih badge",
      "Lihat feed apresiasi dari seluruh karyawan",
      "Cek leaderboard untuk melihat siapa yang paling banyak mendapat apresiasi",
    ],
    steps: [
      { title: "Memberikan Apresiasi", description: "Klik 'Berikan Apresiasi'. Form: pilih rekan kerja dari daftar, pilih badge/kategori (Teamwork, Innovation, Leadership, dll.), tulis pesan apresiasi, dan klik 'Publikasikan'. Penerima mendapat notifikasi." },
      { title: "Feed Apresiasi", description: "Halaman utama menampilkan feed semua apresiasi terbaru: siapa memberi ke siapa, badge apa, dan pesan. Karyawan lain dapat memberikan like pada apresiasi." },
      { title: "Leaderboard", description: "Tab 'Leaderboard' menampilkan peringkat karyawan berdasarkan jumlah apresiasi yang diterima. Filter berdasarkan periode (minggu/bulan/kuartal) dan departemen." },
      { title: "Profil Apresiasi", description: "Klik nama karyawan untuk melihat semua apresiasi yang diterima dan diberikan. Koleksi badge ditampilkan di profil." },
    ],
    status: "active",
  },

  awards: {
    purpose: "Penghargaan untuk mengelola program penghargaan formal perusahaan. Admin membuat program, karyawan menominasikan kandidat, komite menilai, dan pemenang diumumkan.",
    flow: [
      "Klik menu 'Penghargaan' di sidebar kiri",
      "Lihat program penghargaan yang sedang berlangsung dan kriterianya",
      "Klik 'Nominasikan' untuk mengajukan rekan kerja sebagai kandidat",
      "Komite menilai nominasi dan memilih pemenang",
      "Lihat daftar pemenang penghargaan dan prestasi mereka",
    ],
    steps: [
      { title: "Program Aktif", description: "Daftar program penghargaan yang sedang dibuka: nama program, kategori, kriteria penilaian, deadline nominasi, dan hadiah. Klik untuk melihat detail lengkap." },
      { title: "Nominasi", description: "Klik 'Nominasikan' pada program yang aktif. Pilih rekan kerja dari daftar, tulis justifikasi mengapa mereka layak menerima penghargaan. Klik 'Kirim Nominasi'." },
      { title: "Proses Penilaian (Admin)", description: "Komite penilai melihat semua nominasi. Beri skor per kriteria, tulis catatan, dan tentukan pemenang. Klik 'Umumkan Pemenang' untuk mempublikasikan hasil." },
      { title: "Hall of Fame", description: "Tab 'Pemenang' menampilkan daftar seluruh pemenang penghargaan sepanjang waktu: nama, program, kategori, tahun, dan pencapaian. Arsip lengkap penghargaan perusahaan." },
    ],
    status: "active",
  },

  gallery: {
    purpose: "Galeri Kegiatan untuk menyimpan dan berbagi foto serta video kegiatan perusahaan. Jelajahi album, upload foto, dan berikan komentar.",
    flow: [
      "Klik menu 'Galeri' di sidebar kiri",
      "Jelajahi album foto berdasarkan event atau kategori",
      "Klik album untuk melihat koleksi foto di dalamnya",
      "Klik foto untuk melihat ukuran penuh",
      "Klik 'Upload' untuk menambahkan foto ke album",
    ],
    steps: [
      { title: "Melihat Galeri", description: "Grid album ditampilkan dengan cover photo, nama event, tanggal, dan jumlah foto. Filter berdasarkan tahun atau kategori event. Klik album untuk masuk." },
      { title: "Melihat Foto", description: "Di dalam album, grid foto ditampilkan. Klik foto untuk melihat ukuran penuh dengan navigasi previous/next. Informasi: tanggal, uploader, dan deskripsi ditampilkan di bawah." },
      { title: "Upload Foto", description: "Di dalam album, klik 'Upload'. Pilih satu atau beberapa foto dari perangkat, tambahkan deskripsi (opsional), dan klik 'Upload'. Foto langsung muncul di album." },
      { title: "Interaksi", description: "Pada setiap foto, klik ikon hati untuk like dan klik ikon komentar untuk menulis komentar. Jumlah like dan komentar ditampilkan." },
    ],
    status: "active",
  },

  // ═══════════════════════════════════════════════
  // LEGAL & COMPLIANCE
  // ═══════════════════════════════════════════════
  documents: {
    purpose: "Dokumen Perusahaan untuk mengakses repositori dokumen resmi: SOP, kebijakan, template surat, dan panduan kerja. Cari, filter, baca langsung di browser, atau unduh.",
    flow: [
      "Klik menu 'Dokumen Perusahaan' di sidebar kiri",
      "Gunakan pencarian atau filter kategori/departemen untuk menemukan dokumen",
      "Klik dokumen untuk membaca langsung di browser",
      "Klik 'Unduh' untuk menyimpan dokumen ke perangkat Anda",
    ],
    steps: [
      { title: "Mencari Dokumen", description: "Kolom pencarian di atas: ketik kata kunci untuk mencari berdasarkan judul, deskripsi, atau isi. Filter sidebar: kategori (SOP, Kebijakan, Template, Panduan) dan departemen. Hasil langsung diperbarui." },
      { title: "Membaca Dokumen", description: "Klik judul dokumen untuk membuka. Dokumen ditampilkan langsung di browser (PDF viewer atau rich text). Informasi: versi, tanggal update terakhir, dan penulis ditampilkan di header." },
      { title: "Mengunduh", description: "Klik tombol 'Unduh' (ikon download) di pojok kanan atas viewer dokumen. File akan tersimpan ke perangkat Anda dalam format asli (PDF/DOCX)." },
      { title: "Mengelola Dokumen (Admin)", description: "Admin klik 'Upload Dokumen': pilih file, isi judul, kategori, departemen, dan deskripsi. Admin juga bisa mengedit metadata dan menghapus dokumen yang tidak relevan." },
    ],
    status: "active",
  },

  my_documents: {
    purpose: "Dokumen Saya untuk menyimpan dan mengelola dokumen pribadi terkait pekerjaan. Upload, organisasi ke folder, dan akses kapan saja dari mana saja.",
    flow: [
      "Klik menu 'Dokumen Saya' di sidebar kiri",
      "Lihat daftar dokumen pribadi Anda",
      "Klik 'Upload' untuk menambahkan dokumen baru",
      "Buat folder untuk mengorganisasi dokumen",
      "Klik dokumen untuk membuka atau 'Unduh' untuk menyimpan",
    ],
    steps: [
      { title: "Upload Dokumen", description: "Klik tombol 'Upload'. Pilih file dari perangkat, beri nama/judul, pilih folder tujuan (opsional). Klik 'Upload'. Dokumen tersimpan dan dapat diakses kapan saja." },
      { title: "Organisasi Folder", description: "Klik 'Buat Folder' untuk membuat folder baru: isi nama folder dan klik 'Buat'. Seret dokumen ke folder atau gunakan menu konteks (klik kanan) untuk memindahkan." },
      { title: "Membuka Dokumen", description: "Klik judul dokumen untuk membuka langsung di browser. Klik 'Unduh' untuk menyimpan ke perangkat." },
      { title: "Berbagi (Opsional)", description: "Klik ikon berbagi pada dokumen untuk membagikan ke rekan kerja tertentu. Pilih penerima dan atur hak akses (Lihat saja/Lihat & Unduh)." },
    ],
    status: "active",
  },

  wiki: {
    purpose: "Wiki & Pengetahuan sebagai basis pengetahuan perusahaan yang dapat diedit bersama. Cari, baca, dan kontribusi artikel untuk membagikan pengetahuan.",
    flow: [
      "Klik menu 'Wiki' di sidebar kiri",
      "Gunakan pencarian untuk menemukan artikel atau topik tertentu",
      "Klik artikel untuk membaca isi lengkap",
      "Klik 'Edit' untuk memperbarui artikel atau 'Buat Baru' untuk menambah",
    ],
    steps: [
      { title: "Mencari Informasi", description: "Kolom pencarian di atas: ketik kata kunci untuk mencari judul atau isi artikel. Sidebar menampilkan kategori dan daftar isi (table of contents). Hasil pencarian di-highlight." },
      { title: "Membaca Artikel", description: "Klik judul artikel. Isi ditampilkan dalam format wiki: heading, paragraph, daftar, gambar, dan tabel. Breadcrumb di atas menunjukkan kategori > sub-kategori > artikel. Informasi: terakhir diedit oleh siapa dan kapan." },
      { title: "Mengedit Artikel", description: "Klik tombol 'Edit' di pojok kanan atas artikel. Rich text editor terbuka: edit teks, tambahkan heading, gambar, link, dan tabel. Klik 'Simpan Perubahan'. Riwayat versi tersimpan otomatis." },
      { title: "Membuat Artikel Baru", description: "Klik 'Buat Baru'. Isi: judul, pilih kategori, tulis isi artikel menggunakan editor, dan klik 'Publikasikan'. Artikel langsung muncul di wiki." },
    ],
    status: "active",
  },

  policies: {
    purpose: "Kebijakan Perusahaan untuk mengakses semua peraturan dan kebijakan yang berlaku. Baca kebijakan, konfirmasi telah membaca (tanda tangan digital), dan cek pembaruan.",
    flow: [
      "Klik menu 'Kebijakan' di sidebar kiri",
      "Lihat daftar semua kebijakan aktif, filter berdasarkan kategori",
      "Klik kebijakan untuk membaca isi lengkap",
      "Jika diminta, tanda tangani digital sebagai konfirmasi telah membaca",
      "Cek notifikasi untuk pembaruan kebijakan terbaru",
    ],
    steps: [
      { title: "Melihat Kebijakan", description: "Daftar kebijakan dalam kartu: judul, kategori (SDM, Operasional, Keuangan, IT, dll.), tanggal berlaku, dan status (Aktif/Revisi/Arsip). Badge 'Baru' pada kebijakan yang baru diterbitkan. Filter berdasarkan kategori di atas." },
      { title: "Membaca Kebijakan", description: "Klik judul untuk membaca isi lengkap. Versi terbaru selalu ditampilkan. Informasi: nomor kebijakan, tanggal berlaku, tanggal revisi, dan penanggung jawab." },
      { title: "Konfirmasi Tanda Tangan", description: "Beberapa kebijakan memerlukan tanda tangan digital sebagai bukti Anda telah membaca dan memahami. Klik 'Saya Setuju dan Telah Membaca'. Waktu tanda tangan tercatat." },
      { title: "Riwayat Versi", description: "Klik 'Lihat Riwayat Versi' untuk melihat semua versi kebijakan: tanggal perubahan, ringkasan perubahan, dan siapa yang menyetujui revisi." },
    ],
    status: "active",
  },

  // ═══════════════════════════════════════════════
  // INFORMATION TECHNOLOGY
  // ═══════════════════════════════════════════════
  support: {
    purpose: "Bantuan IT untuk melaporkan masalah teknis dan mendapatkan bantuan dari tim IT. Buat tiket, jelaskan masalah, lampirkan screenshot, dan lacak penyelesaian.",
    flow: [
      "Klik menu 'Bantuan IT' di sidebar kiri",
      "Klik 'Buat Tiket' untuk melaporkan masalah baru",
      "Pilih kategori masalah, jelaskan detail, dan lampirkan screenshot",
      "Kirim tiket dan tunggu respons dari tim IT",
      "Pantau status: Open, In Progress, Resolved, atau Closed",
    ],
    steps: [
      { title: "Membuat Tiket", description: "Klik 'Buat Tiket'. Form terbuka: pilih kategori (Hardware, Software, Jaringan, Akun, Lainnya), pilih prioritas (Low/Medium/High/Critical), tulis judul dan deskripsi detail masalah, lampirkan screenshot jika ada. Klik 'Kirim'." },
      { title: "Melacak Status", description: "Tab 'Tiket Saya' menampilkan semua tiket. Setiap baris: nomor tiket, judul, kategori, prioritas, tanggal dibuat, dan badge status (Open biru, In Progress kuning, Resolved hijau, Closed abu-abu). Klik untuk detail." },
      { title: "Komunikasi", description: "Klik tiket untuk membuka detail. Tambahkan komentar di area diskusi untuk memberikan informasi tambahan atau merespons pertanyaan tim IT. Notifikasi dikirim setiap ada update." },
      { title: "Menutup Tiket", description: "Setelah masalah terselesaikan, tim IT mengubah status ke 'Resolved'. Anda dapat mengkonfirmasi dengan klik 'Tutup Tiket' atau 'Buka Kembali' jika masalah belum selesai." },
    ],
    status: "active",
  },

  admin: {
    purpose: "Dashboard Admin untuk mengelola pengaturan halaman aplikasi dan konfigurasi persetujuan keuangan. Terdapat tab: 'Landing Page' (kelola section landing page), 'Halaman Dashboard' (edit widget dashboard), 'Persetujuan' (konfigurasi rantai persetujuan keuangan, mapping fungsi, dan delegasi otoritas), 'Beranda' (edit banner, tagar, nilai perusahaan, carousel), dan 'Footer' (kelola link footer).",
    flow: [
      "Klik menu 'Admin' di sidebar kiri (hanya terlihat oleh admin)",
      "Halaman 'Pengaturan Halaman' terbuka dengan tab-tab konfigurasi",
      "Tab 'Landing Page' (Super Admin): toggle visibilitas section landing page",
      "Tab 'Halaman Dashboard': edit widget dan layout dashboard",
      "Tab 'Persetujuan': konfigurasi rantai persetujuan keuangan berjenjang",
      "Tab 'Beranda': edit konten halaman beranda (banner, tagar, nilai perusahaan)",
      "Tab 'Footer' (Super Admin): kelola link dan konten footer",
    ],
    steps: [
      { title: "Tab 'Landing Page' (Super Admin)", description: "Menampilkan daftar semua section landing page (Hero, Features, Pricing, dll.) dengan toggle switch untuk show/hide setiap section. Ringkasan status ditampilkan di atas. Klik 'Simpan' untuk menerapkan perubahan. Tombol 'Reset' mengembalikan ke default." },
      { title: "Tab 'Halaman Dashboard'", description: "Kelola widget dan komponen yang ditampilkan di halaman Dashboard utama. Atur visibilitas dan urutan widget statistik, pengumuman, event, dan pintasan cepat." },
      { title: "Tab 'Persetujuan'", description: "Konfigurasi sistem persetujuan keuangan berjenjang. Terdapat 3 sub-tab: 'Rantai Persetujuan' (buat dan kelola approval chain berdasarkan jenis pengajuan, rentang nominal, dan level approver), 'Mapping Fungsi' (tetapkan user ke role keuangan seperti Finance Manager, Finance Staff, Director, Approver), dan 'Delegasi Otoritas' (delegasikan wewenang persetujuan ke user lain dengan periode berlaku). Setiap rantai persetujuan terdiri dari beberapa level dengan tipe approver (role, spesifik user, atau atasan langsung) dan SLA deadline." },
      { title: "Tab 'Beranda'", description: "Form untuk mengedit konten halaman beranda yang dilihat semua pengguna setelah login. Edit: Slogan & Tagar, Sorotan & Kegiatan (carousel slides), Nilai Perusahaan, dan pengaturan carousel (jenis transisi, durasi, kecepatan, autoplay). Upload gambar banner baru. Klik 'Simpan Perubahan'." },
      { title: "Tab 'Footer' (Super Admin)", description: "Kelola link dan konten footer website. Edit informasi perusahaan, link navigasi, link sosial media, dan teks copyright. Klik 'Simpan'." },
    ],
    status: "active",
  },

  user_management: {
    purpose: "Pengaturan Pengguna untuk mengelola akun, role, dan hak akses semua pengguna. Admin dapat melihat daftar pengguna, mengubah role, dan mengatur menu yang dapat diakses per role.",
    flow: [
      "Klik menu 'Pengaturan Pengguna' di sidebar kiri (hanya admin)",
      "Lihat daftar semua pengguna terdaftar dengan role dan status akun",
      "Klik nama pengguna untuk melihat/edit detail profil dan role",
      "Ubah role (Admin, HR, Manager, Karyawan, dll.) dan simpan",
      "Atur menu akses per role di tab 'Hak Akses'",
    ],
    steps: [
      { title: "Daftar Pengguna", description: "Tabel menampilkan semua pengguna: nama, email, role (badge warna), departemen, tanggal bergabung, dan status (Aktif/Nonaktif). Kolom pencarian dan filter role di atas. Klik nama untuk detail." },
      { title: "Mengelola Role", description: "Klik pengguna, pilih role baru dari dropdown (Super Admin, Admin, HR, Manager, Karyawan, Guest). Klik 'Simpan'. Notifikasi perubahan dikirim ke pengguna." },
      { title: "Hak Akses Menu", description: "Tab 'Hak Akses': tabel matriks menampilkan role di kolom dan menu di baris. Centang/uncheck untuk mengatur menu mana yang bisa diakses oleh setiap role. Klik 'Simpan' untuk menerapkan." },
      { title: "Status Akun", description: "Admin dapat menonaktifkan akun pengguna (toggle Aktif/Nonaktif). Pengguna nonaktif tidak dapat login. Data mereka tetap tersimpan." },
    ],
    status: "active",
  },

  membership_settings: {
    purpose: "Pengaturan Paket untuk mengkonfigurasi paket keanggotaan organisasi. Lihat paket tersedia (Free, Basic, Pro, Enterprise), edit fitur dan limit, atur harga, dan aktivasi/nonaktifkan paket.",
    flow: [
      "Klik menu 'Pengaturan Paket' di sidebar kiri (hanya super admin)",
      "Lihat daftar semua paket keanggotaan",
      "Klik paket untuk melihat dan edit konfigurasi",
      "Atur fitur, limit pengguna, dan harga per paket",
      "Aktifkan atau nonaktifkan paket sesuai kebutuhan",
    ],
    steps: [
      { title: "Daftar Paket", description: "Kartu per paket: nama (Free/Basic/Pro/Enterprise), harga, jumlah pengguna aktif, limit, dan status (Aktif/Nonaktif). Badge menunjukkan paket paling populer." },
      { title: "Edit Paket", description: "Klik paket untuk membuka editor: ubah nama, harga, deskripsi, limit pengguna, dan daftar fitur yang disertakan. Toggle fitur individual on/off. Klik 'Simpan'." },
      { title: "Aktivasi Paket", description: "Toggle switch di kartu paket untuk mengaktifkan atau menonaktifkan. Paket nonaktif tidak tersedia untuk organisasi baru tapi tetap berlaku untuk yang sudah berlangganan." },
    ],
    status: "active",
  },

  promo_settings: {
    purpose: "Promo & Upgrade untuk mengelola program promosi dan upgrade paket organisasi. Buat promo diskon, tentukan periode berlaku, dan monitor penggunaan.",
    flow: [
      "Klik menu 'Promo & Upgrade' di sidebar kiri (hanya super admin)",
      "Lihat promo yang sedang aktif dan statistik penggunaan",
      "Klik 'Buat Promo' untuk membuat program promosi baru",
      "Tentukan diskon, periode berlaku, dan syarat ketentuan",
      "Monitor penggunaan promo di dashboard",
    ],
    steps: [
      { title: "Membuat Promo", description: "Klik 'Buat Promo'. Isi: nama promo, kode promo, tipe diskon (persentase/nominal), nilai diskon, tanggal mulai, tanggal berakhir, batas penggunaan, dan syarat ketentuan. Klik 'Publikasikan'." },
      { title: "Kelola Promo Aktif", description: "Daftar kartu promo: nama, kode, diskon, periode berlaku, jumlah terpakai/limit, dan status. Toggle switch untuk mengaktifkan/menonaktifkan promo sebelum periode berakhir." },
      { title: "Upgrade Paket", description: "Tab 'Upgrade': lihat opsi upgrade paket untuk organisasi Anda. Bandingkan fitur antar paket dalam tabel perbandingan. Klik 'Upgrade' untuk memproses." },
    ],
    status: "active",
  },

  membership_dashboard: {
    purpose: "Pemantauan Keanggotaan untuk memantau statistik dan status keanggotaan seluruh organisasi. Dashboard menampilkan total organisasi aktif, distribusi paket, revenue, dan tren pertumbuhan.",
    flow: [
      "Klik menu 'Pemantauan Keanggotaan' di sidebar kiri (hanya super admin)",
      "Dashboard menampilkan ringkasan: total organisasi aktif, distribusi paket, dan revenue",
      "Klik organisasi untuk melihat detail paket dan penggunaan",
      "Lihat grafik tren pertumbuhan keanggotaan",
      "Export data keanggotaan jika diperlukan",
    ],
    steps: [
      { title: "Ringkasan Dashboard", description: "Kartu statistik utama: Total Organisasi Aktif, Total Revenue, distribusi per paket (grafik donut), dan growth rate. Data terupdate real-time." },
      { title: "Detail Organisasi", description: "Tabel daftar organisasi: nama, paket saat ini, jumlah pengguna, tanggal bergabung, dan status pembayaran. Klik untuk detail lengkap: riwayat paket, penggunaan fitur, dan invoice." },
      { title: "Tren Pertumbuhan", description: "Grafik garis menampilkan tren pertumbuhan keanggotaan dari bulan ke bulan: organisasi baru, churn, upgrade, dan downgrade." },
      { title: "Export", description: "Klik 'Export' untuk mengunduh data keanggotaan dalam format CSV atau PDF untuk analisis lebih lanjut." },
    ],
    status: "active",
  },
};

/**
 * Mendapatkan panduan untuk sebuah menu.
 * Jika belum ada di registry, otomatis generate placeholder "Segera Hadir".
 */
export function getGuideForMenu(
  key: string,
  label: string,
): MenuGuide {
  const existing = guideRegistry[key];
  if (existing) return existing;

  // Auto-generate placeholder untuk menu baru / yang akan datang
  return {
    purpose: `Menu ${label} akan segera tersedia. Fitur ini sedang dalam tahap pengembangan untuk memberikan pengalaman terbaik bagi Anda.`,
    flow: [
      "Fitur sedang dalam pengembangan",
      "Akan tersedia dalam pembaruan mendatang",
      "Notifikasi akan dikirim saat fitur siap",
    ],
    steps: [
      {
        title: "Segera Hadir",
        description: `Menu ${label} sedang dikembangkan. Pantau terus pembaruan dari tim kami.`,
      },
    ],
    status: "coming_soon",
  };
}
