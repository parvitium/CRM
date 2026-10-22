import { describe, expect, it } from "vitest";
import {
  assertSameCustomer,
  AuthzError,
  requireAdmin,
  requirePortalCustomer,
} from "../../src/domain/authz";

const admin = {
  id: "a",
  email: "adam@parvitium.example",
  displayName: "Adam",
  role: "admin" as const,
  customerId: null,
};

const customer = {
  id: "c",
  email: "portal.summit@example.test",
  displayName: "Jordan",
  role: "customer" as const,
  customerId: "cust-1",
};

describe("authz", () => {
  it("blocks customers from admin routes", () => {
    expect(() => requireAdmin(customer)).toThrow(AuthzError);
    expect(() => requireAdmin(null)).toThrow(AuthzError);
    expect(requireAdmin(admin).role).toBe("admin");
  });

  it("scopes the portal to the signed-in customer", () => {
    expect(requirePortalCustomer(customer).customerId).toBe("cust-1");
    expect(() => requirePortalCustomer(admin)).toThrow(/Customer portal only/);
    expect(() => assertSameCustomer("cust-1", "cust-2")).toThrow(/another customer/);
  });
});
