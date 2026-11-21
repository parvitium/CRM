import type { Actor } from "./domain/authz";
import type { Adapters } from "./adapters";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    actor: Actor | null;
    csrfToken: string | null;
    sessionId: string | null;
    adapters: Adapters;
    formBody?: Record<string, string | File>;
    jsonBody?: Record<string, unknown>;
  };
};
