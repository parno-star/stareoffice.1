import { Button } from "@/components/ui/button.tsx";
import { Sparkles, ArrowLeft, HardHat } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ComingSoon({ title }: { title: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            Star e-Office
          </span>
        </div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center space-y-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <HardHat className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Fitur ini sedang dalam pengembangan dan akan segera tersedia di
            milestone berikutnya.
          </p>
          <Button onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="size-4" />
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    </div>
  );
}
