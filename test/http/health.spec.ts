import { describe, expect, it } from "vitest";
import { workerFetch } from "../helpers";

describe("health", () => {
  it("returns ok without auth", async () => {
    const res = await workerFetch("https://crm.test/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});
