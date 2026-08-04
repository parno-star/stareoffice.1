import ClockCard from "./_components/ClockCard.tsx";
import MonthlyStats from "./_components/MonthlyStats.tsx";
import HistoryTable from "./_components/HistoryTable.tsx";
import TeamTodayList from "./_components/TeamTodayList.tsx";

export default function AttendancePage() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Absensi & Jam Kerja</h1>
        <p className="text-muted-foreground">
          Catat waktu kerja Anda dan lihat ringkasan kehadiran bulanan.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ClockCard />
          <MonthlyStats />
          <div>
            <h2 className="text-lg font-semibold mb-3">Riwayat Bulan Ini</h2>
            <HistoryTable />
          </div>
        </div>
        <div>
          <TeamTodayList />
        </div>
      </div>
    </div>
  );
}
