/**
 * Deployment environment helpers.
 *
 * NODE_ENV carries three meaningful values in this project: development (local),
 * staging and production (both Cloud Run). Code must not test `NODE_ENV !== 'production'`
 * to mean "local", because staging would then be treated as a developer machine.
 *
 * These are functions rather than constants so they are evaluated after dotenv has
 * populated process.env, regardless of module import order.
 */

export type AppEnvironment = "development" | "staging" | "production";

// Resolves the deployment environment from NODE_ENV, defaulting to development.
export function getAppEnvironment(): AppEnvironment {
  const value = (process.env.NODE_ENV ?? "development").toLowerCase();
  if (value === "production") return "production";
  if (value === "staging") return "staging";
  return "development";
}

export const isProduction = (): boolean => getAppEnvironment() === "production";

export const isStaging = (): boolean => getAppEnvironment() === "staging";

export const isDevelopment = (): boolean => getAppEnvironment() === "development";

// True for any cloud-deployed environment. Staging and production both run on real
// infrastructure and must never fall back to developer-only behaviour.
export const isDeployed = (): boolean => !isDevelopment();
