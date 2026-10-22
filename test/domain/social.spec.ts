import { describe, expect, it } from "vitest";
import {
  assertAllowedSecretsRef,
  isAllowedSecretsRef,
  isForbiddenSocialField,
} from "../../src/domain/social";

describe("social access model", () => {
  it("allows vault pointers and empty refs", () => {
    expect(isAllowedSecretsRef(null)).toBe(true);
    expect(isAllowedSecretsRef("op://Parvitium/summit-ridge-facebook")).toBe(true);
    expect(isAllowedSecretsRef("vault://prod/gbp")).toBe(true);
  });

  it("rejects anything that looks like a stored secret", () => {
    expect(isAllowedSecretsRef("hunter2")).toBe(false);
    expect(isAllowedSecretsRef("password=secret")).toBe(false);
    expect(() => assertAllowedSecretsRef("EAAG-not-a-pointer")).toThrow(/vault pointer/);
  });

  it("treats password-like column names as forbidden", () => {
    expect(isForbiddenSocialField("password")).toBe(true);
    expect(isForbiddenSocialField("access_token")).toBe(true);
    expect(isForbiddenSocialField("access_status")).toBe(false);
    expect(isForbiddenSocialField("secrets_manager_ref")).toBe(false);
  });
});
