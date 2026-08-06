import React from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { provenanceDossiers } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provenance Verification Portal — NÉRA ATELIER",
  description: "查验 NÉRA ATELIER 时装作品的权威出处、封样数据与出厂证明。",
};

export default async function PublicProvenanceIndexPage() {
  const db = await getDb();
  
  const dossiers = await db
    .select()
    .from(provenanceDossiers)
    .orderBy(desc(provenanceDossiers.createdAt))
    .limit(20)
    .catch(() => []);

  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
      <header className="border-b border-neutral-800 pb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition">
          ← RETURN TO NÉRA ATELIER
        </Link>
        <span className="text-xs text-amber-400 uppercase tracking-widest block mt-4">AUTHENTICITY & PROVENANCE</span>
        <h1 className="text-4xl font-light tracking-wider mt-2">PROVENANCE VERIFICATION</h1>
        <p className="text-xs text-neutral-400 mt-2">权威出处卷宗查验中心 · NERA-SEAL & NERA-GO</p>
      </header>

      <section className="my-12 space-y-6">
        <div className="p-6 border border-neutral-800 bg-neutral-950 max-w-xl">
          <label className="text-xs text-neutral-400 uppercase tracking-widest block mb-2">
            SEARCH DOSSIER OR SEAL CODE / 查询卷宗或防伪码
          </label>
          <form action="/provenance" method="GET" className="flex gap-2">
            <input
              type="text"
              name="query"
              placeholder="e.g. DOS-2026-001 or NERA-SEAL-01"
              className="flex-1 bg-black border border-neutral-800 p-2 text-xs text-white focus:outline-none focus:border-neutral-500"
            />
            <button type="submit" className="px-4 py-2 bg-neutral-900 border border-neutral-700 text-xs hover:bg-neutral-800 transition">
              SEARCH
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs text-neutral-500 uppercase tracking-widest">
            RECENT VERIFIED DOSSIERS / 最新验证卷宗 ({dossiers.length})
          </h2>

          {dossiers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dossiers.map((item) => (
                <Link
                  key={item.id}
                  href={`/provenance/${item.slug}`}
                  className="p-4 border border-neutral-800 bg-neutral-950 hover:border-neutral-600 transition space-y-2 block"
                >
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>{item.dossierCode}</span>
                    <span className="text-emerald-400">VERIFIED</span>
                  </div>
                  <h3 className="text-sm font-normal">{item.title}</h3>
                  <div className="text-xs text-neutral-500">Slug: {item.slug}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 border border-neutral-800 bg-neutral-950 text-xs text-neutral-500 text-center">
              目前尚未发布公开查验卷宗。
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
        <span>NÉRA ATELIER © 2026</span>
        <span>PROVENANCE REGISTRY</span>
      </footer>
    </main>
  );
}
