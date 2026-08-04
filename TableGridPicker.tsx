import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { cn } from "@/lib/utils.ts";

const MAX_GRID = 10;

interface TableGridPickerProps {
  editor: Editor;
  children: React.ReactNode;
}

// Pemilih tabel visual (mirip Word/Google Docs): pengguna mengarahkan kursor
// pada kisi untuk memilih jumlah baris & kolom, lalu klik untuk menyisipkan.
// Menyediakan juga opsi baris header.
export default function TableGridPicker({ editor, children }: TableGridPickerProps) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
  const [withHeaderRow, setWithHeaderRow] = useState(true);

  const insert = (rows: number, cols: number) => {
    if (rows < 1 || cols < 1) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run();
    setOpen(false);
    setHover({ rows: 0, cols: 0 });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {hover.rows > 0
              ? `${hover.rows} baris \u00d7 ${hover.cols} kolom`
              : "Pilih ukuran tabel"}
          </p>

          {/* Kisi pemilih */}
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${MAX_GRID}, 1fr)` }}
            onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
          >
            {Array.from({ length: MAX_GRID }).map((_, r) =>
              Array.from({ length: MAX_GRID }).map((__, c) => {
                const active = r < hover.rows && c < hover.cols;
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    aria-label={`${r + 1} baris ${c + 1} kolom`}
                    className={cn(
                      "size-5 cursor-pointer rounded-[3px] border transition-colors",
                      active
                        ? "border-primary bg-primary/70"
                        : "border-border bg-muted hover:border-primary/50",
                    )}
                    onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })}
                    onClick={() => insert(r + 1, c + 1)}
                  />
                );
              }),
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 pt-1">
            <Checkbox
              checked={withHeaderRow}
              onCheckedChange={(v) => setWithHeaderRow(v === true)}
            />
            <Label className="cursor-pointer text-xs font-normal">Baris pertama sebagai judul</Label>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
