import type { Actor } from "../domain/authz";

/** Cloudflare Access authenticated-user email header. */
export const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";

export async function loadActorFromAccess(
  db: D1Database,
  request: Request,
): Promise<Actor | null> {
  const email = request.headers.get(ACCESS_EMAIL_HEADER)?.trim().toLowerCase();
  if (!email) {
    return null;
  }
  const row = await db
    .prepare("SELECT id, email, display_name, role, customer_id FROM users WHERE email = ?")
    .bind(email)
    .first<{
      id: string;
      email: string;
      display_name: string;
      role: Actor["role"];
      customer_id: string | null;
    }>();
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    customerId: row.customer_id,
  };
}
