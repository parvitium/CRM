export type Role = "admin";

export type Actor = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
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
