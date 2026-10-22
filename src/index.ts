import { createApp } from "./app";
import { sweepExpiredRateLimitEvents } from "./auth/rate-limit";

const app = createApp();

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  async scheduled(controller, env) {
    await sweepExpiredRateLimitEvents(env.DB, controller.scheduledTime);
  },
} satisfies ExportedHandler<Env>;
