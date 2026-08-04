import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import { LineHeight } from "./line-height-extension.ts";
import { Color } from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Image } from "@tiptap/extension-image";
import { Highlight } from "@tiptap/extension-highlight";
import { Superscript } from "@tiptap/extension-superscript";
import { Subscript } from "@tiptap/extension-subscript";
import { Indent } from "./indent-extension.ts";
import { CharacterCount } from "@tiptap/extensions";
import { HSpace } from "./hspace-extension.ts";
import { ListStyle } from "./list-style-extension.ts";
import { TabKey } from "./tab-extension.ts";
import EditorRuler from "./EditorRuler.tsx";
import { SearchReplace, type SearchReplaceStorage } from "./search-replace-extension.ts";
import { PageBreak } from "./page-break-extension.ts";
import { type LetterDocumentDetail, LetterHeaderBlocks, LetterSignatureBlocks } from "./LetterDocument.tsx";
import { LETTER_VARIABLES } from "../_lib/letterVariables.ts";
import { cn } from "@/lib/utils.ts";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListPlus, ListTree, Quote, Minus, Undo, Redo,
  Table as TableIcon, Link as LinkIcon, RemoveFormatting,
  IndentIncrease, IndentDecrease, MessageSquarePlus, ArrowRightToLine,
  ImageIcon, Highlighter, Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon, Omega, Loader2, Upload,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  Search, Maximize2, Minimize2, SeparatorHorizontal, X, ChevronUp, ChevronDown,
  CaseUpper, CaseLower, CaseSensitive, Rows3, Braces,
  Check, AlertCircle, CloudUpload,
} from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { useEffect, useRef, useState } from "react";
import TableGridPicker from "./TableGridPicker.tsx";
import WordIcon from "./WordIcon.tsx";
import { A4_WIDTH_PX, A4_HEIGHT_PX, computePageSegments, type PageSegment } from "../_lib/paginate.ts";
import {
  LETTER_FONT_FAMILY,
  LETTER_BODY_CLASS,
} from "./LetterDocument.tsx";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface LetterEditorProps {
  content: string;
  onChange: (html: string) => void;
  readonly?: boolean;
  minHeight?: number;
  /** Tampilkan area isi sebagai lembar A4 (huruf, lebar & margin seperti hasil cetak) dengan garis batas halaman. */
  paperMode?: boolean;
  /** Status autosave untuk ditampilkan di tengah bilah status (mode kertas). */
  autoSaveStatus?: AutoSaveStatus;
  /** True bila konsep sudah pernah tersimpan (menampilkan "Autosave aktif" saat idle). */
  autoSaveActive?: boolean;
  /**
   * Detail dokumen resmi (kop, tujuan, tanda tangan) untuk mengukur jumlah
   * halaman secara akurat, identik dengan Pratinjau. Bila diberikan, editor
   * merender replika tersembunyi dari LetterDocument dan mengukur tingginya
   * alih-alih menebak tinggi kop/tanda tangan.
   */
  previewDetail?: LetterDocumentDetail;
}

// Dimensi A4 & margin dokumen resmi. A4_WIDTH_PX/A4_HEIGHT_PX diimpor dari
// utilitas paginasi bersama agar identik dengan Pratinjau.
const MM_TO_PX = 96 / 25.4;
// Padding vertikal untuk mode WYSIWYG penuh (kop + isi + tanda tangan tampil di
// editor), disamakan PERSIS dengan dokumen resmi: atas 20mm, bawah 30mm. Dengan
// begitu tata letak editor identik dengan Pratinjau/Cetak sehingga batas halaman
// jatuh di tempat yang sama.
const WYSIWYG_PAD_TOP_PX = Math.round(20 * MM_TO_PX);
const WYSIWYG_PAD_BOTTOM_PX = Math.round(30 * MM_TO_PX);
// Lebar kolom teks isi surat, PERSIS sama dengan dokumen resmi:
// 210mm (lebar A4) − 25mm margin kiri − 25mm margin kanan = 160mm.
// Titik pemenggalan baris hanya bergantung pada lebar kolom ini, jadi harus
// identik dengan Pratinjau/Cetak agar batas halaman tidak meleset satu baris.
const LETTER_CONTENT_WIDTH_PX = 160 * MM_TO_PX;
// Margin kiri/kanan lembar editor supaya kolom teks tepat 160mm pada lembar
// selebar A4_WIDTH_PX. Dihitung sebagai pecahan (tanpa pembulatan) agar lebar
// kolom teks benar-benar sama dengan dokumen resmi.
const DEFAULT_MARGIN_X_PX = (A4_WIDTH_PX - LETTER_CONTENT_WIDTH_PX) / 2;
// Lebar satu tingkat indent daftar dalam px. Ekstensi Indent memakai 2em, dan
// pada teks isi 1em ≈ 16px (12pt), jadi satu tingkat ≈ 32px. Dipakai untuk
// menerjemahkan geseran penanda mistar menjadi tingkat indent daftar.
const LIST_INDENT_PX_PER_LEVEL = 32;

// Pilihan jenis huruf untuk surat resmi.
const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Cambria", value: "Cambria, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
];

// Pilihan ukuran huruf (pt) yang umum pada surat dinas.
const FONT_SIZES = ["9", "10", "11", "12", "14", "16", "18", "24"];

// Pilihan spasi antar baris.
const LINE_HEIGHTS: { label: string; value: string }[] = [
  { label: "1,0", value: "1" },
  { label: "1,15", value: "1.15" },
  { label: "1,5", value: "1.5" },
  { label: "2,0", value: "2" },
];

// Pilihan jarak antar paragraf (spasi setelah paragraf).
const PARAGRAPH_SPACINGS: { label: string; value: string }[] = [
  { label: "0", value: "0em" },
  { label: "Kecil", value: "0.5em" },
  { label: "Sedang", value: "1em" },
  { label: "Besar", value: "1.5em" },
  { label: "Ekstra", value: "2em" },
];

// Pilihan gaya penomoran (list-style-type untuk <ol>).
const NUMBER_STYLES: { label: string; value: string }[] = [
  { label: "1, 2, 3", value: "decimal" },
  { label: "a, b, c", value: "lower-alpha" },
  { label: "A, B, C", value: "upper-alpha" },
  { label: "i, ii, iii", value: "lower-roman" },
  { label: "I, II, III", value: "upper-roman" },
];

// Pilihan gaya bullet (list-style-type untuk <ul>).
const BULLET_STYLES: { label: string; value: string }[] = [
  { label: "Titik", value: "disc" },
  { label: "Lingkaran", value: "circle" },
  { label: "Kotak", value: "square" },
];

