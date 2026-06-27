import { Polar } from "@polar-sh/sdk";
import { env, isPolarConfigured } from "@/lib/env";

let client: Polar | null = null;

/** Polar API client, or null when Polar is not configured (mock-pay mode). */
export function getPolarClient(): Polar | null {
  if (!isPolarConfigured) return null;
  if (!client) {
    client = new Polar({
      accessToken: env.polarAccessToken!,
      server: env.polarServer,
    });
  }
  return client;
}
