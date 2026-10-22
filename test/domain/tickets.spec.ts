import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  assertCanSubmitQa,
  assertCanTransition,
  canTransition,
  stageAfterQa,
} from "../../src/domain/tickets";

describe("ticket stage machine", () => {
  it("follows backlog → ready → in-dev → in-qa → needs-adam → closed", () => {
    expect(canTransition("backlog", "ready")).toBe(true);
    expect(canTransition("ready", "in-dev")).toBe(true);
    expect(canTransition("in-dev", "in-qa")).toBe(true);
    expect(canTransition("in-qa", "needs-adam")).toBe(true);
    expect(canTransition("needs-adam", "closed")).toBe(true);
  });

  it("rejects skipping stages", () => {
    expect(canTransition("backlog", "closed")).toBe(false);
    expect(canTransition("ready", "needs-adam")).toBe(false);
    expect(() => assertCanTransition("backlog", "in-qa")).toThrow(/Cannot move/);
  });

  it("sends a QA fail back to in-dev and a pass to needs-adam", () => {
    expect(stageAfterQa("fail")).toBe("in-dev");
    expect(stageAfterQa("pass")).toBe("needs-adam");
    expect(allowedTransitions("in-qa")).toContain("in-dev");
  });

  it("only allows QA while the ticket is in-qa", () => {
    expect(() => assertCanSubmitQa("in-dev")).toThrow(/in-qa/);
    expect(() => assertCanSubmitQa("in-qa")).not.toThrow();
  });
});