// Frasa/template cepat yang sering dipakai pada surat resmi.
const QUICK_PHRASES: { label: string; text: string }[] = [
  { label: "Dengan hormat,", text: "Dengan hormat," },
  { label: "Salam sejahtera,", text: "Salam sejahtera," },
  {
    label: "Sehubungan dengan...",
    text: "Sehubungan dengan hal tersebut di atas, ",
  },
  {
    label: "Bersama surat ini...",
    text: "Bersama surat ini kami sampaikan bahwa ",
  },
  {
    label: "Demikian surat ini...",
    text:
      "Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.",
  },
  {
    label: "Atas perhatiannya...",
    text:
      "Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.",
  },
  { label: "Hormat kami,", text: "Hormat kami," },
];

// Warna sorotan (highlight) yang tersedia.
const HIGHLIGHT_COLORS: { label: string; value: string }[] = [
  { label: "Kuning", value: "#fef08a" },
  { label: "Hijau", value: "#bbf7d0" },
  { label: "Biru", value: "#bfdbfe" },
  { label: "Merah Muda", value: "#fbcfe8" },
  { label: "Jingga", value: "#fed7aa" },
];

// Karakter khusus yang sering dipakai pada surat resmi.
const SPECIAL_CHARS: string[] = [
  "§", "№", "±", "×", "÷", "°", "•", "–", "—", "…",
  "«", "»", "“", "”", "‘", "’", "™", "©", "®",
  "Rp", "$", "€", "£", "¥", "½", "¼", "¾", "→", "✓", "✗",
];

// Kata penghubung/depan yang TIDAK dikapitalkan pada mode "Huruf Kapital Tiap Kata"
// (kecuali bila menjadi kata pertama). Mengikuti pedoman penulisan judul bahasa Indonesia.
const MINOR_WORDS = new Set<string>([
  "dan", "atau", "yang", "di", "ke", "dari", "pada", "untuk", "dengan",
  "dalam", "atas", "oleh", "serta", "bagi", "akan", "adalah", "tentang",
  "sebagai", "agar", "namun", "tetapi", "karena", "sejak", "hingga",
  "kepada", "guna", "demi", "per", "versus", "vs",
]);

// Ubah huruf pada teks terpilih. Mode:
// - "upper": SEMUA HURUF BESAR
// - "lower": semua huruf kecil
// - "title": Huruf Besar Di Awal Tiap Kata (kata penghubung tetap kecil,
//   kecuali kata pertama).
function transformCase(
  text: string,
  mode: "upper" | "lower" | "title",
): string {
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();

  // Mode "title": pisah menjadi kata sekaligus mempertahankan pemisah (spasi, dsb).
  const tokens = text.split(/(\s+)/);
  let isFirstWord = true;
  return tokens
    .map((token) => {
      // Token spasi/pemisah dibiarkan apa adanya.
      if (/^\s+$/.test(token) || token === "") return token;
      const lower = token.toLowerCase();
      // Kata penghubung tetap huruf kecil, kecuali bila menjadi kata pertama.
      if (!isFirstWord && MINOR_WORDS.has(lower)) {
        isFirstWord = false;
        return lower;
      }
      isFirstWord = false;
      // Kapitalkan huruf/angka pertama yang muncul (lewati tanda kutip/kurung).
      return lower.replace(/[\p{L}\p{N}]/u, (c) => c.toUpperCase());
    })
    .join("");
}

