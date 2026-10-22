export type StripeSubscriptionView = {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePaymentLinkId: string | null;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: string | null;
};

export type GbpProfileView = {
  placeId: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
};

export type SeoSnapshotView = {
  keyword: string;
  searchEngine: string;
  rank: number | null;
  aiCitationScore: number | null;
  aiCitationNotes: string | null;
};

export type CallLogView = {
  externalId: string;
  direction: "inbound" | "outbound";
  fromNumber: string | null;
  toNumber: string | null;
  startedAt: string;
  durationSeconds: number;
  disposition: string | null;
  transcriptPreview: string | null;
};

export type ReviewItemView = {
  source: "google" | "facebook" | "yelp";
  authorName: string;
  rating: number;
  body: string;
  receivedAt: string;
};

export interface StripeAdapter {
  getSubscription(stripeCustomerId: string): Promise<StripeSubscriptionView | null>;
}

export interface GbpAdapter {
  fetchProfile(placeId: string): Promise<GbpProfileView | null>;
}

export interface SeoAdapter {
  capture(input: { url: string; keyword: string }): Promise<SeoSnapshotView>;
}

export interface CallAgentAdapter {
  listCalls(externalCustomerKey: string): Promise<CallLogView[]>;
}

export interface ReviewAdapter {
  listReviews(placeId: string): Promise<ReviewItemView[]>;
}

export interface EmailAdapter {
  sendMagicLink(email: string, url: string): Promise<void>;
}

export type Adapters = {
  stripe: StripeAdapter;
  gbp: GbpAdapter;
  seo: SeoAdapter;
  calls: CallAgentAdapter;
  reviews: ReviewAdapter;
  email: EmailAdapter;
};
