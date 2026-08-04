// Mengubah hasil query pengaturan kop nota (api.letterMemoSettings.get) menjadi
// objek `memoLine` yang dipakai renderer dokumen (pratinjau, cetak/PDF, arsip).
// Diletakkan di satu tempat agar semua pemanggil konsisten.

export type MemoLineStyle = {
  topShow: boolean;
  topColor: string;
  topWidth: number;
  bottomShow: boolean;
  bottomColor: string;
  bottomWidth: number;
};

type MemoSettingsLike =
  | {
      topLineShow?: boolean;
      topLineColor?: string;
      topLineWidth?: number;
      bottomLineShow?: boolean;
      bottomLineColor?: string;
      bottomLineWidth?: number;
    }
  | null
  | undefined;

// Nilai default bila tenant belum mengatur (garis atas tebal, bawah tipis).
const DEFAULTS: MemoLineStyle = {
  topShow: true,
  topColor: "#1f2937",
  topWidth: 4,
  bottomShow: true,
  bottomColor: "#1f2937",
  bottomWidth: 2,
};

export function memoLineFromSettings(settings: MemoSettingsLike): MemoLineStyle {
  if (!settings) return DEFAULTS;
  return {
    topShow: settings.topLineShow ?? DEFAULTS.topShow,
    topColor: settings.topLineColor ?? DEFAULTS.topColor,
    topWidth: settings.topLineWidth ?? DEFAULTS.topWidth,
    bottomShow: settings.bottomLineShow ?? DEFAULTS.bottomShow,
    bottomColor: settings.bottomLineColor ?? DEFAULTS.bottomColor,
    bottomWidth: settings.bottomLineWidth ?? DEFAULTS.bottomWidth,
  };
}
