export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Cuti Tahunan",
  sick: "Sakit",
  personal: "Izin Pribadi",
  maternity: "Cuti Melahirkan",
  other: "Lainnya",
};

export function formatLeaveType(type: string): string {
  return LEAVE_TYPE_LABELS[type] ?? type;
}
