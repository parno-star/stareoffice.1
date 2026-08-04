import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Plus, Newspaper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isAdminRole } from "@/convex/roles.ts";

export default function CreateAnnouncement() {
  const navigate = useNavigate();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const canManage = isAdminRole(currentUser?.role ?? null);

  if (!canManage) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5"
        onClick={() => navigate("/news")}
      >
        <Newspaper className="size-4" />
        Lihat semua
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className="gap-1.5"
      onClick={() => navigate("/news")}
    >
      <Plus className="size-4" />
      Buat Berita
    </Button>
  );
}
