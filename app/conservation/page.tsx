import React from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { conservationReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conservation & Preservation Archive — NÉRA ATELIER",
  description: "探索 NÉRA ATELIER 状态评估报告、修复记录与预防性保护档案。",
};

export default async function PublicConservationIndexPage() {
  const db = await getDb();

  const publicReports = await db
    .select()
    .from(conservationReports)
    .where(eq(conservationReports.status, "approved"))
    .orderBy(desc(conservationReports.createdAt))
    .limit(24)
    .catch(() => []);

  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
      <header className="border-b border-neutral-800 pb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition">
          ← RETURN TO NÉRA ATELIER
        </Link>
        <span className="text-xs text-emerald-400 uppercase tracking-widest block mt-4">PRESERVATION & CARE</span>
        <h1 className="text-4xl font-light tracking-wider mt-2">CONSERVATION & PRESERVATION ARCHIVE</h1>
        <p className="text-xs text-neutral-400 mt-2">典藏件状态评估、纤维修复与温湿度保护协议 · CONDITION & CARE PROTOCOL</p>
      </header>

      <section className="my-12 space-y-6">
        <div className="flex justify-between items-center text-xs text-neutral-500 border-b border-neutral-900 pb-2">
          <span>APPROVED CONSERVATION REPORTS / 已核验修复报告 ({publicReports.length})</span>
          <span>MUSEUM-GRADE PRESERVATION</span>
        </div>

        {publicReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicReports.map((item) => (
              <div key={item.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-3">
                <div className="flex justify-between items-start text-xs">
                  <span className="border border-neutral-700 px-2 py-0.5 uppercase">
                    Seq #{item.sequence}
                  </span>
                  <span className="text-emerald-400 uppercase">APPROVED</span>
                </div>
                <div className="text-xs text-neutral-500">{item.reportCode}</div>
                <h2 className="text-lg font-normal">Condition: {item.overallCondition}</h2>
                <div className="space-y-1 text-xs text-neutral-400">
                  {item.conditionSummary && <div><span className="text-neutral-500">评估摘要:</span> {item.conditionSummary}</div>}
                  {item.proposedTreatment && <div><span className="text-neutral-500">处置方案:</span> {item.proposedTreatment}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-xs text-neutral-500 text-center">
            公开展出修复报告准备中。请登录 Studio 查看内部保存记录。
          </div>
        )}
      </section>

      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
        <span>NÉRA ATELIER © 2026</span>
        <span>CONSERVATION REGISTRY</span>
      </footer>
    </main>
  );
}
