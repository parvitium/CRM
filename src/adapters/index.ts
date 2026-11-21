import type { Adapters } from "./types";
import { MockStripeAdapter } from "./mock/stripe";
import { MockGbpAdapter } from "./mock/gbp";
import { MockSeoAdapter } from "./mock/seo";
import { MockCallAgentAdapter } from "./mock/calls";
import { MockReviewAdapter } from "./mock/reviews";
import { DbEmailAdapter } from "./mock/email";

export function createAdapters(env: Env): Adapters {
  return {
    stripe: new MockStripeAdapter(),
    gbp: new MockGbpAdapter(),
    seo: new MockSeoAdapter(),
    calls: new MockCallAgentAdapter(),
    reviews: new MockReviewAdapter(),
    email: new DbEmailAdapter(env.DB),
  };
}

export type { Adapters } from "./types";
