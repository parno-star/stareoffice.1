import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    hspace: {
      /** Sisipkan spasi mendatar (lebar px) pada posisi kursor. */
      insertHSpace: (width: number) => ReturnType;
      /** Perbarui lebar (px) node spasi mendatar pada posisi tertentu. */
      setHSpaceWidth: (pos: number, width: number) => ReturnType;
      /** Hapus node spasi mendatar pada posisi tertentu. */
      removeHSpace: (pos: number) => ReturnType;
    };
  }
}

/**
 * Node sebaris (inline) berupa "spasi mendatar" dengan lebar tertentu (px).
 * Dipakai oleh penanda mistar untuk mendorong HANYA teks setelah kursor pada
 * baris tersebut, tanpa mengubah indent paragraf atau baris lain. Mirip
 * menekan Tab, tetapi lebarnya bisa diatur bebas lewat mistar.
 */
export const HSpace = Node.create({
  name: "hspace",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      width: {
        default: 0,
        parseHTML: (element) => {
          const w = parseFloat((element as HTMLElement).style.width);
          return Number.isNaN(w) ? 0 : Math.round(w);
        },
        renderHTML: (attributes) => {
          const w = (attributes.width as number) || 0;
          return { style: `display:inline-block;width:${w}px` };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-hspace]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-hspace": "true" })];
  },

  addCommands() {
    return {
      insertHSpace:
        (width: number) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { width: Math.max(0, Math.round(width)) },
          }),

      setHSpaceWidth:
        (pos: number, width: number) =>
        ({ state, dispatch, tr }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width: Math.max(0, Math.round(width)),
            });
            dispatch(tr);
          }
          return true;
        },

      removeHSpace:
        (pos: number) =>
        ({ state, dispatch, tr }) => {
          const node = state.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) {
            tr.delete(pos, pos + node.nodeSize);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

export default HSpace;
