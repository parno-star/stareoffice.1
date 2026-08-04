import { Extension, type CommandProps } from "@tiptap/core";

export type IndentOptions = {
  /** Node types the indent attribute can be applied to. */
  types: string[];
  /** Indent step in em per level. */
  step: number;
  /** Maximum indent level. */
  maxLevel: number;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Increase the paragraph indent by one level. */
      indent: () => ReturnType;
      /** Decrease the paragraph indent by one level. */
      outdent: () => ReturnType;
      /** Set the enclosing list's indent to an absolute level (for the ruler). */
      setListIndentLevel: (level: number) => ReturnType;
    };
  }
}

/**
 * Menambahkan indent (menjorok) pada paragraf & judul, tersimpan sebagai level
 * angka dan dirender menjadi `margin-left` dalam satuan em. Cocok untuk alinea
 * pembuka pada surat resmi.
 */
export const Indent = Extension.create<IndentOptions>({
  name: "indent",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
      step: 2,
      maxLevel: 8,
    };
  },

  addGlobalAttributes() {
    // Selain paragraf & judul, izinkan daftar (ol/ul) menyimpan indent juga,
    // sehingga seluruh daftar bisa digeser ke kanan/kiri sebagai satu kesatuan.
    const attributeTypes = [...this.options.types, "orderedList", "bulletList"];
    return [
      {
        types: attributeTypes,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const marginLeft = element.style.marginLeft;
              if (!marginLeft) return 0;
              const value = parseFloat(marginLeft);
              if (Number.isNaN(value)) return 0;
              return Math.round(value / this.options.step);
            },
            renderHTML: (attributes) => {
              const level = (attributes.indent as number) || 0;
              if (!level) return {};
              return { style: `margin-left: ${level * this.options.step}em` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const listTypes = ["orderedList", "bulletList"];

    const applyIndent =
      (delta: number) =>
      ({ state, dispatch, tr }: CommandProps) => {
        const { $from, from, to } = state.selection;

        // Bila kursor berada di dalam daftar, geser SELURUH daftar terluar
        // (bukan membuat sub-level). Ini yang diinginkan untuk menggeser
        // nomor/bullet ke kanan atau kiri seperti di Word.
        for (let depth = 0; depth <= $from.depth; depth++) {
          const node = $from.node(depth);
          if (listTypes.includes(node.type.name)) {
            const listPos = $from.before(depth);
            const current = (node.attrs.indent as number) || 0;
            const next = Math.min(
              this.options.maxLevel,
              Math.max(0, current + delta),
            );
            if (next === current) return false;
            tr.setNodeMarkup(listPos, undefined, {
              ...node.attrs,
              indent: next,
            });
            if (dispatch) dispatch(tr);
            return true;
          }
        }

        // Selain daftar: geser paragraf & judul seperti sebelumnya.
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!this.options.types.includes(node.type.name)) return;
          const current = (node.attrs.indent as number) || 0;
          const next = Math.min(
            this.options.maxLevel,
            Math.max(0, current + delta),
          );
          if (next !== current) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };

    return {
      indent: () => applyIndent(1),
      outdent: () => applyIndent(-1),
      setListIndentLevel:
        (level: number) =>
        ({ state, dispatch, tr }: CommandProps) => {
          const { $from } = state.selection;
          const target = Math.min(
            this.options.maxLevel,
            Math.max(0, Math.round(level)),
          );
          for (let depth = 0; depth <= $from.depth; depth++) {
            const node = $from.node(depth);
            if (listTypes.includes(node.type.name)) {
              const listPos = $from.before(depth);
              const current = (node.attrs.indent as number) || 0;
              if (target === current) return false;
              tr.setNodeMarkup(listPos, undefined, {
                ...node.attrs,
                indent: target,
              });
              if (dispatch) dispatch(tr);
              return true;
            }
          }
          return false;
        },
    };
  },
});

export default Indent;
