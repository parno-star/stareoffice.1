import { Extension, type CommandProps } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    listStyle: {
      /** Setel gaya penanda (list-style-type) pada daftar terpilih. */
      setListStyleType: (value: string) => ReturnType;
      /**
       * Buat daftar bernomor sekarang MELANJUTKAN angka dari daftar bernomor
       * terdekat di atasnya (mis. 1,2 lalu teks biasa lalu 3,4). Mengembalikan
       * false bila tidak ada daftar bernomor sebelumnya untuk dilanjutkan.
       */
      continueNumbering: () => ReturnType;
    };
  }
}

/**
 * Menambahkan atribut `listStyleType` pada daftar bullet & bernomor sehingga
 * pengguna bisa memilih gaya penanda (mis. angka "1", huruf "a"/"A", romawi
 * "i"/"I", atau bullet "disc"/"circle"/"square") layaknya Microsoft Word.
 * Nilai dirender sebagai `list-style-type` pada elemen <ul>/<ol>.
 */
export const ListStyle = Extension.create({
  name: "listStyle",

  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          listStyleType: {
            default: null,
            parseHTML: (element) =>
              (element as HTMLElement).style.listStyleType || null,
            renderHTML: (attributes) => {
              const value = attributes.listStyleType as string | null;
              if (!value) return {};
              return { style: `list-style-type: ${value}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setListStyleType:
        (value: string) =>
        ({ state, dispatch, tr }: CommandProps) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === "bulletList" || node.type.name === "orderedList") {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                listStyleType: value,
              });
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },

      continueNumbering:
        () =>
        ({ state, dispatch, tr }: CommandProps) => {
          const { $from } = state.selection;

          // Hitung "angka lanjutan" dari daftar bernomor (orderedList) terakhir
          // yang muncul SEBELUM posisi kursor. Bila tidak ada, mulai dari 1.
          const computeNextStart = (beforePos: number): number => {
            let prevList: ProseMirrorNode | null = null;
            state.doc.descendants((node, pos) => {
              if (node.type.name === "orderedList" && pos < beforePos) {
                prevList = node;
              }
              // Jangan telusuri lebih dalam dari batas yang diminta.
              return pos < beforePos;
            });
            if (!prevList) return 1;
            const prev = prevList as ProseMirrorNode;
            const prevStart =
              typeof prev.attrs.start === "number" ? prev.attrs.start : 1;
            return prevStart + prev.childCount;
          };

          // KASUS 1: kursor sudah berada di dalam daftar bernomor.
          // Cukup setel angka awalnya agar melanjutkan daftar sebelumnya.
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === "orderedList") {
              const listPos = $from.before(depth);
              const nextStart = computeNextStart(listPos);
              tr.setNodeMarkup(listPos, undefined, {
                ...node.attrs,
                start: nextStart,
              });
              if (dispatch) dispatch(tr);
              return true;
            }
          }

          // KASUS 2: kursor di teks biasa. Sisipkan daftar bernomor BARU di
          // baris bawahnya tanpa mengubah teks yang sudah ada, lalu lanjutkan
          // angka dari daftar sebelumnya.
          const orderedListType = state.schema.nodes.orderedList;
          const listItemType = state.schema.nodes.listItem;
          const paragraphType = state.schema.nodes.paragraph;
          if (!orderedListType || !listItemType || !paragraphType) return false;

          // Posisi tepat setelah blok teratas yang memuat kursor (mis. paragraf).
          const insertDepth = Math.min(1, $from.depth);
          const insertPos = $from.after(insertDepth);
          const nextStart = computeNextStart(insertPos);

          const newList = orderedListType.create(
            { start: nextStart },
            listItemType.create(null, paragraphType.create()),
          );
          tr.insert(insertPos, newList);

          // Letakkan kursor di dalam item baru agar pengguna langsung mengetik.
          try {
            const $inside = tr.doc.resolve(insertPos + 3);
            tr.setSelection(Selection.near($inside));
          } catch {
            // Bila resolusi posisi gagal, biarkan kursor apa adanya.
          }

          if (dispatch) dispatch(tr.scrollIntoView());
          return true;
        },
    };
  },
});

export default ListStyle;