// Atribut "verticalAlign" untuk sel tabel agar posisi teks bisa diatur
// rata atas / tengah / bawah di dalam sel (disimpan sebagai style vertical-align).
const cellVerticalAlignAttribute = {
  verticalAlign: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.style.verticalAlign || null,
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes.verticalAlign as string | null;
      if (!value) return {};
      return { style: `vertical-align: ${value}` };
    },
  },
};

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellVerticalAlignAttribute,
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...cellVerticalAlignAttribute,
    };
  },
});

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-7 cursor-pointer items-center justify-center rounded text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function EditorToolbar({
  editor,
  onToggleSearch,
  onToggleFullscreen,
  isFullscreen,
}: {
  editor: Editor;
  onToggleSearch: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}) {
  const generateUploadUrl = useMutation(api.letters.generateUploadUrl);
  const getUploadedFileUrl = useMutation(api.letters.getUploadedFileUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  // Impor dari Word (.docx)
  const docxInputRef = useRef<HTMLInputElement>(null);
  const [isImportingDocx, setIsImportingDocx] = useState(false);

  const setLink = () => {
    const url = window.prompt("Masukkan URL:", editor.getAttributes("link").href as string ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // Atur posisi vertikal teks (rata atas/tengah/bawah) pada sel tabel.
  // Memakai setCellAttribute agar semua sel terpilih (atau sel aktif) ikut diubah.
  const setCellVerticalAlign = (value: "top" | "middle" | "bottom") => {
    // Bila sudah bernilai sama, klik lagi untuk membatalkan (kembali ke bawaan).
    const next = currentCellVAlign === value ? null : value;
    editor.chain().focus().setCellAttribute("verticalAlign", next).run();
  };

  // Apakah kursor berada di dalam tabel (untuk mengaktifkan tombol posisi sel).
  const isInTable = editor.isActive("tableCell") || editor.isActive("tableHeader");
  const currentCellVAlign =
    (editor.getAttributes("tableCell").verticalAlign as string | undefined) ??
    (editor.getAttributes("tableHeader").verticalAlign as string | undefined) ??
    null;

  // Ubah huruf teks terpilih (UPPERCASE, lowercase, atau Huruf Kapital Tiap Kata).
  // Hanya berlaku pada teks yang sedang disorot; format lain (tebal, warna, dsb) tetap.
  const applyCaseTransform = (mode: "upper" | "lower" | "title") => {
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      toast.info("Pilih dulu teks yang ingin diubah hurufnya.");
      return;
    }
    const selectedText = editor.state.doc.textBetween(from, to, "\n", "\n");
    if (!selectedText.trim()) return;
    const transformed = transformCase(selectedText, mode);
    if (transformed === selectedText) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, transformed)
      // Sorot kembali hasil agar mudah diperiksa/dirubah lagi.
      .setTextSelection({ from, to: from + transformed.length })
      .run();
  };

  // Sisipkan gambar dari URL (opsi tetap tersedia selain unggah berkas lokal).
  const insertImageFromUrl = () => {
    const url = window.prompt("Masukkan URL gambar:", "");
    if (url === null || url.trim() === "") return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  // Unggah gambar dari berkas lokal ke penyimpanan, lalu sisipkan URL-nya.
  const handleImageFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // Reset agar memilih berkas yang sama dua kali tetap memicu onChange.
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Berkas harus berupa gambar.");
      return;
    }
    // Batasi ukuran agar isi surat tidak terlalu berat (maks 5 MB).
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 5 MB.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Gagal mengunggah gambar");
      const { storageId } = (await res.json()) as { storageId: string };
      const url = await getUploadedFileUrl({
        storageId: storageId as Id<"_storage">,
      });
      if (!url) throw new Error("URL gambar tidak ditemukan");
      editor.chain().focus().setImage({ src: url }).run();
      toast.success("Gambar berhasil disisipkan.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengunggah gambar.",
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Impor isi dari berkas Word (.docx). Berkas dikonversi menjadi HTML memakai
  // pustaka mammoth (berjalan sepenuhnya di sisi peramban), lalu isinya
  // dimasukkan ke editor. Format dasar (tebal, miring, judul, daftar, tabel)
  // umumnya terbawa; tata letak rumit Word mungkin perlu dirapikan sedikit.
  const handleDocxFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isDocx =
      file.name.toLowerCase().endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!isDocx) {
      toast.error("Hanya mendukung berkas Word format .docx (bukan .doc lama).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran berkas maksimal 10 MB.");
      return;
    }

    setIsImportingDocx(true);
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value?.trim();
      if (!html) {
        toast.error("Dokumen kosong atau tidak dapat dibaca.");
        return;
      }
      // Ganti seluruh isi editor dengan hasil impor. emitUpdate memicu onUpdate
      // editor sehingga perubahan tersimpan (autosave) seperti pengetikan biasa.
      editor.chain().focus().setContent(html, { emitUpdate: true }).run();
      toast.success("Isi dari Word berhasil diimpor. Silakan periksa & rapikan bila perlu.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengimpor berkas Word.",
      );
    } finally {
      setIsImportingDocx(false);
    }
  };

  // Nilai jenis huruf aktif (kembalikan "default" bila belum diset).
  const currentFontFamily =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "default";
  // Ukuran huruf aktif dalam pt (buang satuan "pt"/"px" agar cocok dengan pilihan).
  const currentFontSizeRaw =
    (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";
  const currentFontSize = currentFontSizeRaw.replace(/pt|px/gi, "") || "default";
  // Spasi baris aktif.
  const currentLineHeight =
    (editor.getAttributes("paragraph").lineHeight as string | undefined) ??
    (editor.getAttributes("heading").lineHeight as string | undefined) ??
    "default";
  // Jarak antar paragraf aktif.
  const currentParagraphSpacing =
    (editor.getAttributes("paragraph").paragraphSpacing as
      | string
      | undefined) ??
    (editor.getAttributes("heading").paragraphSpacing as string | undefined) ??
    "default";

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-0.5 border-b bg-background p-2">
      {/* Heading */}
      <Select
        value={
          editor.isActive("heading", { level: 1 }) ? "h1" :
          editor.isActive("heading", { level: 2 }) ? "h2" :
          editor.isActive("heading", { level: 3 }) ? "h3" : "p"
        }
        onValueChange={(v) => {
          if (v === "p") editor.chain().focus().setParagraph().run();
          else if (v === "h1") editor.chain().focus().setHeading({ level: 1 }).run();
          else if (v === "h2") editor.chain().focus().setHeading({ level: 2 }).run();
          else if (v === "h3") editor.chain().focus().setHeading({ level: 3 }).run();
        }}
      >
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Paragraf</SelectItem>
          <SelectItem value="h1">Judul 1</SelectItem>
          <SelectItem value="h2">Judul 2</SelectItem>
          <SelectItem value="h3">Judul 3</SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Jenis huruf */}
      <Select
        value={currentFontFamily}
        onValueChange={(v) => {
          if (v === "default") editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(v).run();
        }}
      >
        <SelectTrigger className="h-7 w-32 text-xs" title="Jenis Huruf">
          <SelectValue placeholder="Huruf" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Huruf</SelectItem>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              <span style={{ fontFamily: f.value }}>{f.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Ukuran huruf */}
      <Select
        value={currentFontSize}
        onValueChange={(v) => {
          if (v === "default") editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(`${v}pt`).run();
        }}
      >
        <SelectTrigger className="h-7 w-16 text-xs" title="Ukuran Huruf">
          <SelectValue placeholder="pt" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">pt</SelectItem>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Spasi baris */}
      <Select
        value={currentLineHeight}
        onValueChange={(v) => {
          if (v === "default") editor.chain().focus().unsetLineHeight().run();
          else editor.chain().focus().setLineHeight(v).run();
        }}
      >
        <SelectTrigger className="h-7 w-16 text-xs" title="Spasi Baris">
          <SelectValue placeholder="Spasi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Spasi</SelectItem>
          {LINE_HEIGHTS.map((l) => (
            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Jarak antar paragraf */}
      <Select
        value={currentParagraphSpacing}
        onValueChange={(v) => {
          if (v === "default")
            editor.chain().focus().unsetParagraphSpacing().run();
          else editor.chain().focus().setParagraphSpacing(v).run();
        }}
      >
        <SelectTrigger
          className="h-7 w-[104px] text-xs"
          title="Jarak Antar Paragraf"
        >
          <span className="flex items-center gap-1">
            <Rows3 className="size-3.5 shrink-0" />
            <SelectValue placeholder="Paragraf" />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Paragraf</SelectItem>
          {PARAGRAPH_SPACINGS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
        <UnderlineIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="Superskrip (pangkat atas)">
        <SuperscriptIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="Subskrip (pangkat bawah)">
        <SubscriptIcon className="size-3.5" />
      </ToolbarButton>

      {/* Ubah huruf teks terpilih */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Ubah Huruf (kapital, kecil, tiap kata)"
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded hover:bg-muted"
          >
            <CaseSensitive className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => applyCaseTransform("upper")}>
            <CaseUpper className="size-4" />
            HURUF BESAR SEMUA
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyCaseTransform("lower")}>
            <CaseLower className="size-4" />
            huruf kecil semua
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyCaseTransform("title")}>
            <CaseSensitive className="size-4" />
            Huruf Kapital Tiap Kata
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text color */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Warna:</span>
        <input
          type="color"
          className="size-6 cursor-pointer rounded border"
          title="Warna Teks"
          value={(editor.getAttributes("textStyle").color as string | undefined) ?? "#000000"}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </div>

      {/* Sorot teks (highlight) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Sorot Teks"
            className={cn(
              "flex size-7 cursor-pointer items-center justify-center rounded text-sm transition-colors",
              editor.isActive("highlight") ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            <Highlighter className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {HIGHLIGHT_COLORS.map((c) => (
            <DropdownMenuItem
              key={c.value}
              className="cursor-pointer gap-2"
              onClick={() => editor.chain().focus().setHighlight({ color: c.value }).run()}
            >
              <span className="size-4 rounded border" style={{ backgroundColor: c.value }} />
              {c.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
          >
            <RemoveFormatting className="size-4" />
            Hapus Sorotan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Rata Kiri">
        <AlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Rata Tengah">
        <AlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Rata Kanan">
        <AlignRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Rata Penuh">
        <AlignJustify className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().indent().run()} title="Tambah Indent (menjorok)">
        <IndentIncrease className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().outdent().run()} title="Kurangi Indent">
        <IndentDecrease className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().insertTab().run()} title="Tab (sisip tab di posisi kursor)">
        <ArrowRightToLine className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Daftar Bullet">
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Daftar Bernomor">
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      {/* Sisipkan daftar bernomor yang melanjutkan angka daftar sebelumnya.
          Bila kursor di teks biasa, daftar baru dibuat di baris bawah tanpa
          mengubah teks yang ada. Bila kursor sudah di daftar bernomor, angkanya
          disetel agar melanjutkan daftar sebelumnya. */}
      <ToolbarButton
        onClick={() => {
          const ok = editor.chain().focus().continueNumbering().run();
          if (!ok) {
            toast.info("Tidak dapat menyisipkan penomoran di posisi ini.");
          }
        }}
        title="Lanjutkan Penomoran (sambung angka sebelumnya)"
      >
        <ListPlus className="size-3.5" />
      </ToolbarButton>
      {/* Daftar bertingkat: jadikan baris ini sub-daftar (turun satu tingkat).
          Sama seperti menekan Tab di dalam daftar. Nonaktif bila kursor tidak
          sedang berada di dalam daftar. */}
      <ToolbarButton
        onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
        disabled={!editor.can().sinkListItem("listItem")}
        title="Daftar Bertingkat: turunkan satu tingkat (Tab)"
      >
        <ListTree className="size-3.5" />
      </ToolbarButton>
      {/* Naikkan sub-daftar satu tingkat (seperti Shift+Tab). */}
      <ToolbarButton
        onClick={() => editor.chain().focus().liftListItem("listItem").run()}
        disabled={!editor.can().liftListItem("listItem")}
        title="Daftar Bertingkat: naikkan satu tingkat (Shift+Tab)"
      >
        <IndentDecrease className="size-3.5" />
      </ToolbarButton>
      {/* Gaya penanda daftar (nomor/bullet), mirip Microsoft Word */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Gaya Daftar (nomor / bullet)"
            className="inline-flex h-7 cursor-pointer items-center justify-center rounded px-1 hover:bg-muted"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Gaya Nomor
          </div>
          {NUMBER_STYLES.map((s) => (
            <DropdownMenuItem
              key={s.value}
              className="cursor-pointer"
              onClick={() => {
                if (!editor.isActive("orderedList")) {
                  editor.chain().focus().toggleOrderedList().run();
                }
                editor.chain().focus().setListStyleType(s.value).run();
              }}
            >
              {s.label}
            </DropdownMenuItem>
          ))}
          <div className="mt-1 border-t px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">
            Gaya Bullet
          </div>
          {BULLET_STYLES.map((s) => (
            <DropdownMenuItem
              key={s.value}
              className="cursor-pointer"
              onClick={() => {
                if (!editor.isActive("bulletList")) {
                  editor.chain().focus().toggleBulletList().run();
                }
                editor.chain().focus().setListStyleType(s.value).run();
              }}
            >
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Kutipan">
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Garis Horizontal">
        <Minus className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setPageBreak().run()} title="Sisipkan Pemutus Halaman">
        <SeparatorHorizontal className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Table & Link */}
      <TableGridPicker editor={editor}>
        <button
          type="button"
          title="Sisipkan Tabel"
          className="flex size-7 cursor-pointer items-center justify-center rounded text-sm transition-colors hover:bg-accent"
        >
          <TableIcon className="size-3.5" />
        </button>
      </TableGridPicker>

      {/* Posisi vertikal teks di dalam sel tabel (hanya aktif saat berada di tabel) */}
      <ToolbarButton
        onClick={() => setCellVerticalAlign("top")}
        disabled={!isInTable}
        active={isInTable && currentCellVAlign === "top"}
        title="Rata Atas (dalam sel tabel)"
      >
        <AlignVerticalJustifyStart className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => setCellVerticalAlign("middle")}
        disabled={!isInTable}
        active={isInTable && currentCellVAlign === "middle"}
        title="Rata Tengah Vertikal (dalam sel tabel)"
      >
        <AlignVerticalJustifyCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => setCellVerticalAlign("bottom")}
        disabled={!isInTable}
        active={isInTable && currentCellVAlign === "bottom"}
        title="Rata Bawah (dalam sel tabel)"
      >
        <AlignVerticalJustifyEnd className="size-3.5" />
      </ToolbarButton>

      {/* Sisip gambar: unggah dari berkas lokal atau dari URL */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { void handleImageFileSelected(e); }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Sisipkan Gambar (stempel, tanda tangan)"
            disabled={isUploadingImage}
            className={cn(
              "flex size-7 cursor-pointer items-center justify-center rounded text-sm transition-colors hover:bg-accent",
              isUploadingImage && "cursor-not-allowed opacity-40",
            )}
          >
            {isUploadingImage ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            className="cursor-pointer gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Unggah dari perangkat
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer gap-2" onClick={insertImageFromUrl}>
            <LinkIcon className="size-4" />
            Sisipkan dari URL
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Impor dari Word (.docx): mengganti isi editor dengan isi dokumen */}
      <input
        ref={docxInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => { void handleDocxFileSelected(e); }}
      />
      <ToolbarButton
        onClick={() => docxInputRef.current?.click()}
        disabled={isImportingDocx}
        title="Impor dari Word (.docx) — mengganti isi surat"
      >
        {isImportingDocx ? <Loader2 className="size-3.5 animate-spin" /> : <WordIcon className="size-3.5" />}
      </ToolbarButton>

      <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Sisipkan Link">
        <LinkIcon className="size-3.5" />
      </ToolbarButton>

      {/* Karakter khusus */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Sisipkan Karakter Khusus"
            className="flex size-7 cursor-pointer items-center justify-center rounded text-sm transition-colors hover:bg-accent"
          >
            <Omega className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="grid grid-cols-6 gap-1 p-1">
            {SPECIAL_CHARS.map((ch) => (
              <button
                key={ch}
                type="button"
                title={`Sisipkan ${ch}`}
                onClick={() => editor.chain().focus().insertContent(ch).run()}
                className="flex h-7 cursor-pointer items-center justify-center rounded text-sm transition-colors hover:bg-accent"
              >
                {ch}
              </button>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Frasa cepat */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Sisipkan Frasa Cepat"
            className="flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-xs transition-colors hover:bg-accent"
          >
            <MessageSquarePlus className="size-3.5" />
            <span className="hidden sm:inline">Frasa</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-72">
          {QUICK_PHRASES.map((p) => (
            <DropdownMenuItem
              key={p.label}
              className="cursor-pointer"
              onClick={() => editor.chain().focus().insertContent(`${p.text} `).run()}
            >
              {p.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Variabel / Mail Merge: sisipkan placeholder yang terisi otomatis dari data surat */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Sisipkan Variabel"
            className="flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-xs transition-colors hover:bg-accent"
          >
            <Braces className="size-3.5" />
            <span className="hidden sm:inline">Variabel</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-72">
          {LETTER_VARIABLES.map((v) => (
            <DropdownMenuItem
              key={v.key}
              className="cursor-pointer flex-col items-start gap-0"
              onClick={() => editor.chain().focus().insertContent(v.token).run()}
            >
              <span className="font-medium">{v.label}</span>
              <span className="text-xs text-muted-foreground">{v.token}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Urungkan">
        <Undo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ulangi">
        <Redo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Hapus Pemformatan">
        <RemoveFormatting className="size-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton onClick={onToggleSearch} title="Cari & Ganti">
        <Search className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={onToggleFullscreen}
        active={isFullscreen}
        title={isFullscreen ? "Keluar Layar Penuh" : "Mode Layar Penuh"}
      >
        {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
      </ToolbarButton>
    </div>
  );
}

// Bilah Cari & Ganti: menyorot kecocokan, navigasi antar hasil, dan mengganti
// satu per satu atau sekaligus. Ditampilkan di atas area ketik saat diaktifkan.
function SearchReplaceBar({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const storage = (
    editor.storage as unknown as { searchReplace: SearchReplaceStorage }
  ).searchReplace;
  const total = storage.results.length;
  const currentPos = total === 0 ? 0 : storage.currentIndex + 1;

  // Fokuskan kolom pencarian saat bilah muncul.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = (term: string, cs: boolean) => {
    editor.chain().setSearchCaseSensitive(cs).setSearchTerm(term).run();
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    runSearch(value, caseSensitive);
  };

  const toggleCase = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    runSearch(searchTerm, next);
  };

  const handleClose = () => {
    editor.chain().clearSearch().focus().run();
    onClose();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-1">
        <Search className="size-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) editor.chain().goToPreviousResult().run();
              else editor.chain().goToNextResult().run();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              handleClose();
            }
          }}
          placeholder="Cari teks..."
          className="h-8 w-40 text-sm"
        />
      </div>

      <span className="min-w-16 text-xs text-muted-foreground">
        {total === 0 ? "Tidak ada" : `${currentPos} dari ${total}`}
      </span>

      <ToolbarButton
        onClick={() => editor.chain().goToPreviousResult().run()}
        disabled={total === 0}
        title="Hasil sebelumnya"
      >
        <ChevronUp className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().goToNextResult().run()}
        disabled={total === 0}
        title="Hasil berikutnya"
      >
        <ChevronDown className="size-3.5" />
      </ToolbarButton>

      <button
        type="button"
        onClick={toggleCase}
        title="Bedakan huruf besar/kecil"
        className={cn(
          "flex h-8 cursor-pointer items-center rounded px-2 text-xs font-medium transition-colors",
          caseSensitive ? "bg-primary text-primary-foreground" : "hover:bg-accent",
        )}
      >
        Aa
      </button>

      <div className="flex items-center gap-1">
        <Input
          value={replaceTerm}
          onChange={(e) => setReplaceTerm(e.target.value)}
          placeholder="Ganti dengan..."
          className="h-8 w-40 text-sm"
        />
        <button
          type="button"
          onClick={() => editor.chain().replaceCurrent(replaceTerm).run()}
          disabled={total === 0}
          className={cn(
            "flex h-8 cursor-pointer items-center rounded px-2 text-xs font-medium transition-colors hover:bg-accent",
            total === 0 && "cursor-not-allowed opacity-40",
          )}
        >
          Ganti
        </button>
        <button
          type="button"
          onClick={() => editor.chain().replaceAll(replaceTerm).run()}
          disabled={total === 0}
          className={cn(
            "flex h-8 cursor-pointer items-center rounded px-2 text-xs font-medium transition-colors hover:bg-accent",
            total === 0 && "cursor-not-allowed opacity-40",
          )}
        >
          Ganti Semua
        </button>
      </div>

      <button
        type="button"
        onClick={handleClose}
        title="Tutup"
        className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded transition-colors hover:bg-accent"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export default function LetterEditor({ content, onChange, readonly = false, minHeight = 400, paperMode = false, autoSaveStatus = "idle", autoSaveActive = false, previewDetail }: LetterEditorProps) {
  const editor = useEditor({
    extensions: [
      // Daftar (bullet & numbering) memakai perilaku bawaan StarterKit sepenuhnya
      // agar Enter otomatis membuat item baru dan Backspace/Tab bekerja normal
      // seperti pengolah kata pada umumnya.
      StarterKit.configure({ link: { openOnClick: false } }),
      CharacterCount,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight.configure({ types: ["paragraph", "heading"] }),
      Indent,
      HSpace,
      ListStyle,
      TabKey,
      SearchReplace,
      PageBreak,
      Highlight.configure({ multicolor: true }),
      Superscript,
      Subscript,
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
    ],
    content,
    editable: !readonly,
    editorProps: {
      // handleKeyDown adalah titik intersepsi paling awal di ProseMirror; ia
      // berjalan SEBELUM semua keymap ekstensi maupun keymap bawaan editor.
      // Kita pakai untuk memaksa perilaku daftar: saat kursor berada di dalam
      // bullet/numbering dan menekan Enter, buat item/nomor baru
      // (splitListItem). Bila item saat ini kosong, keluarkan dari daftar
      // (liftListItem) seperti pengolah kata pada umumnya. Ini memastikan Enter
      // tidak pernah "jatuh" ke pembuatan paragraf biasa.
      handleKeyDown: (_view, event) => {
        if (
          event.key !== "Enter" ||
          event.shiftKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        ) {
          return false;
        }
        const ed = editorRef.current;
        if (!ed) return false;
        const inList =
          ed.isActive("listItem") ||
          ed.isActive("bulletList") ||
          ed.isActive("orderedList");
        if (!inList) return false;
        // Coba buat item baru; bila gagal (mis. item kosong), naikkan keluar.
        const handled =
          ed.commands.splitListItem("listItem") ||
          ed.commands.liftListItem("listItem");
        return handled;
      },
    },
    onUpdate: ({ editor: e }) => {
      // Simpan HTML terakhir yang berasal dari editor sendiri agar efek sinkron
      // di bawah tidak menuliskannya kembali (yang bisa mereset posisi kursor
      // dan membuat Enter/list terasa "tidak berfungsi").
      const html = e.getHTML();
      lastEmittedHtml.current = html;
      onChange(html);
    },
  });

  // Referensi editor agar bisa dipakai di dalam handleKeyDown (yang dibuat saat
  // useEditor dipanggil, sebelum variabel `editor` tersedia).
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  editorRef.current = editor;

  // HTML terakhir yang kita kirim lewat onUpdate. Dipakai untuk membedakan
  // perubahan dari dalam editor vs. perubahan dari luar (mis. ganti surat).
  const lastEmittedHtml = useRef<string | null>(null);

  // Sync content from outside (e.g. when switching letters).
  // Penting: JANGAN menuliskan ulang konten yang baru saja berasal dari editor
  // sendiri (via onUpdate). Menyetel ulang konten pada tiap ketukan akan
  // mereset posisi kursor sehingga Enter/daftar terasa tidak berfungsi.
  useEffect(() => {
    if (!editor) return;
    // Saat pengguna sedang mengetik, editor dalam keadaan fokus. JANGAN PERNAH
    // menuliskan ulang isinya karena akan mereset posisi kursor sehingga Enter
    // di dalam daftar (bullet/numbering) terasa "tidak berfungsi". Perubahan
    // dari luar (mis. membuka surat lain) selalu terjadi saat editor tidak
    // fokus, jadi aman untuk diabaikan di sini.
    if (editor.isFocused) return;
    // Perubahan berasal dari editor sendiri -> abaikan.
    if (content === lastEmittedHtml.current) return;
    // Perubahan nyata dari luar (mis. buka surat lain) -> setel tanpa memicu
    // event update (emitUpdate=false) agar tidak menimbulkan loop.
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Elemen lembar yang diukur untuk paginasi. Dalam mode WYSIWYG penuh, elemen
  // ini berisi kop + isi (editor) + tanda tangan dengan tata letak PERSIS sama
  // seperti dokumen resmi, sehingga batas & jumlah halaman dihitung langsung di
  // sini dan dijamin identik dengan Pratinjau/Cetak.
  const measureRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  // Segmen halaman hasil paginasi lembar editor (sama seperti Pratinjau/Cetak).
  const [pageSegments, setPageSegments] = useState<PageSegment[]>([]);

  // Boolean stabil untuk dependensi efek (objek previewDetail berganti tiap
  // render, jadi tidak dipakai langsung sebagai dependensi).
  const hasPreviewDetail = !!previewDetail;

  // Posisi (doc) node spasi-mendatar yang sedang digeser lewat mistar.
  const hspaceDragPos = useRef<number | null>(null);
  // Jarak horizontal (px) kursor dari tepi kiri area teks saat mulai menggeser.
  // Dipakai agar lebar spasi dihitung relatif terhadap posisi kursor, bukan
  // terhadap margin kiri, sehingga teks berhenti tepat di garis bantu walau
  // kursor berada di tengah baris (mis. di kiri karakter ":").
  const cursorOffsetPx = useRef(0);
  // Menandai bahwa geseran penanda baris-pertama saat ini menyasar sebuah
  // daftar (nomor/bullet), bukan indent teks biasa.
  const listDragActive = useRef(false);
  // Posisi X (px, dari tepi kiri lembar) garis bantu putus-putus saat penanda
  // baris-pertama digeser. null = tidak tampil.
  const [firstLineGuideX, setFirstLineGuideX] = useState<number | null>(null);

  // Status bilah Cari & Ganti dan mode layar penuh.
  const [showSearch, setShowSearch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Margin kiri/kanan lembar (px), dikendalikan oleh mistar (mode kertas).
  // Nilai awal disamakan dengan margin dokumen resmi (kiri & kanan 25mm) agar
  // lebar area teks — yang menentukan titik pemenggalan baris — PERSIS sama
  // dengan Pratinjau/Cetak. Inilah dasar mode WYSIWYG batas halaman.
  const [leftMargin, setLeftMargin] = useState(() => DEFAULT_MARGIN_X_PX);
  const [rightMargin, setRightMargin] = useState(() => DEFAULT_MARGIN_X_PX);

  // Keluar dari layar penuh dengan tombol Escape.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  // Ukur lembar editor dan hitung segmen halaman memakai fungsi paginasi BERSAMA
  // (computePageSegments) — sama persis seperti Pratinjau/Cetak. Karena dalam
  // mode WYSIWYG penuh lembar ini sudah berisi kop + isi + tanda tangan dengan
  // tata letak identik dokumen resmi, batas & jumlah halaman dijamin sama.
  useEffect(() => {
    if (!paperMode) return;
    const el = measureRef.current;
    if (!el) return;

    let maxPages = 0;
    const measure = () => {
      setContentHeight(el.scrollHeight);
      const segs = computePageSegments(el, A4_HEIGHT_PX);
      // Simpan hasil dengan halaman terbanyak (gambar/QR/logo bisa menambah
      // tinggi setelah render pertama sehingga jumlah halaman bertambah).
      if (segs.length >= maxPages) {
        maxPages = segs.length;
        setPageSegments(segs);
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Ukur ulang setelah gambar/logo & QR selesai dimuat.
    const imgs = Array.from(el.querySelectorAll("img"));
    imgs.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", measure);
        img.addEventListener("error", measure);
      }
    });
    const timers = [200, 600, 1200].map((ms) => window.setTimeout(measure, ms));
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      imgs.forEach((img) => {
        img.removeEventListener("load", measure);
        img.removeEventListener("error", measure);
      });
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [paperMode, hasPreviewDetail, content, editor]);

  if (!editor) return null;

  const toggleSearch = () => setShowSearch((v) => !v);
  const toggleFullscreen = () => setIsFullscreen((v) => !v);

  // Penanganan Enter untuk daftar (bullet & numbering) pada fase "capture",
  // yaitu SEBELUM event sampai ke elemen mana pun di dalam editor. Ini titik
  // paling awal yang bisa kita kendalikan dari React, sehingga aman meski ada
  // penangkap tombol lain di halaman. Saat kursor berada di dalam daftar dan
  // Enter ditekan tanpa modifier, kita paksa membuat item/nomor baru
  // (splitListItem). Bila item kosong, keluar dari daftar (liftListItem).
  const handleEnterForList = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key !== "Enter" ||
      e.shiftKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.nativeEvent.isComposing
    ) {
      return;
    }
    const inList =
      editor.isActive("listItem") ||
      editor.isActive("bulletList") ||
      editor.isActive("orderedList");
    if (!inList) return;
    e.preventDefault();
    e.stopPropagation();
    if (!editor.commands.splitListItem("listItem")) {
      editor.commands.liftListItem("listItem");
    }
  };

  // Kelas pembungkus: saat layar penuh, editor menutupi seluruh layar.
  // Catatan: JANGAN pakai `overflow-hidden` pada mode biasa (di dalam dialog),
  // agar bilah alat (toolbar) bisa "menempel" (sticky) di atas saat menggulir
  // surat yang panjang. Saat layar penuh tetap pakai overflow-hidden karena
  // area isi memiliki penggulung (scroll) sendiri.
  const wrapperClass = cn(
    "flex flex-col rounded-lg border",
    isFullscreen
      ? "fixed inset-0 z-50 overflow-hidden rounded-none bg-background"
      : "overflow-visible",
  );

  // Mode kertas: lembar tampil seperti A4 sesungguhnya. Bila `previewDetail`
  // tersedia, editor menampilkan tata letak LENGKAP (kop + isi yang bisa diketik
  // + tanda tangan) PERSIS seperti hasil cetak, dan garis batas halaman dihitung
  // langsung pada lembar itu dengan fungsi paginasi yang sama dengan
  // Pratinjau/Cetak — sehingga posisi & jumlah halaman dijamin identik.
  if (paperMode) {
    const pageCount = Math.max(1, pageSegments.length);
    const isAccuratePageCount = pageSegments.length > 0;

    // Garis batas halaman = awal tiap segmen halaman ke-2 dan seterusnya.
    // Koordinat `start` relatif terhadap tepi atas lembar (measureRef), sama
    // seperti posisi absolut anak di dalamnya, jadi bisa dipakai langsung.
    const breakLines = pageSegments
      .slice(1)
      .map((seg, i) => ({ offset: seg.start, page: i + 2 }))
      .filter((b) => b.offset > 0 && b.offset <= contentHeight + 1);

    // Kelas gaya untuk area ketik (isi surat) di dalam lembar. Sama seperti
    // dokumen resmi ditambah gaya khusus editor (kursor, sorotan cari, dsb).
    const bodyEditClass = cn(
      LETTER_BODY_CLASS,
      "max-w-none focus-within:outline-none",
      "[&_.tiptap]:outline-none [&_.tiptap]:min-h-[120px] [&_.tiptap]:text-black",
      "[&_p]:mt-0 [&_h1]:mt-0 [&_h2]:mt-0 [&_h3]:mt-0",
      "[&_h1]:whitespace-pre-wrap [&_h2]:whitespace-pre-wrap [&_h3]:whitespace-pre-wrap",
      "[&_li]:pl-1",
      "[&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-primary",
      "[&_.search-result]:rounded [&_.search-result]:bg-yellow-300/70",
      "[&_.search-result-current]:rounded [&_.search-result-current]:bg-orange-400/80",
      "[&_.page-break]:my-3 [&_.page-break]:h-0 [&_.page-break]:border-t-2 [&_.page-break]:border-dashed [&_.page-break]:border-blue-400",
    );

    return (
      <div className={wrapperClass} onKeyDownCapture={handleEnterForList}>
        {!readonly && (
          <EditorToolbar
            editor={editor}
            onToggleSearch={toggleSearch}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
          />
        )}
        {!readonly && showSearch && (
          <SearchReplaceBar editor={editor} onClose={() => setShowSearch(false)} />
        )}
        {!readonly && (
          <div className="border-b bg-muted/40 pb-1">
            <EditorRuler
              widthPx={A4_WIDTH_PX}
              leftMargin={leftMargin}
              rightMargin={rightMargin}
              firstLineIndent={0}
              onLeftMarginChange={setLeftMargin}
              onRightMarginChange={setRightMargin}
              onFirstLineDragStart={() => {
                // Bila kursor berada di dalam daftar (nomor/bullet), penanda
                // ini menggeser SELURUH daftar seperti di Word. Selain itu,
                // perilaku lama tetap: menyisipkan spasi-mendatar untuk indent
                // teks biasa.
                const inList =
                  editor.isActive("orderedList") ||
                  editor.isActive("bulletList");
                if (inList) {
                  listDragActive.current = true;
                  return;
                }
                listDragActive.current = false;
                const pos = editor.state.selection.from;
                // Ukur jarak horizontal kursor dari tepi kiri area teks. Lebar
                // spasi nanti dikurangi nilai ini agar teks berhenti tepat di
                // posisi penanda/garis bantu, bukan meleset karena kursor sudah
                // berada di tengah baris (mis. di kiri karakter ":").
                try {
                  const coords = editor.view.coordsAtPos(pos);
                  const editorLeft = editor.view.dom.getBoundingClientRect().left;
                  cursorOffsetPx.current = Math.max(0, coords.left - editorLeft);
                } catch {
                  cursorOffsetPx.current = 0;
                }
                editor.chain().focus().insertHSpace(0).run();
                hspaceDragPos.current = pos;
              }}
              onFirstLineIndentChange={(px) => {
                if (listDragActive.current) {
                  // Terjemahkan geseran (px) menjadi tingkat indent daftar.
                  const level = Math.round(px / LIST_INDENT_PX_PER_LEVEL);
                  editor.commands.setListIndentLevel(level);
                  return;
                }
                const pos = hspaceDragPos.current;
                if (pos === null) return;
                // Kurangi offset kursor agar teks setelah kursor berhenti tepat
                // di garis bantu, sama seperti saat kursor di kiri huruf biasa.
                const width = Math.max(0, px - cursorOffsetPx.current);
                editor.commands.setHSpaceWidth(pos, width);
              }}
              onFirstLineDragEnd={() => {
                if (listDragActive.current) {
                  listDragActive.current = false;
                  return;
                }
                const pos = hspaceDragPos.current;
                if (pos !== null) {
                  // Bila lebar akhirnya 0, buang node agar tidak menyisakan
                  // spasi kosong yang tak terlihat.
                  const node = editor.state.doc.nodeAt(pos);
                  if (node && node.type.name === "hspace" &&
                      ((node.attrs.width as number) || 0) === 0) {
                    editor.commands.removeHSpace(pos);
                  }
                }
                hspaceDragPos.current = null;
              }}
              onFirstLineGuide={setFirstLineGuideX}
            />
          </div>
        )}
        <div className="flex flex-1 justify-center overflow-auto bg-muted/40 p-4">
          <div
            ref={measureRef}
            className="relative bg-white shadow-lg ring-1 ring-black/5"
            style={{
              width: A4_WIDTH_PX,
              minHeight: A4_HEIGHT_PX,
              paddingLeft: leftMargin,
              paddingRight: rightMargin,
              // Padding vertikal disamakan dengan dokumen resmi (atas 20mm,
              // bawah 30mm) agar paginasi identik dengan Pratinjau/Cetak.
              paddingTop: WYSIWYG_PAD_TOP_PX,
              paddingBottom: WYSIWYG_PAD_BOTTOM_PX,
              alignSelf: "flex-start",
              // Font & spasi baris identik dokumen resmi (diwarisi oleh kop &
              // tanda tangan). Isi surat menimpa dengan kelas body-nya sendiri.
              fontFamily: LETTER_FONT_FAMILY,
              fontSize: "12pt",
              lineHeight: 1.8,
              color: "#000",
            }}
          >
            {/* Kop surat (baca-saja) — persis seperti hasil cetak. */}
            {previewDetail && (
              <div className="select-none" aria-hidden>
                <LetterHeaderBlocks detail={previewDetail} />
              </div>
            )}

            {/* Isi surat yang bisa diketik. */}
            <div data-letter-body className={bodyEditClass} style={{ textAlign: "justify" }}>
              <EditorContent editor={editor} />
            </div>

            {/* Blok tanda tangan (baca-saja) — persis seperti hasil cetak. */}
            {previewDetail && (
              <div className="select-none" aria-hidden>
                <LetterSignatureBlocks detail={previewDetail} forCapture />
              </div>
            )}

            {/* Garis batas halaman */}
            {breakLines.map((b, i) => (
              <div
                key={i}
                className="pointer-events-none absolute left-0 right-0 z-10"
                style={{ top: b.offset }}
              >
                <div className="border-t-2 border-dashed border-red-400/70" />
                <div className="flex justify-end pr-2">
                  <span className="-mt-3 rounded bg-red-400/90 px-2 py-0.5 text-[11px] font-medium text-white shadow">
                    Halaman {b.page}
                  </span>
                </div>
              </div>
            ))}

            {/* Garis bantu vertikal putus-putus saat menggeser penanda mistar,
                agar pengguna bisa memastikan lurus dengan teks pedoman. */}
            {firstLineGuideX !== null && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-20 border-l border-dashed border-primary/70"
                style={{ left: firstLineGuideX }}
              />
            )}
          </div>
        </div>
        {!readonly && (
          <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
            <span>{editor.storage.characterCount?.characters?.() ?? 0} karakter</span>
            <div className="flex items-center gap-1.5">
              {autoSaveStatus === "saving" && (<><Loader2 className="size-3.5 animate-spin" /><span>Menyimpan...</span></>)}
              {autoSaveStatus === "saved" && (<><Check className="size-3.5 text-green-600" /><span>Tersimpan otomatis</span></>)}
              {autoSaveStatus === "error" && (<><AlertCircle className="size-3.5 text-destructive" /><span>Gagal menyimpan otomatis</span></>)}
              {autoSaveStatus === "idle" && autoSaveActive && (<><CloudUpload className="size-3.5" /><span>Autosave aktif</span></>)}
            </div>
            {isAccuratePageCount ? (
              <span>{pageCount} halaman</span>
            ) : (
              <span title="Menghitung halaman...">
                ± {pageCount} halaman
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={wrapperClass} onKeyDownCapture={handleEnterForList}>
      {!readonly && (
        <EditorToolbar
          editor={editor}
          onToggleSearch={toggleSearch}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
        />
      )}
      {!readonly && showSearch && (
        <SearchReplaceBar editor={editor} onClose={() => setShowSearch(false)} />
      )}
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm max-w-none flex-1 overflow-y-auto p-4 focus-within:outline-none",
          "[&_.tiptap]:outline-none [&_.tiptap]:[tab-size:4]",
          "[&_.tiptap_p]:whitespace-pre-wrap [&_.tiptap_h1]:whitespace-pre-wrap [&_.tiptap_h2]:whitespace-pre-wrap [&_.tiptap_h3]:whitespace-pre-wrap",
          "[&_.tiptap_p]:mt-0 [&_.tiptap_h1]:mt-0 [&_.tiptap_h2]:mt-0 [&_.tiptap_h3]:mt-0",
          "[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-[1.5em] [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-[1.5em] [&_.tiptap_li]:my-1 [&_.tiptap_li]:pl-1",
          "[&_.tiptap_ul_ul]:list-[circle] [&_.tiptap_ul_ul_ul]:list-[square] [&_.tiptap_ol_ol]:list-[lower-alpha] [&_.tiptap_ol_ol_ol]:list-[lower-roman]",
          "[&_table]:w-full [&_table]:border-collapse",
          "[&_td]:border [&_td]:border-border [&_td]:p-2",
          "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:font-semibold",
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:my-2 [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-primary",
          "[&_mark]:rounded [&_mark]:px-0.5",
          "[&_.search-result]:rounded [&_.search-result]:bg-yellow-300/70",
          "[&_.search-result-current]:rounded [&_.search-result-current]:bg-orange-400/80",
          "[&_.page-break]:my-3 [&_.page-break]:h-0 [&_.page-break]:border-t-2 [&_.page-break]:border-dashed [&_.page-break]:border-blue-400",
        )}
        style={{ minHeight: isFullscreen ? undefined : minHeight }}
      />
      {!readonly && (
        <div className="border-t bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
          {editor.storage.characterCount?.characters?.() ?? 0} karakter
        </div>
      )}
    </div>
  );
}

export { useEditor };
