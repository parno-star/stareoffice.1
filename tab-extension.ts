import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tabKey: {
      /** Sisipkan karakter tab pada posisi kursor. */
      insertTab: () => ReturnType;
    };
  }
}

/**
 * Mengaktifkan fungsi Tab layaknya pengolah kata:
 * - Di dalam daftar (bullet/numbering): Tab membuat sub-daftar bertingkat
 *   (sink), Shift+Tab menaikkan satu tingkat (lift) — seperti Microsoft Word.
 * - Di luar daftar: Tab menyisipkan karakter tab (\t) tepat pada posisi kursor
 *   sehingga hanya teks setelah kursor yang bergeser.
 *
 * Agar tab benar-benar tampil, area editor perlu memakai `white-space:
 * pre-wrap` dan `tab-size` (diatur pada className EditorContent).
 *
 * Di dalam tabel, Tab dibiarkan berpindah antar sel (perilaku bawaan) dengan
 * mengembalikan false sehingga penanganan tabel yang berjalan.
 */
export const TabKey = Extension.create({
  name: "tabKey",
  // Prioritas tinggi agar penanganan sub-daftar berjalan sebelum shortcut Tab
  // bawaan listItem.
  priority: 1000,

  addCommands() {
    return {
      insertTab:
        () =>
        ({ editor, commands }) => {
          if (editor.isActive("table")) return false;
          return commands.insertContent("\t");
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { editor } = this;
        if (editor.isActive("table")) return false;
        // Dalam daftar: biarkan perilaku bawaan (Tab = sub-daftar).
        if (
          editor.isActive("listItem") ||
          editor.isActive("bulletList") ||
          editor.isActive("orderedList")
        ) {
          return false;
        }
        return editor.commands.insertTab();
      },
      // Shift+Tab di luar daftar: hapus satu karakter tab sebelum kursor bila
      // ada. Di dalam daftar/tabel biarkan perilaku bawaan.
      "Shift-Tab": () => {
        const { editor } = this;
        if (editor.isActive("table")) return false;
        if (
          editor.isActive("listItem") ||
          editor.isActive("bulletList") ||
          editor.isActive("orderedList")
        ) {
          return false;
        }
        const { state } = editor;
        const { from, empty } = state.selection;
        if (!empty || from === 0) return false;
        const charBefore = state.doc.textBetween(from - 1, from);
        if (charBefore !== "\t") return false;
        return editor.commands.deleteRange({ from: from - 1, to: from });
      },
    };
  },
});

export default TabKey;
