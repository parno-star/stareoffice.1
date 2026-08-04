import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useCallback } from "react";

// Shared helper for history form dialogs: uploads a file to Convex storage via
// the employeeHistory.generateUploadUrl mutation and returns the storage id.
export function useHistoryAttachmentUpload() {
  const generateUploadUrl = useMutation(api.employeeHistory.generateUploadUrl);

  return useCallback(
    async (file: File): Promise<Id<"_storage">> => {
      const postUrl = await generateUploadUrl();
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      return storageId;
    },
    [generateUploadUrl],
  );
}
