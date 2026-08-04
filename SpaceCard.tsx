import { Card, CardContent } from "@/components/ui/card.tsx";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { FileText } from "lucide-react";
import { getSpaceColorClasses } from "@/pages/wiki/_lib/wiki-utils.ts";

export default function SpaceCard({
  space,
  onClick,
}: {
  space: Doc<"wikiSpaces">;
  onClick: () => void;
}) {
  const colors = getSpaceColorClasses(space.color);
  return (
    <button
      onClick={onClick}
      className="group text-left transition-transform hover:-translate-y-0.5"
    >
      <Card className={`h-full cursor-pointer transition-all hover:shadow-md`}>
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-11 items-center justify-center rounded-xl text-xl ${colors.tile}`}
            >
              <span>{space.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold">{space.name}</h3>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="size-3" />
                {space.articleCount}{" "}
                {space.articleCount === 1 ? "artikel" : "artikel"}
              </p>
            </div>
          </div>
          {space.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {space.description}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground/70">
              Belum ada deskripsi
            </p>
          )}
        </CardContent>
      </Card>
    </button>
  );
}
