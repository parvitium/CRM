import type { ReviewAdapter, ReviewItemView } from "../types";

const MOCK: Record<string, ReviewItemView[]> = {
  ChIJmocksummit: [
    {
      source: "google",
      authorName: "A. Fictional",
      rating: 5,
      body: "Showed up the day after the wind storm. Clean work.",
      receivedAt: "2026-10-12T00:00:00.000Z",
    },
  ],
};

export class MockReviewAdapter implements ReviewAdapter {
  async listReviews(placeId: string): Promise<ReviewItemView[]> {
    return MOCK[placeId] ?? [];
  }
}
