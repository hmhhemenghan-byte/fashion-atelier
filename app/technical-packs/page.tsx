import React from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { technicalPacks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Technical Specification Portal — NÉRA ATELIER",
  description: "探索 NÉRA ATELIER 时装技术工艺包、版型意图与规格基码。",
};

export default async function PublicTechnicalPacksIndexPage() {
  const db = await getDb();

  const publicPacks = await db
    .select()
    .from(technicalPacks)
    .where(eq(technicalPacks.status, "approved"))
    .orderBy(desc(technicalPacks.createdAt))
    .limit(24)
    .catch(() => []);

  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
      <header className="border-b border-neutral-800 pb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition">
          ← RETURN TO NÉRA ATELIER
        </Link>
        <span className="text-xs text-blue-400 uppercase tracking-widest block mt-4">PATTERN & ARCHITECTURE</span>
        <h1 className="text-4xl font-light tracking-wider mt-2">TECHNICAL SPECIFICATION PORTAL</h1>
        <p className="text-xs text-neutral-400 mt-2">技术工艺包、制作规格与尺寸测量标准 · PATTERN INTENT & BASE SIZE</p>
      </header>

      <section className="my-12 space-y-6">
        <div className="flex justify-between items-center text-xs text-neutral-500 border-b border-neutral-900 pb-2">
          <span>APPROVED TECH PACKS / 已核验技术包 ({publicPacks.length})</span>
          <span>ARCHIVAL PATTERN SPECIFICATIONS</span>
        </div>

        {publicPacks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicPacks.map((item) => (
              <div key={item.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-3">
                <div className="flex justify-between items-start text-xs">
                  <span className="border border-neutral-700 px-2 py-0.5 uppercase">
                    R{item.revision} · {item.sampleStage}
                  </span>
                  <span className="text-emerald-400 uppercase">APPROVED</span>
                </div>
                <div className="text-xs text-neutral-500">{item.techPackCode}</div>
                <h2 className="text-lg font-normal">Base Size: {item.baseSize || "Standard"} ({item.unit})</h2>
                <div className="space-y-1 text-xs text-neutral-400">
                  {item.patternReference && <div><span className="text-neutral-500">纸样编号:</span> {item.patternReference}</div>}
                  {item.fitIntent && <div><span className="text-neutral-500">版型意图:</span> {item.fitIntent}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-xs text-neutral-500 text-center">
            公开展出技术包准备中。请登录 Studio 查看内部制作规格。
          </div>
        )}
      </section>

      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
        <span>NÉRA ATELIER © 2026</span>
        <span>TECHNICAL ARCHIVE</span>
      </footer>
    </main>
  );
}
