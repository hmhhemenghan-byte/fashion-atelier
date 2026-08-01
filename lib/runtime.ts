type FashionRuntimeEnv = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ADMIN_EMAILS?: string;
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
  let value = "";
  try {
    value = (await getRuntimeEnv()).ADMIN_EMAILS ?? "";
  } catch {
    // getRuntimeEnv may fail in non-Workers dev mode
  }
  const set = new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (process.env.NODE_ENV === "development") {
    set.add("designer@local");
  }
  return set;
}

export async function isAdminEmail(email: string): Promise<boolean> {
  const adminEmails = await getAdminEmails();
  if (process.env.NODE_ENV === "development") {
    if (adminEmails.size === 0 || adminEmails.has("designer@local")) return true;
  }
  return adminEmails.has(email.trim().toLowerCase());
}
