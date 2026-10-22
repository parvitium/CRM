import { nowIso } from "../../auth/crypto";
import type { EmailAdapter } from "../types";

/** Persists outbound mail so tests can read the magic-link URL. Never log the raw token. */
export class DbEmailAdapter implements EmailAdapter {
  constructor(private readonly db: D1Database) {}

  async sendMagicLink(email: string, url: string): Promise<void> {
    const subject = "Your Parvitium CRM sign-in link";
    const body = `Sign in (15 minutes): ${url}`;
    await this.db
      .prepare(
        `INSERT INTO outbound_emails (id, to_email, subject, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), email, subject, body, nowIso())
      .run();
    console.log(JSON.stringify({ msg: "mock_email", to: email, subject }));
  }
}
