import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTenant } from "./lib/tenant";

/** Default sample data used when no welcome content has been saved yet */
const DEFAULT_VALUES = [
  {
    icon: "🎯",
    title: "Integritas",
    description: "Menjunjung tinggi kejujuran dan transparansi dalam setiap keputusan dan tindakan.",
  },
  {
    icon: "🚀",
    title: "Inovasi",
    description: "Terus berinovasi untuk memberikan solusi terbaik dan meningkatkan efisiensi kerja.",
  },
  {
    icon: "🤝",
    title: "Kolaborasi",
    description: "Bekerja sama sebagai tim yang solid untuk mencapai tujuan bersama organisasi.",
  },
  {
    icon: "⭐",
    title: "Keunggulan",
    description: "Berkomitmen untuk memberikan kualitas terbaik dalam setiap layanan dan produk.",
  },
];

const DEFAULT_SLIDES = [
  {
    imageUrl: "https://images.unsplash.com/photo-1758873268364-15bef4162221?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjB0ZWFtd29yayUyMGNvbGxhYm9yYXRpb24lMjBwcm9mZXNzaW9uYWx8ZW58MHx8fHwxNzc4Njc5MTI0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    caption: "Kolaborasi Tim yang Solid",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1758691737138-7b9b1884b1db?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwbWVldGluZyUyMGNvcnBvcmF0ZSUyMHN1Y2Nlc3MlMjBjZWxlYnJhdGlvbnxlbnwwfHx8fDE3Nzg2NzkxMjd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    caption: "Merayakan Pencapaian Bersama",
  },
  {
    imageUrl: "https://images.unsplash.com/photo-1758873272445-433c7a832584?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw4fHxkaWdpdGFsJTIwdHJhbnNmb3JtYXRpb24lMjB0ZWNobm9sb2d5JTIwaW5ub3ZhdGlvbiUyMG9mZmljZXxlbnwwfHx8fDE3Nzg2NzkxMjV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    caption: "Inovasi Digital Tanpa Batas",
  },
];

const DEFAULT_CAROUSEL_SETTINGS = {
  transitionType: "slide" as const,
  duration: 5,
  transitionSpeed: 400,
  autoPlay: true,
};

/** Fetch welcome page content for the current user's organization */
export const getContent = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });

    let org = null;
    if (organizationId) {
      org = await ctx.db.get(organizationId);
    }

    // Try to load saved content
    let content = null;
    if (organizationId) {
      content = await ctx.db
        .query("welcomePageContent")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .first();
    }

    // Resolve storage URLs for slides that use storageId
    const rawSlides = content?.bannerSlides ?? DEFAULT_SLIDES;
    const bannerSlides = await Promise.all(
      rawSlides.map(async (slide) => {
        if ("storageId" in slide && slide.storageId) {
          const url = await ctx.storage.getUrl(slide.storageId);
          return { ...slide, imageUrl: url ?? slide.imageUrl };
        }
        return slide;
      })
    );

    return {
      organizationName: org?.name ?? "Organisasi",
      organizationLogo: org?.logoUrl ?? null,
      slogan: content?.slogan ?? "Bersama Membangun Masa Depan Digital",
      values: content?.values ?? DEFAULT_VALUES,
      bannerSlides,
      spotlightText: content?.spotlightText ?? "#TransformasiDigital #KerjaCerdas #TimHebat",
      carouselSettings: content?.carouselSettings ?? DEFAULT_CAROUSEL_SETTINGS,
      hasCustomContent: content !== null,
    };
  },
});

/** Generate an upload URL for banner slide images */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireTenant(ctx, { allowSuperAdmin: true });
    return await ctx.storage.generateUploadUrl();
  },
});

const bannerSlideValidator = v.object({
  imageUrl: v.string(),
  storageId: v.optional(v.id("_storage")),
  caption: v.optional(v.string()),
  fileName: v.optional(v.string()),
  fileSize: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

const carouselSettingsValidator = v.optional(
  v.object({
    transitionType: v.string(),
    duration: v.number(),
    transitionSpeed: v.number(),
    autoPlay: v.boolean(),
  })
);

/** Save / update welcome page content (admin only) */
export const saveContent = mutation({
  args: {
    slogan: v.optional(v.string()),
    values: v.array(
      v.object({
        icon: v.string(),
        title: v.string(),
        description: v.string(),
      })
    ),
    bannerSlides: v.array(bannerSlideValidator),
    spotlightText: v.optional(v.string()),
    carouselSettings: carouselSettingsValidator,
  },
  handler: async (ctx, args) => {
    const { userId, organizationId } = await requireTenant(ctx, { allowSuperAdmin: true });
    if (!organizationId) {
      return;
    }

    const existing = await ctx.db
      .query("welcomePageContent")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    // Delete old storage files that are no longer referenced
    if (existing) {
      const oldStorageIds = new Set(
        existing.bannerSlides
          .map((s) => s.storageId)
          .filter((id): id is NonNullable<typeof id> => id != null)
      );
      const newStorageIds = new Set(
        args.bannerSlides
          .map((s) => s.storageId)
          .filter((id): id is NonNullable<typeof id> => id != null)
      );
      for (const oldId of oldStorageIds) {
        if (!newStorageIds.has(oldId)) {
          await ctx.storage.delete(oldId);
        }
      }
    }

    const data = {
      slogan: args.slogan,
      values: args.values,
      bannerSlides: args.bannerSlides,
      spotlightText: args.spotlightText,
      carouselSettings: args.carouselSettings,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("welcomePageContent", {
        organizationId,
        ...data,
      });
    }
  },
});
