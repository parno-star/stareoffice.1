import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { ArrowRight, Hash, MapPin, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EnrichedAsset } from "@/convex/assets";
import {
  getCategoryConfig,
  getStatusConfig,
} from "../_lib/asset-utils.ts";

type Props = {
  asset: EnrichedAsset;
  canManage: boolean;
  onEdit?: (asset: EnrichedAsset) => void;
};

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
}

export default function AssetCard({ asset, canManage, onEdit }: Props) {
  const navigate = useNavigate();
  const cat = getCategoryConfig(asset.category);
  const status = getStatusConfig(asset.status);
  const CatIcon = cat.icon;

  return (
    <Card className="overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {asset.imageUrl ? (
          <img
            src={asset.imageUrl}
            alt={asset.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center ${cat.bg}`}
          >
            <CatIcon className={`size-14 ${cat.color}`} />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge className={status.color} variant="outline">
            {status.label}
          </Badge>
        </div>
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Hash className="size-3" />
              <span>{asset.assetTag}</span>
              <span className="text-muted-foreground/60">·</span>
              <span>{cat.label}</span>
            </div>
            <h3 className="mt-0.5 truncate text-base font-semibold">
              {asset.name}
            </h3>
            {asset.brand || asset.model ? (
              <p className="truncate text-xs text-muted-foreground">
                {[asset.brand, asset.model].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          {canManage && onEdit ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(asset);
              }}
              className="cursor-pointer"
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
        </div>

        {asset.currentHolderName ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
            <Avatar className="size-7">
              <AvatarImage src={asset.currentHolderAvatar ?? undefined} />
              <AvatarFallback className="text-xs">
                {initialsOf(asset.currentHolderName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {asset.currentHolderName}
              </p>
              {asset.currentHolderDepartment ? (
                <p className="truncate text-xs text-muted-foreground">
                  {asset.currentHolderDepartment}
                </p>
              ) : null}
            </div>
          </div>
        ) : asset.location ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            <span className="truncate">{asset.location}</span>
          </div>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          className="w-full cursor-pointer justify-between"
          onClick={() => navigate(`/assets/${asset._id}`)}
        >
          <span>Lihat detail</span>
          <ArrowRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
