import { Extension, type Range } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type SearchReplaceOptions = {
  /** CSS class for every match. */
  searchResultClass: string;
  /** CSS class for the currently focused match. */
  searchResultCurrentClass: string;
};

export type SearchReplaceStorage = {
  searchTerm: string;
  caseSensitive: boolean;
  results: Range[];
  currentIndex: number;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      /** Set the search term and (re)compute matches. */
      setSearchTerm: (term: string) => ReturnType;
      /** Toggle case sensitivity of the search. */
      setSearchCaseSensitive: (value: boolean) => ReturnType;
      /** Move selection to the next match. */
      goToNextResult: () => ReturnType;
      /** Move selection to the previous match. */
      goToPreviousResult: () => ReturnType;
      /** Replace the current match with the given text. */
      replaceCurrent: (replaceWith: string) => ReturnType;
      /** Replace every match with the given text. */
      replaceAll: (replaceWith: string) => ReturnType;
      /** Clear the current search and its highlights. */
      clearSearch: () => ReturnType;
    };
  }
}

const searchReplacePluginKey = new PluginKey("searchReplace");

// Ambil storage ekstensi ini dengan tipe yang benar dari editor.
function getStorage(
  editor: import("@tiptap/core").Editor,
): SearchReplaceStorage {
  return (editor.storage as unknown as { searchReplace: SearchReplaceStorage })
    .searchReplace;
}

// Escape user input so it can be used inside a RegExp literally.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Kumpulkan seluruh kecocokan (rentang posisi) di dalam dokumen.
function findMatches(
  doc: import("@tiptap/pm/model").Node,
  searchTerm: string,
  caseSensitive: boolean,
): Range[] {
  const results: Range[] = [];
  if (!searchTerm) return results;

  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapeRegExp(searchTerm), flags);

  // Telusuri setiap node teks dan petakan offset ke posisi absolut dokumen.
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      results.push({ from, to });
      // Hindari loop tak berujung pada kecocokan kosong.
      if (match.index === regex.lastIndex) regex.lastIndex++;
    }
  });

  return results;
}

/**
 * Ekstensi Cari & Ganti untuk editor surat. Menyorot semua kecocokan,
 * mendukung navigasi antar hasil, serta ganti satu per satu atau sekaligus.
 */
export const SearchReplace = Extension.create<
  SearchReplaceOptions,
  SearchReplaceStorage
>({
  name: "searchReplace",

  addOptions() {
    return {
      searchResultClass: "search-result",
      searchResultCurrentClass: "search-result-current",
    };
  },

  addStorage() {
    return {
      searchTerm: "",
      caseSensitive: false,
      results: [],
      currentIndex: 0,
    };
  },

  addCommands() {
    const recompute = () => {
      const { editor } = this;
      const storage = getStorage(editor);
      storage.results = findMatches(
        editor.state.doc,
        storage.searchTerm,
        storage.caseSensitive,
      );
      if (storage.currentIndex >= storage.results.length) {
        storage.currentIndex = 0;
      }
    };

    return {
      setSearchTerm:
        (term: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = getStorage(editor);
          storage.searchTerm = term;
          storage.currentIndex = 0;
          recompute();
          // Picu ulang render decoration lewat transaksi kosong.
          if (dispatch) dispatch(tr);
          return true;
        },

      setSearchCaseSensitive:
        (value: boolean) =>
        ({ editor, tr, dispatch }) => {
          const storage = getStorage(editor);
          storage.caseSensitive = value;
          storage.currentIndex = 0;
          recompute();
          if (dispatch) dispatch(tr);
          return true;
        },

      goToNextResult:
        () =>
        ({ editor, tr, dispatch }) => {
          const storage = getStorage(editor);
          if (storage.results.length === 0) return false;
          storage.currentIndex =
            (storage.currentIndex + 1) % storage.results.length;
          if (dispatch) dispatch(tr);
          return true;
        },

      goToPreviousResult:
        () =>
        ({ editor, tr, dispatch }) => {
          const storage = getStorage(editor);
          if (storage.results.length === 0) return false;
          storage.currentIndex =
            (storage.currentIndex - 1 + storage.results.length) %
            storage.results.length;
          if (dispatch) dispatch(tr);
          return true;
        },

      replaceCurrent:
        (replaceWith: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = getStorage(editor);
          const match = storage.results[storage.currentIndex];
          if (!match) return false;
          tr.insertText(replaceWith, match.from, match.to);
          if (dispatch) dispatch(tr);
          // Hitung ulang setelah dokumen berubah.
          recompute();
          if (storage.currentIndex >= storage.results.length) {
            storage.currentIndex = 0;
          }
          return true;
        },

      replaceAll:
        (replaceWith: string) =>
        ({ editor, tr, dispatch }) => {
          const storage = getStorage(editor);
          if (storage.results.length === 0) return false;
          // Ganti dari belakang agar posisi kecocokan sebelumnya tetap valid.
          const ordered = [...storage.results].sort((a, b) => b.from - a.from);
          for (const match of ordered) {
            tr.insertText(replaceWith, match.from, match.to);
          }
          if (dispatch) dispatch(tr);
          storage.currentIndex = 0;
          recompute();
          return true;
        },

      clearSearch:
        () =>
        ({ editor, tr, dispatch }) => {
          const storage = getStorage(editor);
          storage.searchTerm = "";
          storage.results = [];
          storage.currentIndex = 0;
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { searchResultClass, searchResultCurrentClass } = this.options;
    const editor = this.editor;

    return [
      new Plugin({
        key: searchReplacePluginKey,
        props: {
          decorations(state) {
            const storage = getStorage(editor);
            if (!storage.searchTerm || storage.results.length === 0) {
              return DecorationSet.empty;
            }
            const decorations = storage.results.map((range, index) =>
              Decoration.inline(range.from, range.to, {
                class:
                  index === storage.currentIndex
                    ? searchResultCurrentClass
                    : searchResultClass,
              }),
            );
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export default SearchReplace;
