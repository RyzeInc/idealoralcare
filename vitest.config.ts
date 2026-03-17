import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Default environment for Convex function tests
    environment: "edge-runtime",
    environmentOptions: {
      // Allow crypto.randomUUID() and other Web APIs
    },
    // Set env vars before any module is loaded (required for route.ts module-level env checks)
    env: {
      STRIPE_SECRET_KEY: "sk_test_mock_key_for_tests",
      NEXT_PUBLIC_CONVEX_URL: "https://convex.test",
      NEXT_PUBLIC_APP_URL: "https://app.test",
    },
    server: {
      deps: {
        // convex-test must run inside the module graph
        inline: ["convex-test"],
      },
    },
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "convex/enrollment/dependents.ts",
        "convex/subscriptions/queries.ts",
        "src/app/api/stripe/checkout/route.ts",
        "src/components/enrollment/steps/DependentsStep.tsx",
        "src/components/health/FamilySection.tsx",
        "src/app/health/claim-invite/page.tsx",
      ],
    },
  },
  resolve: {
    alias: {
      // Must order the more-specific prefix first
      "@/convex": path.resolve(__dirname, "./convex"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
