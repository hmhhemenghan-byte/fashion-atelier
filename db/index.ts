import { drizzle } from "drizzle-orm/d1";
import { getRuntimeEnv } from "@/lib/runtime";
import * as schema from "./schema";

export async function getDb() {
  const { DB } = await getRuntimeEnv();
  if (!DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(DB, { schema });
}
