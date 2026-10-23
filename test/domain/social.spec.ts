import { describe, expect, it } from "vitest";
import {
  assertAllowedSecretsRef,
  isAllowedSecretsRef,
  isForbiddenSocialField,
} from "../../src/domain/social";

describe("social access model", () => {
  it("allows 1Password pointers and empty refs", () => {
    expect(isAllowedSecretsRef(null)).toBe(true);
    expect(isAllowedSecretsRef("")).toBe(true);
    expect(isAllowedSecretsRef("op://Parvitium/summit-ridge-facebook")).toBe(true);
  });

  it("rejects anything that is not an op:// pointer", () => {
    expect(isAllowedSecretsRef("vault://prod/gbp")).toBe(false);
    expect(isAllowedSecretsRef("aws-secrets://foo")).toBe(false);
    expect(isAllowedSecretsRef("op://")).toBe(false);
    expect(isAllowedSecretsRef("hunter2")).toBe(false);
    expect(() => assertAllowedSecretsRef("EAAG-not-a-pointer")).toThrow(/1Password pointer/);
  });

  it("treats password-like column names as forbidden", () => {
    expect(isForbiddenSocialField("password")).toBe(true);
    expect(isForbiddenSocialField("access_token")).toBe(true);
    expect(isForbiddenSocialField("access_status")).toBe(false);
    expect(isForbiddenSocialField("secrets_manager_ref")).toBe(false);
  });
});
