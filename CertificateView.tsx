import { forwardRef } from "react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatDuration } from "../_lib/training-utils.ts";
import { Award } from "lucide-react";

type Props = {
  certificate: Doc<"courseCertificates">;
};

const CertificateView = forwardRef<HTMLDivElement, Props>(
  function CertificateView({ certificate }, ref) {
    const issued = new Date(certificate.issuedAt);
    return (
      <div
        ref={ref}
        className="relative overflow-hidden rounded-3xl border-[3px] border-amber-400 bg-white p-10 text-slate-900 shadow-2xl"
        style={{ aspectRatio: "1.414 / 1", fontFamily: "Georgia, serif" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(251,191,36,0.18), transparent 60%), radial-gradient(circle at bottom right, rgba(59,130,246,0.18), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-amber-300/60"
        />
        <div className="relative flex h-full flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
            <Award className="size-8" />
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-amber-600">
            Sertifikat Penyelesaian
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Certificate of Completion
          </h1>
          <p className="mt-6 text-sm uppercase tracking-widest text-slate-500">
            Dianugerahkan kepada
          </p>
          <p
            className="mt-2 max-w-[80%] text-balance text-4xl font-semibold italic text-slate-900"
            style={{ fontFamily: "'Brush Script MT', 'Great Vibes', cursive" }}
          >
            {certificate.userName}
          </p>
          <p className="mt-6 max-w-2xl text-sm text-slate-600">
            Atas keberhasilan menyelesaikan dan lulus kelas pelatihan
          </p>
          <p className="mt-2 max-w-2xl text-2xl font-semibold text-slate-800">
            &ldquo;{certificate.courseTitle}&rdquo;
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Total durasi pembelajaran {formatDuration(certificate.durationMinutes)}
            {certificate.instructorName
              ? ` · Instruktur ${certificate.instructorName}`
              : ""}
          </p>

          <div className="mt-auto flex w-full items-end justify-between pt-8 text-xs">
            <div className="text-left">
              <p className="font-semibold uppercase tracking-widest text-slate-600">
                Nomor Sertifikat
              </p>
              <p className="mt-1 font-mono text-sm text-slate-900">
                {certificate.serial}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold uppercase tracking-widest text-slate-600">
                Diterbitkan
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {format(issued, "d MMMM yyyy", { locale: idLocale })}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default CertificateView;
