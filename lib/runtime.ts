type FashionRuntimeEnv = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ADMIN_EMAILS?: string;
  AUTH_PROVIDER?: string;
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
};

export type AuthRuntimeConfig = {
  provider: "sites" | "cloudflare-access";
  policyAudience: string | null;
  teamDomain: string | null;
};

let runtimeEnvPromise: Promise<FashionRuntimeEnv> | undefined;

export function getRuntimeEnv(): Promise<FashionRuntimeEnv> {
  // Keep the Workers-native module lazy: Sites validates the built artifact in
  // Node before launching it in workerd, where this module becomes available.
  runtimeEnvPromise ??= import("cloudflare:workers").then(
    ({ env }) => env as unknown as FashionRuntimeEnv,
  );
  return runtimeEnvPromise;
}

export async function getBucket(): Promise<R2Bucket> {
  const bucket = (await getRuntimeEnv()).BUCKET;
  if (!bucket) {
    throw new Error(
      "Cloudflare R2 binding `BUCKET` is unavailable. Set the `r2` field in .openai/hosting.json to `BUCKET`.",
    );
  }
  return bucket;
}

export async function getAdminEmails(): Promise<Set<string>> {
  const value = (await getRuntimeEnv()).ADMIN_EMAILS ?? "";
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getAuthRuntimeConfig(): Promise<AuthRuntimeConfig> {
  const runtime = await getRuntimeEnv();
  const provider =
    runtime.AUTH_PROVIDER?.trim().toLowerCase() === "cloudflare-access"
      ? "cloudflare-access"
      : "sites";

  return {
    provider,
    policyAudience: runtime.POLICY_AUD?.trim() || null,
    teamDomain: runtime.TEAM_DOMAIN?.trim() || null,
  };
}

export async function isAdminEmail(email: string): Promise<boolean> {
  return (await getAdminEmails()).has(email.trim().toLowerCase());
}
