import { Extension, type CommandProps } from "@tiptap/core";

export type LineHeightOptions = {
  /** Node types the attributes can be applied to. */
  types: string[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      /** Set the line spacing (jarak antar baris) of the selected block(s). */
      setLineHeight: (height: string) => ReturnType;
      /** Remove the explicit line spacing, reverting to the default. */
      unsetLineHeight: () => ReturnType;
    };
    paragraphSpacing: {
      /** Set the space after (jarak antar paragraf) of the selected block(s). */
      setParagraphSpacing: (spacing: string) => ReturnType;
      /** Remove the explicit paragraph spacing, reverting to the default. */
      unsetParagraphSpacing: () => ReturnType;
    };
  }
}

/**
 * Menerapkan spasi antar baris (line-height) DAN jarak antar paragraf
 * (margin-bottom) pada paragraf & judul sebagai atribut node blok. Keduanya
 * dirender sebagai inline style pada elemen <p>/<h*> sehingga menimpa gaya
 * bawaan `prose` dan benar-benar terlihat pada teks.
 *
 * Berbeda dengan LineHeight bawaan @tiptap/extension-text-style yang keliru
 * menempelkan line-height pada <span> inline sehingga tidak berpengaruh.
 */
export const LineHeight = Extension.create<LineHeightOptions>({
  name: "lineHeight",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              const lineHeight = attributes.lineHeight as string | null;
              if (!lineHeight) return {};
              return { style: `line-height: ${lineHeight}` };
            },
          },
          paragraphSpacing: {
            default: null,
            parseHTML: (element) => {
              const marginBottom = element.style.marginBottom;
              return marginBottom || null;
            },
            renderHTML: (attributes) => {
              const spacing = attributes.paragraphSpacing as string | null;
              if (!spacing) return {};
              return { style: `margin-bottom: ${spacing}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    // Set/clear an arbitrary node attribute across the selected blocks.
    const applyNodeAttr =
      (attr: "lineHeight" | "paragraphSpacing", value: string | null) =>
      ({ state, dispatch, tr }: CommandProps) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!this.options.types.includes(node.type.name)) return;
          const current = (node.attrs[attr] as string | null) ?? null;
          if (current !== value) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attr]: value });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };

    return {
      setLineHeight: (height: string) => applyNodeAttr("lineHeight", height),
      unsetLineHeight: () => applyNodeAttr("lineHeight", null),
      setParagraphSpacing: (spacing: string) =>
        applyNodeAttr("paragraphSpacing", spacing),
      unsetParagraphSpacing: () => applyNodeAttr("paragraphSpacing", null),
    };
  },
});

export default LineHeight;
