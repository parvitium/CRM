import type { SeoAdapter, SeoSnapshotView } from "../types";

export class MockSeoAdapter implements SeoAdapter {
  async capture(input: { url: string; keyword: string }): Promise<SeoSnapshotView> {
    const hash = [...input.keyword].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const rank = (hash % 12) + 1;
    return {
      keyword: input.keyword,
      searchEngine: "google",
      rank,
      aiCitationScore: Number((1 / rank).toFixed(2)),
      aiCitationNotes: `Mock capture for ${input.url}`,
    };
  }
}
