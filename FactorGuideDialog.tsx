import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { BookOpen, Info } from "lucide-react";
import { FACTORS } from "../_lib/grading-utils.ts";

export default function FactorGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="cursor-pointer">
          <BookOpen className="size-4" />
          Panduan Faktor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" />
            Panduan 7 Faktor WTW GGS
          </DialogTitle>
          <DialogDescription>
            Setiap jabatan dinilai pada 7 faktor dengan skala level 1–7. Gunakan
            deskripsi level di bawah sebagai anchor (titik referensi) untuk
            memastikan konsistensi antar-penilai.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Cara Kerja Scoring</p>
              <p className="mt-1">
                Skor setiap faktor (1–7) dikalikan bobot faktor, kemudian
                dinormalisasi ke skala 0–100 dan dipetakan ke Global Grade 1–25.
                Company Size Band menambahkan penyesuaian -2 hingga +2 grade.
              </p>
            </div>
          </div>
        </div>
        <Accordion type="single" collapsible className="mt-2">
          {FACTORS.map((factor) => (
            <AccordionItem key={factor.key} value={factor.key}>
              <AccordionTrigger className="cursor-pointer">
                <div className="flex items-center gap-3 text-left">
                  <span className="font-semibold">{factor.label}</span>
                  <Badge variant="outline">
                    Bobot {(factor.weight * 100).toFixed(0)}%
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  {factor.description}
                </p>
                <div className="space-y-2">
                  {factor.levels.map((lvl) => (
                    <div
                      key={lvl.level}
                      className="rounded-md border bg-muted/30 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                          {lvl.level}
                        </span>
                        <p className="text-sm font-semibold">{lvl.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lvl.description}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
