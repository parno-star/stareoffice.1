import { cn } from "@/lib/utils.ts";

// Ikon kecil bergaya Microsoft Word: kotak biru khas Word dengan huruf "W".
// Dibuat dari elemen bergaya (bukan logo resmi) karena pustaka ikon tidak
// menyediakan logo merek. Atur ukuran kotak lewat prop `className`
// (mis. "size-4"); ukuran huruf menyesuaikan otomatis.
export default function WordIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[3px] bg-[#2b579a] font-bold leading-none text-white",
        className,
      )}
      aria-hidden="true"
    >
      <span className="text-[0.62em]">W</span>
    </span>
  );
}
