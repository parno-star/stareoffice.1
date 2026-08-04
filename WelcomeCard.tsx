import { Card, CardContent } from "@/components/ui/card.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";

interface WelcomeCardProps {
  name: string;
  avatarUrl?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function WelcomeCard({ name, avatarUrl }: WelcomeCardProps) {
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam";

  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0">
      <CardContent className="flex items-center gap-4">
        {/* Avatar foto profil */}
        <Avatar className="size-16 shrink-0 ring-2 ring-white/30 ring-offset-2 ring-offset-primary/60">
          <AvatarImage src={avatarUrl ?? undefined} alt={name} className="object-cover" />
          <AvatarFallback className="bg-white/20 text-primary-foreground text-lg font-bold">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold sm:text-2xl">
            {greeting}, {name}!
          </h1>
          <p className="text-sm opacity-85">{dateStr}</p>
        </div>
      </CardContent>
    </Card>
  );
}
