import type { CallAgentAdapter, CallLogView } from "../types";

/** Retell-compatible mock. Keyed by fictional external customer key. */
const MOCK: Record<string, CallLogView[]> = {
  summit: [
    {
      externalId: "retell_mock_001",
      direction: "inbound",
      fromNumber: "+14355550199",
      toNumber: "+14355550101",
      startedAt: "2026-10-16T15:04:00.000Z",
      durationSeconds: 186,
      disposition: "booked",
      transcriptPreview: "Caller asked for a roof leak inspection this week.",
    },
  ],
};

export class MockCallAgentAdapter implements CallAgentAdapter {
  async listCalls(externalCustomerKey: string): Promise<CallLogView[]> {
    return MOCK[externalCustomerKey] ?? [];
  }
}
