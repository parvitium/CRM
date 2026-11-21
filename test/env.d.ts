declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: D1Migration[];
    TEST_SEED: string;
  }
}

interface ProvidedEnv extends Env {}
