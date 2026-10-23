import { describe, expect, it } from "vitest";
import { AuthzError, requireAdmin } from "../../src/domain/authz";

const admin = {
  id: "a",
  email: "adam@parvitium.example",
  displayName: "Adam",
  role: "admin" as const,
};

describe("authz", () => {
  it("requires an admin actor", () => {
    expect(() => requireAdmin(null)).toThrow(AuthzError);
    expect(requireAdmin(admin).role).toBe("admin");
  });
});
