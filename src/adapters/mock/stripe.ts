import type { StripeAdapter, StripeSubscriptionView } from "../types";

const MOCK: Record<string, StripeSubscriptionView> = {
  cus_mock_summit: {
    stripeCustomerId: "cus_mock_summit",
    stripeSubscriptionId: "sub_mock_summit",
    stripePaymentLinkId: "plink_mock_summit",
    status: "active",
    currentPeriodEnd: "2026-11-01T00:00:00.000Z",
  },
  cus_mock_copper: {
    stripeCustomerId: "cus_mock_copper",
    stripeSubscriptionId: "sub_mock_copper",
    stripePaymentLinkId: "plink_mock_copper",
    status: "past_due",
    currentPeriodEnd: "2026-10-12T00:00:00.000Z",
  },
  cus_mock_lakeview: {
    stripeCustomerId: "cus_mock_lakeview",
    stripeSubscriptionId: null,
    stripePaymentLinkId: "plink_mock_lakeview",
    status: "active",
    currentPeriodEnd: "2026-11-20T00:00:00.000Z",
  },
  cus_mock_desert: {
    stripeCustomerId: "cus_mock_desert",
    stripeSubscriptionId: "sub_mock_desert",
    stripePaymentLinkId: "plink_mock_desert",
    status: "active",
    currentPeriodEnd: "2026-11-08T00:00:00.000Z",
  },
};

export class MockStripeAdapter implements StripeAdapter {
  async getSubscription(stripeCustomerId: string): Promise<StripeSubscriptionView | null> {
    return MOCK[stripeCustomerId] ?? null;
  }
}
