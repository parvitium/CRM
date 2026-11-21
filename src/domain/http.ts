export class HttpError extends Error {
  readonly status: number;
  readonly expose: boolean;

  constructor(status: number, message: string, expose = true) {
    super(message);
    this.status = status;
    this.expose = expose;
    this.name = "HttpError";
  }
}

export function wantsJson(request: Request): boolean {
  const accept = request.headers.get("Accept") ?? "";
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/") || accept.includes("application/json");
}
