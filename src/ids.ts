/** Stable fictional IDs shared by seed.sql and tests. Not real customers. */

export const PACKAGE_IDS = {
  onePage: "11111111-0000-4000-8000-000000000001",
  starter: "11111111-0000-4000-8000-000000000002",
  jobPages: "11111111-0000-4000-8000-000000000003",
  managedGrowth: "11111111-0000-4000-8000-000000000004",
  ttPro: "11111111-0000-4000-8000-000000000011",
  ttFeatured: "11111111-0000-4000-8000-000000000012",
  ttManaged: "11111111-0000-4000-8000-000000000013",
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
} as const;

export const USER_IDS = {
  adam: "33333333-0000-4000-8000-000000000001",
  summitPortal: "33333333-0000-4000-8000-000000000101",
  copperPortal: "33333333-0000-4000-8000-000000000102",
  lakeviewPortal: "33333333-0000-4000-8000-000000000103",
  desertPortal: "33333333-0000-4000-8000-000000000104",
} as const;

export const EMAILS = {
  adam: "adam@parvitium.example",
  summit: "portal.summit@example.test",
  copper: "portal.copper@example.test",
  lakeview: "portal.lakeview@example.test",
  desert: "portal.desert@example.test",
} as const;
