import { useRef, useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { Camera, Trash2, ZoomIn, ZoomOut, Check, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";

type ProfileAvatarEditProps = {
  size?: "sm" | "md";
};

const CROP_SIZE = 260;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.3;

type CropState = { x: number; y: number; zoom: number };

/* ------------------------------------------------------------------ */
/*  Crop Editor – shown when clicking existing avatar                  */
/* ------------------------------------------------------------------ */

function AvatarCropEditor({
  imageSrc,
  onConfirm,
  onCancel,
  onDelete,
  uploading,
}: {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  onDelete: () => void;
  uploading: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 });
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, zoom: 1 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  // Store loaded image for canvas drawing
  const loadedImg = useRef<HTMLImageElement | null>(null);

  const imgNaturalRef = useRef(imgNatural);
  imgNaturalRef.current = imgNatural;

  const clamp = useCallback((x: number, y: number, zoom: number, w: number, h: number) => {
    const maxX = Math.max(0, (w * zoom - CROP_SIZE) / 2);
    const maxY = Math.max(0, (h * zoom - CROP_SIZE) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  const clampRef = useRef(clamp);
  clampRef.current = clamp;

  // Load image via JS Image object (avoids CORS/DOM issues)
  useEffect(() => {
    setReady(false);
    const img = new Image();
    // crossOrigin needed for canvas.toBlob() to work with remote URLs
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setImgNatural({ w, h });
      imgNaturalRef.current = { w, h };
      loadedImg.current = img;
      // Start by showing the entire image (fit largest dimension in crop circle)
      const maxDim = Math.max(w, h);
      const initZoom = CROP_SIZE / maxDim;
      setCrop({ x: 0, y: 0, zoom: initZoom });
      setReady(true);
    };
    img.onerror = () => {
      // Retry without crossOrigin (some blob URLs fail with it)
      const img2 = new Image();
      img2.onload = () => {
        const w = img2.naturalWidth;
        const h = img2.naturalHeight;
        setImgNatural({ w, h });
        imgNaturalRef.current = { w, h };
        loadedImg.current = img2;
        const maxDim = Math.max(w, h);
        const initZoom = CROP_SIZE / maxDim;
        setCrop({ x: 0, y: 0, zoom: initZoom });
        setReady(true);
      };
      img2.onerror = () => {
        toast.error("Gagal memuat gambar");
      };
      img2.src = imageSrc;
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Pan
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setCrop((prev) => {
      const { w, h } = imgNaturalRef.current;
      return { ...prev, ...clampRef.current(prev.x + dx, prev.y + dy, prev.zoom, w, h) };
    });
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  // Pinch zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

    const onTS = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        dragging.current = false;
        pinchStartDist.current = dist(e.touches[0], e.touches[1]);
        pinchStartZoom.current = crop.zoom;
      }
    };
    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const scale = d / pinchStartDist.current;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoom.current * scale));
        setCrop((prev) => {
          const { w, h } = imgNaturalRef.current;
          return { ...clampRef.current(prev.x, prev.y, newZoom, w, h), zoom: newZoom };
        });
      }
    };

    el.addEventListener("touchstart", onTS, { passive: false });
    el.addEventListener("touchmove", onTM, { passive: false });
    return () => { el.removeEventListener("touchstart", onTS); el.removeEventListener("touchmove", onTM); };
  }, [crop.zoom]);

  const zoomIn = useCallback(() => {
    setCrop((prev) => {
      const newZoom = Math.min(MAX_ZOOM, prev.zoom + ZOOM_STEP);
      const { w, h } = imgNaturalRef.current;
      return { ...clampRef.current(prev.x, prev.y, newZoom, w, h), zoom: newZoom };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setCrop((prev) => {
      const newZoom = Math.max(MIN_ZOOM, prev.zoom - ZOOM_STEP);
      const { w, h } = imgNaturalRef.current;
      return { ...clampRef.current(prev.x, prev.y, newZoom, w, h), zoom: newZoom };
    });
  }, []);

  const handleSave = useCallback(() => {
    const img = loadedImg.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    const out = 512;
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const centerX = (nw * crop.zoom) / 2 - crop.x;
    const centerY = (nh * crop.zoom) / 2 - crop.y;
    const srcSize = CROP_SIZE / crop.zoom;
    const srcX = centerX / crop.zoom - srcSize / 2;
    const srcY = centerY / crop.zoom - srcSize / 2;

    ctx.beginPath();
    ctx.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2);
    ctx.clip();

    try {
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, out, out);
    } catch {
      toast.error("Gagal memproses gambar");
      return;
    }

    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.9);
  }, [crop, onConfirm]);

  const containerSize = CROP_SIZE + 20;

  return (
    <div className="flex w-full flex-col">
      <div className="relative flex w-full items-center justify-center bg-black/95 py-6">
        {/* Interaction area - square, larger than circle */}
        <div
          ref={containerRef}
          className="relative cursor-grab overflow-hidden active:cursor-grabbing"
          style={{ width: containerSize, height: containerSize, touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Photo - zooms and pans behind the fixed circle */}
          {ready && (
            <div
              className="pointer-events-none absolute select-none"
              style={{
                width: imgNatural.w * crop.zoom,
                height: imgNatural.h * crop.zoom,
                left: `calc(50% - ${(imgNatural.w * crop.zoom) / 2 - crop.x}px)`,
                top: `calc(50% - ${(imgNatural.h * crop.zoom) / 2 - crop.y}px)`,
                backgroundImage: `url(${imageSrc})`,
                backgroundSize: "100% 100%",
              }}
            />
          )}

          {/* Dark overlay with circular cutout - frame stays fixed */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle ${CROP_SIZE / 2}px at center, transparent ${CROP_SIZE / 2 - 1}px, rgba(0,0,0,0.6) ${CROP_SIZE / 2}px)`,
            }}
          />

          {/* Fixed circle border */}
          <div
            className="pointer-events-none absolute rounded-full ring-2 ring-white/50"
            style={{
              width: CROP_SIZE,
              height: CROP_SIZE,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />

          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-8 text-white" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-8 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Zoom */}
      <div className="flex items-center justify-center gap-3 border-t px-4 py-3">
        <Button variant="ghost" size="icon" onClick={zoomOut} disabled={crop.zoom <= MIN_ZOOM || uploading} className="size-9 cursor-pointer">
          <ZoomOut className="size-5" />
        </Button>
        <div className="h-1 w-24 rounded-full bg-muted">
          <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${((crop.zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }} />
        </div>
        <Button variant="ghost" size="icon" onClick={zoomIn} disabled={crop.zoom >= MAX_ZOOM || uploading} className="size-9 cursor-pointer">
          <ZoomIn className="size-5" />
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={uploading} className="cursor-pointer gap-1.5">
            <X className="size-4" />Batal
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={uploading} className="cursor-pointer gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="size-4" />Hapus
          </Button>
        </div>
        <Button size="sm" onClick={handleSave} disabled={uploading || !ready} className="cursor-pointer gap-1.5">
          {uploading ? <><Spinner className="size-4" />Menyimpan...</> : <><Check className="size-4" />Simpan</>}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ProfileAvatarEdit({ size = "md" }: ProfileAvatarEditProps) {
  const { user: authUser } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const updateMyAvatar = useMutation(api.users.updateMyAvatar);
  const removeMyAvatar = useMutation(api.users.removeMyAvatar);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = currentUser?.name ?? authUser?.profile.name ?? "U";
  const avatarUrl =
    currentUser?.avatarUrl ??
    (typeof authUser?.profile.avatar === "string" ? authUser.profile.avatar : null);

  const sizeClasses = size === "sm" ? "size-9" : "size-10";
  const textSize = size === "sm" ? "text-sm" : "text-base";

  // Click avatar:
  // - No avatar → open file picker to upload directly
  // - Has avatar → open edit dialog
  const handleAvatarClick = useCallback(() => {
    if (avatarUrl) {
      setDialogOpen(true);
    } else {
      fileInputRef.current?.click();
    }
  }, [avatarUrl]);

  // File selected → upload directly as avatar (no crop for first upload)
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Hanya file gambar yang diperbolehkan"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran file maksimal 5MB"); return; }

    e.target.value = "";
    setUploading(true);

    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: string };
      await updateMyAvatar({ storageId: storageId as unknown as Parameters<typeof updateMyAvatar>[0]["storageId"] });
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
    }
  }, [generateUploadUrl, updateMyAvatar]);

  // Crop confirm from editor → upload cropped blob
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
      const { storageId } = (await res.json()) as { storageId: string };
      await updateMyAvatar({ storageId: storageId as unknown as Parameters<typeof updateMyAvatar>[0]["storageId"] });
      toast.success("Foto profil diperbarui");
      setDialogOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const data = error.data as { message?: string };
        toast.error(data.message ?? "Gagal mengunggah foto");
      } else {
        toast.error("Gagal mengunggah foto");
      }
    } finally {
      setUploading(false);
    }
  }, [generateUploadUrl, updateMyAvatar]);

  const handleDelete = useCallback(async () => {
    try {
      await removeMyAvatar();
      toast.success("Foto profil dihapus");
      setDialogOpen(false);
    } catch {
      toast.error("Gagal menghapus foto");
    }
  }, [removeMyAvatar]);

  return (
    <>
      {/* Clickable avatar */}
      <button
        type="button"
        onClick={handleAvatarClick}
        className="group relative cursor-pointer rounded-full"
        title={avatarUrl ? "Edit foto profil" : "Pilih foto profil"}
        disabled={uploading}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className={cn(sizeClasses, "rounded-full object-cover ring-2 ring-sidebar-border")}
          />
        ) : (
          <div
            className={cn(
              sizeClasses,
              "flex items-center justify-center rounded-full bg-primary/15 ring-2 ring-sidebar-border",
            )}
          >
            <span className={cn(textSize, "font-semibold text-primary")}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? <Spinner className="size-3.5 text-white" /> : <Camera className="size-3.5 text-white" />}
        </div>
      </button>

      {/* Editor dialog - only for existing avatar */}
      {dialogOpen && avatarUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setDialogOpen(false)} />
          <div className="relative z-10 mx-4 w-full max-w-sm overflow-hidden rounded-xl bg-background shadow-2xl">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Edit Foto Profil</h3>
            </div>
            <AvatarCropEditor
              imageSrc={avatarUrl}
              onConfirm={handleCropConfirm}
              onCancel={() => setDialogOpen(false)}
              onDelete={handleDelete}
              uploading={uploading}
            />
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
