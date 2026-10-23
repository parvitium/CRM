import { nowIso } from "../../auth/crypto";
import type { EmailAdapter } from "../types";

/** Persists outbound mail for later Resend swap. Never log secrets. */
export class DbEmailAdapter implements EmailAdapter {
  constructor(private readonly db: D1Database) {}

  async send(input: { to: string; subject: string; body: string }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO outbound_emails (id, to_email, subject, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), input.to, input.subject, input.body, nowIso())
      .run();
    console.log(JSON.stringify({ msg: "mock_email", to: input.to, subject: input.subject }));
  }
}
