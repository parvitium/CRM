import { readFile } from "node:fs/promises";
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const root = import.meta.dirname;
  const migrations = await readD1Migrations(path.join(root, "migrations"));
  const seed = await readFile(path.join(root, "seed/seed.sql"), "utf8");

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            TEST_SEED: seed,
            ALLOW_DEV_LOGIN: "true",
            AUTH_MODE: "magic",
            APP_NAME: "Parvitium CRM",
            CF_ACCESS_TEAM_DOMAIN: "",
            CF_ACCESS_AUD: "",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
