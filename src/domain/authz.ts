export type Role = "admin" | "customer";

export type Actor = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  customerId: string | null;
};

export class AuthzError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthzError";
  }
}

export function requireUser(actor: Actor | null): Actor {
  if (!actor) {
    throw new AuthzError(401, "Sign in required");
  }
  return actor;
}

export function requireAdmin(actor: Actor | null): Actor {
  const user = requireUser(actor);
  if (user.role !== "admin") {
    throw new AuthzError(403, "Admin only");
  }
  return user;
}

/**
 * Portal data is always scoped to the signed-in customer's id.
 * Callers must never pass a customer id from the URL for authorization.
 */
export function requirePortalCustomer(actor: Actor | null): Actor & { customerId: string } {
  const user = requireUser(actor);
  if (user.role !== "customer" || !user.customerId) {
    throw new AuthzError(403, "Customer portal only");
  }
  return { ...user, customerId: user.customerId };
}

export function assertSameCustomer(actorCustomerId: string, requestedCustomerId: string): void {
  if (actorCustomerId !== requestedCustomerId) {
    throw new AuthzError(403, "Cannot access another customer");
  }
}
