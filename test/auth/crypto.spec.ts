import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "../../src/auth/crypto";

describe("timingSafeEqual", () => {
  it("matches equal secrets and rejects mismatches without a length short-circuit", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("short", "longer-secret")).toBe(false);
    expect(timingSafeEqual("longer-secret", "short")).toBe(false);
    expect(timingSafeEqual("token", "token\0")).toBe(false);
    expect(timingSafeEqual("", "x")).toBe(false);
    expect(timingSafeEqual("x", "")).toBe(false);

    const source = timingSafeEqual.toString();
    expect(source).not.toMatch(/if\s*\(\s*a\.length\s*!==\s*b\.length\s*\)/);
    expect(source).not.toMatch(/if\s*\(\s*a\.length\s*!=\s*b\.length\s*\)/);
    expect(source).toMatch(/for\s*\(/);
  });
});
