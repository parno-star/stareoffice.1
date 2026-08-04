import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { renderLetterPdfBlob, renderIncomingLetterPdfBlob } from "../_components/letterPdf.ts";
import type { LetterDocumentDetail } from "../_components/LetterDocument.tsx";

// Builds the official letter PDF in the browser and uploads it to Convex
// storage as a permanent archive linked to the letter. Safe to call after a
// letter is sent/finalized. Errors are surfaced to the caller.
export function useLetterArchive() {
  const generateUploadUrl = useMutation(api.letters.generateArchiveUploadUrl);
  const saveArchive = useMutation(api.letters.saveLetterArchivePdf);

  return useCallback(
    async (letterId: Id<"letters">, detail: LetterDocumentDetail) => {
      // Incoming letters are recorded (not authored), so archive a registration
      // sheet rather than a formal letter with signature.
      const blob =
        detail.letter.type === "masuk"
          ? await renderIncomingLetterPdfBlob(detail)
          : await renderLetterPdfBlob(detail);
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      if (!res.ok) throw new Error("Gagal mengunggah arsip PDF");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const numberPart = detail.letter.letterNumber
        ? detail.letter.letterNumber.replace(/[^\w.-]+/g, "-")
        : detail.letter.agendaNumber
          ? detail.letter.agendaNumber.replace(/[^\w.-]+/g, "-")
          : "tanpa-nomor";
      const prefix = detail.letter.type === "masuk" ? "Surat-Masuk" : "Surat";
      const fileName = `${prefix}-${numberPart}.pdf`;
      await saveArchive({ letterId, storageId, fileName });
    },
    [generateUploadUrl, saveArchive],
  );
}
