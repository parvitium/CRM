/** Stable fictional IDs shared by seed.sql and tests. Not real customers. */

import { requirePlanBySlug } from "./config/plans";

export const PACKAGE_IDS = {
  onePage: requirePlanBySlug("parvitium-one-page").id,
  starter: requirePlanBySlug("parvitium-starter").id,
  jobPages: requirePlanBySlug("parvitium-job-pages").id,
  ttFree: requirePlanBySlug("tt-free").id,
  ttPro: requirePlanBySlug("tt-pro-listing").id,
  ttFeatured: requirePlanBySlug("tt-featured-leads").id,
  ttManaged: requirePlanBySlug("tt-managed-growth").id,
} as const;

export const TEMPLATE_IDS = {
  onePager: "12121212-0000-4000-8000-000000000001",
  tradesHome: "12121212-0000-4000-8000-000000000002",
  jobPages: "12121212-0000-4000-8000-000000000003",
} as const;

export const CUSTOMER_IDS = {
  summit: "22222222-0000-4000-8000-000000000001",
  copper: "22222222-0000-4000-8000-000000000002",
  lakeview: "22222222-0000-4000-8000-000000000003",
  desert: "22222222-0000-4000-8000-000000000004",
  wasatch: "22222222-0000-4000-8000-000000000005",
} as const;

export const USER_IDS = {
  adam: "33333333-0000-4000-8000-000000000001",
} as const;

export const EMAILS = {
  adam: "adam@parvitium.example",
} as const;
