import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

type Props = {
  avatarUrl?: string;
  name?: string;
  initials: string;
  toneClass: string;
};

export default function ProfileAvatarUploader({
  avatarUrl,
  name,
  initials,
  toneClass,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const updateMyAvatar = useMutation(api.users.updateMyAvatar);
  const removeMyAvatar = useMutation(api.users.removeMyAvatar);

  const handleSelect = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Ukuran gambar maksimal 5MB");
      return;
    }
    setUploading(true);
    try {
      const postUrl = await generateUploadUrl({});
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload gagal");
      const { storageId } = (await result.json()) as {
        storageId: Id<"_storage">;
      };
      await updateMyAvatar({ storageId });
      toast.success("Foto profil diperbarui");
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengunggah foto");
      } else {
        toast.error("Gagal mengunggah foto");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await removeMyAvatar({});
      toast.success("Foto profil dihapus");
    } catch {
      toast.error("Gagal menghapus foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Ganti foto profil"
      >
        <Avatar className="size-32 rounded-xl ring-4 ring-background">
          {avatarUrl ? (
            <AvatarImage
              src={avatarUrl}
              alt={name ?? ""}
              className="rounded-xl object-cover"
            />
          ) : null}
          <AvatarFallback className={cn(toneClass, "rounded-xl text-4xl font-bold")}>
            {initials}
          </AvatarFallback>
        </Avatar>
        {/* Hover / uploading overlay */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-black/50 text-white transition-opacity",
            uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <>
              <Camera className="size-6" />
              <span className="text-[11px] font-medium">Ganti Foto</span>
            </>
          )}
        </div>
      </button>

      {avatarUrl ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
          disabled={uploading}
          aria-label="Hapus foto profil"
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
