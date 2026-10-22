export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Timing-safe compare. Always scans both inputs and never returns early
 * on a length mismatch (no length short-circuit).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const n = Math.max(left.byteLength, right.byteLength, 1);
  let mismatch = left.byteLength ^ right.byteLength;
  for (let i = 0; i < n; i += 1) {
    const l = i < left.byteLength ? left[i]! : 0xff;
    const r = i < right.byteLength ? right[i]! : 0xff;
    mismatch |= l ^ r;
  }
  return mismatch === 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function hoursFromNowIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function daysFromNowIso(days: number): string {
  return hoursFromNowIso(days * 24);
}
