import { mutation } from "../_generated/server";
import { requireAdmin } from "../lib/authGuards";
import { recordAdminAction } from "../admin/adminAudit";

/**
 * SHOP CATEGORY SEED
 *
 * Creates the starting category structure. Products are not seeded — every
 * product needs a real tagged affiliate URL from an approved program, and there
 * is no placeholder worth putting in front of a shopper.
 *
 * The structure is derived from the *generic* home-care guidance in the
 * Toothlens assessment report template — brush with fluoride toothpaste, clean
 * interdentally, rinse, control tartar, stay hydrated. That is population-level
 * dental best practice, not anyone's individual scan.
 *
 * To be explicit, because the line matters: no category, ordering, or
 * recommendation here is derived from an individual member's `toothlensScans`
 * findings, and none may become so later. See docs/internal/SHOP_DESIGN.md
 * rule 3.
 *
 * Note the copy: it describes what a category *holds*, never what it treats.
 * The report's own wording ("prevent cavities", "gum disease") is correct for a
 * clinical document and would be rejected by the guards in `admin.ts`.
 *
 * Idempotent — a no-op once any category exists.
 */
export const seedCategories = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAdmin(ctx);

    const existing = await ctx.db.query("shopCategories").first();
    if (existing) {
      return { success: false, message: "Shop categories already seeded." };
    }

    const now = Date.now();

    const categories = [
      {
        name: "Daily Brushing",
        slug: "daily-brushing",
        description:
          "Toothpastes and brushes for twice-daily use, including soft-bristle and pressure-sensing electric brushes.",
        icon: "Sparkles",
      },
      {
        name: "Interdental Cleaning",
        slug: "interdental-cleaning",
        description:
          "Floss, picks, interdental brushes, and water flossers for cleaning between teeth and along the gumline.",
        icon: "Wind",
      },
      {
        name: "Rinses",
        slug: "rinses",
        description: "Fluoride and antimicrobial mouth rinses for daily use.",
        icon: "Droplet",
      },
      {
        name: "Tartar & Plaque Control",
        slug: "tartar-plaque-control",
        description:
          "Tartar-control pastes, plaque-disclosing tablets, and tongue scrapers for at-home upkeep between cleanings.",
        icon: "Brush",
      },
      {
        name: "Dry Mouth & Hydration",
        slug: "dry-mouth-hydration",
        description:
          "Moisturizing rinses, lozenges, gels, and water bottles for people who deal with a dry mouth.",
        icon: "GlassWater",
      },
      {
        name: "Kids' Oral Care",
        slug: "kids-oral-care",
        description:
          "Smaller brushes, kid-formulated pastes, and timers that make a two-minute routine easier.",
        icon: "Baby",
      },
      {
        name: "Whitening",
        slug: "whitening",
        description:
          "Cosmetic whitening strips, pens, and pastes for surface stain on enamel.",
        icon: "Sun",
      },
    ];

    for (const [index, category] of categories.entries()) {
      await ctx.db.insert("shopCategories", {
        ...category,
        order: index,
        // Hidden until someone has stocked it and reviewed the copy. An empty
        // visible category is a dead end for a shopper.
        isVisible: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordAdminAction(ctx, identity, {
      action: "shop.category.seed",
      targetType: "shopCategories",
      summary: `Seeded ${categories.length} shop categories (all hidden)`,
    });

    return {
      success: true,
      message: `Created ${categories.length} categories, all hidden. Make one visible once it has products.`,
    };
  },
});
