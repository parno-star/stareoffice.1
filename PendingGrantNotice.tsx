import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty.tsx";
import { ShieldAlert } from "lucide-react";

/**
 * Shown on tenant-data pages when a super admin has SELECTED a company to view
 * but the company has not yet granted an active access grant. In that state the
 * backend scopes all tenant data to empty, so instead of an empty list we show
 * a clear notice explaining that access is awaiting the company's approval.
 */
export default function PendingGrantNotice({
  organizationName,
}: {
  organizationName?: string | null;
}) {
  return (
    <Empty className="min-h-[50vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlert />
        </EmptyMedia>
        <EmptyTitle>Menunggu izin akses dari organisasi ini</EmptyTitle>
        <EmptyDescription>
          {organizationName
            ? `Anda memilih ${organizationName}, namun organisasi tersebut belum menyetujui akses data. `
            : "Organisasi yang Anda pilih belum menyetujui akses data. "}
          Data akan muncul di sini setelah admin organisasi menyetujui
          permintaan akses Anda.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-xs text-muted-foreground">
          Anda dapat mengajukan permintaan akses melalui pemilih organisasi di
          bagian atas, lalu menunggu persetujuan.
        </p>
      </EmptyContent>
    </Empty>
  );
}
