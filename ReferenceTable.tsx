import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { TRACK_CLASSES_1067, TRACK_CLASSES_1435 } from "../_lib/track-standards.ts";
import type { GaugeType } from "../_lib/track-standards.ts";

type Props = {
  gauge: GaugeType;
};

export default function ReferenceTable({ gauge }: Props) {
  const classes = gauge === "1067" ? TRACK_CLASSES_1067 : TRACK_CLASSES_1435;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Tabel Klasifikasi Kelas Jalan Rel - PM 60/2012 (Lebar Sepur {gauge} mm)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-2.5">Kelas</th>
                <th className="whitespace-nowrap px-3 py-2.5">Daya Angkut (ton/th)</th>
                <th className="whitespace-nowrap px-3 py-2.5">V Maks (km/jam)</th>
                <th className="whitespace-nowrap px-3 py-2.5">P Gandar (ton)</th>
                <th className="whitespace-nowrap px-3 py-2.5">Tipe Rel</th>
                <th className="whitespace-nowrap px-3 py-2.5">Bantalan</th>
                <th className="whitespace-nowrap px-3 py-2.5">Balas Atas (cm)</th>
                <th className="whitespace-nowrap px-3 py-2.5">Bahu Balas (cm)</th>
                <th className="whitespace-nowrap px-3 py-2.5">Landai Maks</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls, i) => {
                const isLast = i === classes.length - 1;
                const tonnageLabel = isLast
                  ? `< ${(classes[i - 1]?.minAnnualTonnage ?? 0).toLocaleString("id-ID")}`
                  : i === 0
                    ? `> ${cls.minAnnualTonnage.toLocaleString("id-ID")}`
                    : `${cls.minAnnualTonnage.toLocaleString("id-ID")} - ${classes[i - 1].minAnnualTonnage.toLocaleString("id-ID")}`;
                return (
                  <tr key={cls.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
                      {cls.label}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{tonnageLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{cls.maxSpeed}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{cls.maxAxleLoad}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {cls.allowedRails.join(" / ")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {cls.allowedSleepers
                        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                        .join(" / ")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{cls.minBallastThickness}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{cls.minShoulderWidth}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{cls.maxGradient}‰</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Sumber: Peraturan Menteri Perhubungan No. PM 60 Tahun 2012 tentang Persyaratan
          Teknis Jalur Kereta Api (Lampiran)
        </p>
      </CardContent>
    </Card>
  );
}
