import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Sisipkan pemutus halaman manual pada posisi kursor. */
      setPageBreak: () => ReturnType;
    };
  }
}

/**
 * Node pemutus halaman manual. Di editor ditampilkan sebagai garis putus-putus
 * berlabel, dan saat dicetak memaksa isi berikutnya pindah ke halaman baru
 * lewat properti CSS `break-after: page`.
 */
export const PageBreak = Node.create({
  name: "pageBreak",

  group: "block",

  // Node kosong yang berdiri sendiri (tidak berisi konten lain).
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      // Kompatibel dengan gaya lama yang memakai class page-break.
      { tag: "div.page-break" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "true",
        class: "page-break",
        style: "break-after: page; page-break-after: always;",
      }),
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({ type: this.name })
            // Pastikan ada paragraf setelahnya agar kursor bisa lanjut mengetik.
            .run();
        },
    };
  },
});

export default PageBreak;
