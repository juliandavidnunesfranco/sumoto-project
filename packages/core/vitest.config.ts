import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // los *.e2e.test.ts requieren Supabase local corriendo:
    // se ejecutan a mano con `pnpm test:e2e`
    exclude: ["**/node_modules/**", "**/*.e2e.test.ts"],
  },
});
