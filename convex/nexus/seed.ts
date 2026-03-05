import { mutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Seed initial Nexus data
export const seedData = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Check if data already exists
    const existingCategories = await ctx.db.query("nexusCategories").first();
    if (existingCategories) {
      return { success: false, message: "Data already seeded" };
    }

    // Create categories
    const categories = [
      { name: "Financial", slug: "financial", icon: "DollarSign", color: "emerald", order: 0 },
      { name: "Health", slug: "health", icon: "Heart", color: "red", order: 1 },
      { name: "Legal", slug: "legal", icon: "Scale", color: "blue", order: 2 },
      { name: "Lifestyle", slug: "lifestyle", icon: "Sparkles", color: "purple", order: 3 },
      { name: "Tax", slug: "tax", icon: "Calculator", color: "amber", order: 4 },
      { name: "Wellness", slug: "wellness", icon: "Leaf", color: "green", order: 5 },
      { name: "Services", slug: "services", icon: "Settings", color: "slate", order: 6 },
    ];

    const categoryIds: Record<string, Id<"nexusCategories">> = {};
    for (const cat of categories) {
      const id = await ctx.db.insert("nexusCategories", {
        ...cat,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      });
      categoryIds[cat.slug] = id;
    }

    // Create products
    const products = [
      // Financial
      { category: "financial", name: "Financial Counseling", provider: "ASKF", slug: "financial-counseling-askf", icon: "DollarSign", order: 0 },
      { category: "financial", name: "Financial Services", provider: "Legal Club of America", slug: "financial-services-lca", icon: "Wallet", order: 1 },
      { category: "financial", name: "Legal Referral Program", provider: "Legal Club of America", slug: "legal-referral-lca", icon: "FileText", order: 2 },
      { category: "financial", name: "Financial Organizer + AI Coach", provider: "TallyUp", slug: "financial-organizer-tallyup", icon: "BarChart3", order: 3, isFeatured: true },

      // Health
      { category: "health", name: "Dental", provider: "Dental Discount Network POS", slug: "dental-careington", shortDescription: "Discount Network", icon: "Tooth", order: 0 },
      { category: "health", name: "Vision", provider: "", slug: "vision", shortDescription: "Discount Network", icon: "Eye", order: 1 },
      { category: "health", name: "Teledentistry", provider: "", slug: "teledentistry", shortDescription: "On-Demand Care", icon: "Video", order: 2 },
      { category: "health", name: "Hearing", provider: "", slug: "hearing", shortDescription: "Discount Network", icon: "Ear", order: 3 },
      { category: "health", name: "Diabetic Supplies", provider: "Better Living Now", slug: "diabetic-supplies", shortDescription: "Discount Network", icon: "Droplet", order: 4 },
      { category: "health", name: "Virtual Urgent Care", provider: "", slug: "virtual-urgent-care", shortDescription: "24/7 On Demand Care", icon: "AlertCircle", order: 5 },
      { category: "health", name: "Virtual Primary Care", provider: "", slug: "virtual-primary-care", shortDescription: "On-Demand Care", icon: "Stethoscope", order: 6, isFeatured: true },
      { category: "health", name: "Virtual Behaviour Care", provider: "", slug: "virtual-behaviour-care", shortDescription: "24/7 On Demand Care", icon: "Brain", order: 7 },
      { category: "health", name: "Virtual Dermatology", provider: "", slug: "virtual-dermatology", shortDescription: "On-Demand Care", icon: "Pill", order: 8 },
      { category: "health", name: "Basic", provider: "", slug: "health-basic", shortDescription: "Essential Wellness", icon: "Heart", order: 9 },
      { category: "health", name: "Plus", provider: "", slug: "health-plus", shortDescription: "Complete Wellness", icon: "HeartPlus", order: 10 },
      { category: "health", name: "Delux", provider: "", slug: "health-delux", shortDescription: "Complete Plus", icon: "HeartHandshake", order: 11 },
      { category: "health", name: "Quest Plus Full Panel", provider: "", slug: "quest-plus", shortDescription: "1200 Labs, Urine, Cultures", icon: "Microscope", order: 12 },
      { category: "health", name: "AI Powered Dental Plan Solution", provider: "AI Oral Scanning", slug: "ai-dental-ai-oral-scanning", icon: "Sparkles", order: 13 },
      { category: "health", name: "Chronic Disease Care", provider: "Chronilogix", slug: "chronic-care-chronilogix", icon: "Activity", order: 14 },

      // Legal
      { category: "legal", name: "Legal Aid", provider: "iWTNS", slug: "legal-aid-iwtns", icon: "Scale", order: 0, isFeatured: true },
      { category: "legal", name: "ID Resolution", provider: "", slug: "id-resolution", icon: "Shield", order: 1 },
      { category: "legal", name: "Identity Theft Recovery", provider: "IDX", slug: "identity-theft-idx", icon: "Lock", order: 2 },
      { category: "legal", name: "Allstate Identity Protection Core", provider: "Allstate", slug: "allstate-identity", icon: "SafeCircle", order: 3 },
      { category: "legal", name: "Legal Access Plans", provider: "Legal Access Plans", slug: "legal-access-plans", icon: "Briefcase", order: 4 },

      // Lifestyle
      { category: "lifestyle", name: "Virtual Pet Care Only", provider: "", slug: "virtual-pet-care", shortDescription: "24/7 On Demand Care", icon: "PawPrint", order: 0 },
      { category: "lifestyle", name: "Basic + Retail Discount Services", provider: "", slug: "basic-retail-discounts", shortDescription: "24/7 On Demand Care", icon: "ShoppingBag", order: 1 },
      { category: "lifestyle", name: "Plus + In-Clinic Discounts", provider: "", slug: "plus-clinic-discounts", shortDescription: "On-Demand Care", icon: "ShoppingCart", order: 2 },
      { category: "lifestyle", name: "Roadside Assistance", provider: "RSPA", slug: "roadside-rspa", shortDescription: "RSPA", icon: "Wrench", order: 3 },
      { category: "lifestyle", name: "Travel Assistance & Savings", provider: "Lifeguard", slug: "travel-lifeguard", icon: "Plane", order: 4, isFeatured: true },
      { category: "lifestyle", name: "Shopping & Dining", provider: "BenefitsHub", slug: "shopping-benefitshub", icon: "UtensilsCrossed", order: 5 },
      { category: "lifestyle", name: "Shopping & Dining", provider: "Dental Discount Network Mall", slug: "shopping-careington", icon: "Store", order: 6 },
      { category: "lifestyle", name: "Shopping & Dining", provider: "Access Development", slug: "shopping-access", icon: "Utensils", order: 7 },
      { category: "lifestyle", name: "Health Club Network", provider: "ChooseHealthy + Fitness", slug: "health-club-network", icon: "Dumbbell", order: 8 },
      { category: "lifestyle", name: "Roadside Assistance", provider: "RSPD", slug: "roadside-rspd", shortDescription: "RSPD", icon: "Car", order: 9 },

      // Tax
      { category: "tax", name: "Tax Hotline", provider: "Tax Rite Hotline", slug: "tax-hotline", icon: "Calculator", order: 0, isFeatured: true },

      // Wellness
      { category: "wellness", name: "GLP-1", provider: "", slug: "glp-1", shortDescription: "Direct Delivery", icon: "Pill", order: 0 },
      { category: "wellness", name: "Cannabis Therapy", provider: "Leafwell", slug: "cannabis-leafwell", icon: "Leaf", order: 1 },
      { category: "wellness", name: "Vitamins & Nutrition", provider: "Swanson Health Products", slug: "vitamins-swanson", icon: "Apple", order: 2 },
      { category: "wellness", name: "Health Advocacy", provider: "Health Advocate Core", slug: "health-advocacy", icon: "Users", order: 3, isFeatured: true },
      { category: "wellness", name: "Healthcare Synergies", provider: "", slug: "healthcare-synergies", icon: "Network", order: 4 },
      { category: "wellness", name: "Long-Term Care", provider: "Healthcare Synergies", slug: "long-term-care", icon: "Home", order: 5 },

      // Services
      { category: "services", name: "TruVo AI / Mobile Platform", provider: "", slug: "truvo-ai", shortDescription: "Engagement Tool", icon: "Zap", order: 0, isFeatured: true },
      { category: "services", name: "Enrollment & Billing", provider: "Benepower", slug: "enrollment-benepower", shortDescription: "Available on demand", icon: "FileCheck", order: 1 },
      { category: "services", name: "Customer Service", provider: "Benepower", slug: "customer-service-benepower", shortDescription: "Available on demand", icon: "Headphones", order: 2 },
      { category: "services", name: "Communications", provider: "Benepower", slug: "communications-benepower", shortDescription: "Available on demand", icon: "MessageSquare", order: 3 },
      { category: "services", name: "Fulfilment", provider: "Benepower", slug: "fulfilment-benepower", shortDescription: "Available on demand", icon: "Package", order: 4 },
      { category: "services", name: "Custom Development", provider: "Benepower", slug: "custom-dev-benepower", shortDescription: "Available on demand", icon: "Code", order: 5 },
    ];

    for (const product of products) {
      const categoryId = categoryIds[product.category];
      if (categoryId) {
        await ctx.db.insert("nexusProducts", {
          categoryId,
          name: product.name,
          slug: product.slug,
          provider: product.provider || undefined,
          shortDescription: product.shortDescription || undefined,
          icon: product.icon,
          order: product.order,
          isVisible: true,
          isFeatured: product.isFeatured || false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true, message: "Nexus data seeded successfully" };
  },
});

// Clear all Nexus data (for testing)
export const clearData = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("nexusProducts").collect();
    for (const product of products) {
      await ctx.db.delete(product._id);
    }

    const categories = await ctx.db.query("nexusCategories").collect();
    for (const category of categories) {
      await ctx.db.delete(category._id);
    }

    const leads = await ctx.db.query("nexusLeads").collect();
    for (const lead of leads) {
      await ctx.db.delete(lead._id);
    }

    return { success: true, message: "Nexus data cleared" };
  },
});

