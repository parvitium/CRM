/**
 * Canonical Parvitium + TooeleTrades plan catalog.
 * Prices live here — not in views, seed comments, or scattered SQL literals.
 * Seed `packages` rows and admin UI must match this file.
 *
 * Parvitium website packages: https://parvitium.com/websites/
 * TooeleTrades listing tiers: Adam’s current directory plans.
 */

export const PRODUCT_LINES = ["parvitium", "tooele_trades"] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number];

export const CUSTOMER_KINDS = ["parvitium", "tooele_trades", "both"] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

export type Plan = {
  id: string;
  productLine: ProductLine;
  name: string;
  slug: string;
  setupPriceCents: number;
  monthlyPriceCents: number;
  description: string;
  sortOrder: number;
};

/** Extra site edits past the monthly cap. From Parvitium website packages. */
export const EXTRA_EDIT_HOURLY_CENTS = 12_500;

export const PLANS: readonly Plan[] = [
  {
    id: "11111111-0000-4000-8000-000000000001",
    productLine: "parvitium",
    name: "One-Page",
    slug: "parvitium-one-page",
    setupPriceCents: 79_700,
    monthlyPriceCents: 3_900,
    description: "One page on your own domain. $797 setup + $39/mo website + hosting.",
    sortOrder: 10,
  },
  {
    id: "11111111-0000-4000-8000-000000000002",
    productLine: "parvitium",
    name: "Starter",
    slug: "parvitium-starter",
    setupPriceCents: 120_000,
    monthlyPriceCents: 4_900,
    description:
      "1–3 pages. $1,200 setup + $49/mo. Optional year-one plan: $600 deposit then $99/mo × 12.",
    sortOrder: 20,
  },
  {
    id: "11111111-0000-4000-8000-000000000003",
    productLine: "parvitium",
    name: "Job Pages",
    slug: "parvitium-job-pages",
    setupPriceCents: 240_000,
    monthlyPriceCents: 9_900,
    description:
      "5–7 pages. $2,400 setup + $99/mo. Optional year-one plan: $1,200 deposit then $199/mo × 12.",
    sortOrder: 30,
  },
  {
    id: "11111111-0000-4000-8000-000000000010",
    productLine: "tooele_trades",
    name: "Free listing",
    slug: "tt-free",
    setupPriceCents: 0,
    monthlyPriceCents: 0,
    description: "Free TooeleTrades.com directory listing.",
    sortOrder: 100,
  },
  {
    id: "11111111-0000-4000-8000-000000000011",
    productLine: "tooele_trades",
    name: "Pro Listing",
    slug: "tt-pro-listing",
    setupPriceCents: 0,
    monthlyPriceCents: 2_900,
    description: "TooeleTrades Pro Listing. $29/mo, listed above free listings.",
    sortOrder: 110,
  },
  {
    id: "11111111-0000-4000-8000-000000000012",
    productLine: "tooele_trades",
    name: "Featured + Leads",
    slug: "tt-featured-leads",
    setupPriceCents: 0,
    monthlyPriceCents: 7_900,
    description: "Featured (Sponsored) directory placement plus lead routing. $79/mo.",
    sortOrder: 120,
  },
  {
    id: "11111111-0000-4000-8000-000000000013",
    productLine: "tooele_trades",
    name: "Managed Growth",
    slug: "tt-managed-growth",
    setupPriceCents: 0,
    monthlyPriceCents: 22_900,
    description: "Directory plus managed marketing. $229/mo.",
    sortOrder: 130,
  },
];

export const PLAN_BY_ID: Readonly<Record<string, Plan>> = Object.fromEntries(
  PLANS.map((plan) => [plan.id, plan]),
) as Readonly<Record<string, Plan>>;

export const PLAN_BY_SLUG: Readonly<Record<string, Plan>> = Object.fromEntries(
  PLANS.map((plan) => [plan.slug, plan]),
) as Readonly<Record<string, Plan>>;

export function isCustomerKind(value: string): value is CustomerKind {
  return (CUSTOMER_KINDS as readonly string[]).includes(value);
}

export function isProductLine(value: string): value is ProductLine {
  return (PRODUCT_LINES as readonly string[]).includes(value);
}

export function plansForLine(line: ProductLine): Plan[] {
  return PLANS.filter((plan) => plan.productLine === line);
}

export function requirePlanBySlug(slug: string): Plan {
  const plan = PLAN_BY_SLUG[slug];
  if (!plan) {
    throw new Error(`Unknown plan slug: ${slug}`);
  }
  return plan;
}

export function customerKindLabel(kind: string | null | undefined): string {
  if (kind === "tooele_trades") {
    return "TooeleTrades";
  }
  if (kind === "parvitium") {
    return "Parvitium";
  }
  if (kind === "both") {
    return "Parvitium + TooeleTrades";
  }
  return kind ?? "—";
}
