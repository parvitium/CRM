import { describe, expect, it } from "vitest";
import { EXTRA_EDIT_HOURLY_CENTS, PLANS, PLAN_BY_SLUG } from "../../src/config/plans";
import { PACKAGE_IDS } from "../../src/ids";

describe("plan catalog", () => {
  it("is the single source of prices for both product lines", () => {
    expect(PLAN_BY_SLUG["parvitium-one-page"]).toMatchObject({
      setupPriceCents: 79_700,
      monthlyPriceCents: 3_900,
    });
    expect(PLAN_BY_SLUG["parvitium-starter"]).toMatchObject({
      setupPriceCents: 120_000,
      monthlyPriceCents: 4_900,
    });
    expect(PLAN_BY_SLUG["parvitium-job-pages"]).toMatchObject({
      setupPriceCents: 240_000,
      monthlyPriceCents: 9_900,
    });
    expect(PLAN_BY_SLUG["tt-free"]).toMatchObject({ monthlyPriceCents: 0 });
    expect(PLAN_BY_SLUG["tt-pro-listing"]).toMatchObject({ monthlyPriceCents: 2_900 });
    expect(PLAN_BY_SLUG["tt-featured-leads"]).toMatchObject({ monthlyPriceCents: 7_900 });
    expect(PLAN_BY_SLUG["tt-managed-growth"]).toMatchObject({ monthlyPriceCents: 22_900 });
    expect(EXTRA_EDIT_HOURLY_CENTS).toBe(12_500);
  });

  it("exposes stable ids used by seed and tests", () => {
    expect(PACKAGE_IDS.starter).toBe(PLAN_BY_SLUG["parvitium-starter"].id);
    expect(PACKAGE_IDS.ttFree).toBe(PLAN_BY_SLUG["tt-free"].id);
    expect(new Set(PLANS.map((plan) => plan.slug)).size).toBe(PLANS.length);
    expect(PLANS.some((plan) => plan.productLine === "parvitium")).toBe(true);
    expect(PLANS.some((plan) => plan.productLine === "tooele_trades")).toBe(true);
  });
});