// Reseed - clear and reseed data
export const reseedData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing data
    const products = await ctx.db.query("nexusProducts").collect();
    for (const product of products) {
      await ctx.db.delete(product._id);
    }

    const categories = await ctx.db.query("nexusCategories").collect();
    for (const category of categories) {
      await ctx.db.delete(category._id);
    }

    // Run seed
    const now = Date.now();

    // Create categories
    const categoryList = [
      { name: "Financial", slug: "financial", icon: "DollarSign", color: "emerald", order: 0 },
      { name: "Health", slug: "health", icon: "Heart", color: "red", order: 1 },
      { name: "Legal", slug: "legal", icon: "Scale", color: "blue", order: 2 },
      { name: "Lifestyle", slug: "lifestyle", icon: "Sparkles", color: "purple", order: 3 },
      { name: "Tax", slug: "tax", icon: "Calculator", color: "amber", order: 4 },
      { name: "Wellness", slug: "wellness", icon: "Leaf", color: "green", order: 5 },
      { name: "Services", slug: "services", icon: "Settings", color: "slate", order: 6 },
    ];

    const categoryIds: Record<string, Id<"nexusCategories">> = {};
    for (const cat of categoryList) {
      const id = await ctx.db.insert("nexusCategories", {
        ...cat,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      });
      categoryIds[cat.slug] = id;
    }

    // Create products (same as original seed)
    const productsList = [
      // Financial
      { category: "financial", name: "Financial Counseling", provider: "ASKF", slug: "financial-counseling-askf", icon: "DollarSign", order: 0 },
      { category: "financial", name: "Financial Services", provider: "Legal Club of America", slug: "financial-services-lca", icon: "Wallet", order: 1 },
      { category: "financial", name: "Legal Referral Program", provider: "Legal Club of America", slug: "legal-referral-lca", icon: "FileText", order: 2 },
      { category: "financial", name: "Financial Organizer + AI Coach", provider: "TallyUp", slug: "financial-organizer-tallyup", icon: "BarChart3", order: 3, isFeatured: true },

      // Health
      { category: "health", name: "Dental", provider: "Dental Discount Network POS", slug: "dental-careington", shortDescription: "Discount Network", icon: "Tooth", order: 0 },
      { category: "health", name: "Vision", provider: "", slug: "vision", shortDescription: "Discount Network", icon: "Eye", order: 1 },
      { category: "health", name: "Teledentistry", provider: "", slug: "teledentistry", shortDescription: "On-Demand Care", icon: "Video", order: 2 },
      { category: "health", name: "Hearing", provider: "", slug: "hearing", shortDescription: "Discount Network", icon: "Ear", order: 3 },
      { category: "health", name: "Diabetic Supplies", provider: "Better Living Now", slug: "diabetic-supplies", shortDescription: "Discount Network", icon: "Droplet", order: 4 },
      { category: "health", name: "Virtual Urgent Care", provider: "", slug: "virtual-urgent-care", shortDescription: "24/7 On Demand Care", icon: "AlertCircle", order: 5 },
      { category: "health", name: "Virtual Primary Care", provider: "", slug: "virtual-primary-care", shortDescription: "On-Demand Care", icon: "Stethoscope", order: 6, isFeatured: true },
      { category: "health", name: "Virtual Behaviour Care", provider: "", slug: "virtual-behaviour-care", shortDescription: "24/7 On Demand Care", icon: "Brain", order: 7 },
      { category: "health", name: "Virtual Dermatology", provider: "", slug: "virtual-dermatology", shortDescription: "On-Demand Care", icon: "Pill", order: 8 },
      { category: "health", name: "Basic", provider: "", slug: "health-basic", shortDescription: "Essential Wellness", icon: "Heart", order: 9 },
      { category: "health", name: "Plus", provider: "", slug: "health-plus", shortDescription: "Complete Wellness", icon: "HeartPlus", order: 10 },
      { category: "health", name: "Delux", provider: "", slug: "health-delux", shortDescription: "Complete Plus", icon: "HeartHandshake", order: 11 },
      { category: "health", name: "Quest Plus Full Panel", provider: "", slug: "quest-plus", shortDescription: "1200 Labs, Urine, Cultures", icon: "Microscope", order: 12 },
      { category: "health", name: "AI Powered Dental Plan Solution", provider: "AI Oral Scanning", slug: "ai-dental-ai-oral-scanning", icon: "Sparkles", order: 13 },
      { category: "health", name: "Chronic Disease Care", provider: "Chronilogix", slug: "chronic-care-chronilogix", icon: "Activity", order: 14 },

      // Legal
      { category: "legal", name: "Legal Aid", provider: "iWTNS", slug: "legal-aid-iwtns", icon: "Scale", order: 0, isFeatured: true },
      { category: "legal", name: "ID Resolution", provider: "", slug: "id-resolution", icon: "Shield", order: 1 },
      { category: "legal", name: "Identity Theft Recovery", provider: "IDX", slug: "identity-theft-idx", icon: "Lock", order: 2 },
      { category: "legal", name: "Allstate Identity Protection Core", provider: "Allstate", slug: "allstate-identity", icon: "SafeCircle", order: 3 },
      { category: "legal", name: "Legal Access Plans", provider: "Legal Access Plans", slug: "legal-access-plans", icon: "Briefcase", order: 4 },

      // Lifestyle
      { category: "lifestyle", name: "Virtual Pet Care Only", provider: "", slug: "virtual-pet-care", shortDescription: "24/7 On Demand Care", icon: "PawPrint", order: 0 },
      { category: "lifestyle", name: "Basic + Retail Discount Services", provider: "", slug: "basic-retail-discounts", shortDescription: "24/7 On Demand Care", icon: "ShoppingBag", order: 1 },
      { category: "lifestyle", name: "Plus + In-Clinic Discounts", provider: "", slug: "plus-clinic-discounts", shortDescription: "On-Demand Care", icon: "ShoppingCart", order: 2 },
      { category: "lifestyle", name: "Roadside Assistance", provider: "RSPA", slug: "roadside-rspa", shortDescription: "RSPA", icon: "Wrench", order: 3 },
      { category: "lifestyle", name: "Travel Assistance & Savings", provider: "Lifeguard", slug: "travel-lifeguard", icon: "Plane", order: 4, isFeatured: true },
      { category: "lifestyle", name: "Shopping & Dining", provider: "BenefitsHub", slug: "shopping-benefitshub", icon: "UtensilsCrossed", order: 5 },
      { category: "lifestyle", name: "Shopping & Dining", provider: "Dental Discount Network Mall", slug: "shopping-careington", icon: "Store", order: 6 },
      { category: "lifestyle", name: "Shopping & Dining", provider: "Access Development", slug: "shopping-access", icon: "Utensils", order: 7 },
      { category: "lifestyle", name: "Health Club Network", provider: "ChooseHealthy + Fitness", slug: "health-club-network", icon: "Dumbbell", order: 8 },
      { category: "lifestyle", name: "Roadside Assistance", provider: "RSPD", slug: "roadside-rspd", shortDescription: "RSPD", icon: "Car", order: 9 },

      // Tax
      { category: "tax", name: "Tax Hotline", provider: "Tax Rite Hotline", slug: "tax-hotline", icon: "Calculator", order: 0, isFeatured: true },

      // Wellness
      { category: "wellness", name: "GLP-1", provider: "", slug: "glp-1", shortDescription: "Direct Delivery", icon: "Pill", order: 0 },
      { category: "wellness", name: "Cannabis Therapy", provider: "Leafwell", slug: "cannabis-leafwell", icon: "Leaf", order: 1 },
      { category: "wellness", name: "Vitamins & Nutrition", provider: "Swanson Health Products", slug: "vitamins-swanson", icon: "Apple", order: 2 },
      { category: "wellness", name: "Health Advocacy", provider: "Health Advocate Core", slug: "health-advocacy", icon: "Users", order: 3, isFeatured: true },
      { category: "wellness", name: "Healthcare Synergies", provider: "", slug: "healthcare-synergies", icon: "Network", order: 4 },
      { category: "wellness", name: "Long-Term Care", provider: "Healthcare Synergies", slug: "long-term-care", icon: "Home", order: 5 },

      // Services
      { category: "services", name: "TruVo AI / Mobile Platform", provider: "", slug: "truvo-ai", shortDescription: "Engagement Tool", icon: "Zap", order: 0, isFeatured: true },
      { category: "services", name: "Enrollment & Billing", provider: "Benepower", slug: "enrollment-benepower", shortDescription: "Available on demand", icon: "FileCheck", order: 1 },
      { category: "services", name: "Customer Service", provider: "Benepower", slug: "customer-service-benepower", shortDescription: "Available on demand", icon: "Headphones", order: 2 },
      { category: "services", name: "Communications", provider: "Benepower", slug: "communications-benepower", shortDescription: "Available on demand", icon: "MessageSquare", order: 3 },
      { category: "services", name: "Fulfilment", provider: "Benepower", slug: "fulfilment-benepower", shortDescription: "Available on demand", icon: "Package", order: 4 },
      { category: "services", name: "Custom Development", provider: "Benepower", slug: "custom-dev-benepower", shortDescription: "Available on demand", icon: "Code", order: 5 },
    ];

    for (const product of productsList) {
      const categoryId = categoryIds[product.category];
      if (categoryId) {
        await ctx.db.insert("nexusProducts", {
          categoryId,
          name: product.name,
          slug: product.slug,
          provider: product.provider || undefined,
          shortDescription: product.shortDescription || undefined,
          icon: product.icon,
          order: product.order,
          isVisible: true,
          isFeatured: product.isFeatured || false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return { success: true, message: "Nexus data reseeded successfully" };
  },
});
