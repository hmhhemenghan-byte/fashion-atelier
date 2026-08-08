import React from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { works, collections, materials, technicalPacks, provenanceDossiers, conservationReports } from "@/db/schema";
import { count, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Atelier Research & Heritage Index — NÉRA ATELIER",
  description: "NÉRA ATELIER 典藏研究与当代时装生产档案检索总库。",
};

export default async function PublicArchiveIndexPage() {
  const db = await getDb();

  const [worksRes] = await db.select({ total: count() }).from(works).where(eq(works.status, "published")).catch(() => [{ total: 0 }]);
  const [collectionsRes] = await db.select({ total: count() }).from(collections).where(eq(collections.status, "published")).catch(() => [{ total: 0 }]);
  const [materialsRes] = await db.select({ total: count() }).from(materials).where(eq(materials.status, "approved")).catch(() => [{ total: 0 }]);
  const [techPacksRes] = await db.select({ total: count() }).from(technicalPacks).where(eq(technicalPacks.status, "approved")).catch(() => [{ total: 0 }]);
  const [dossiersRes] = await db.select({ total: count() }).from(provenanceDossiers).catch(() => [{ total: 0 }]);
  const [reportsRes] = await db.select({ total: count() }).from(conservationReports).where(eq(conservationReports.status, "approved")).catch(() => [{ total: 0 }]);

  const statistics = [
    { label: "PUBLISHED WORKS / 已发布作品", count: worksRes?.total || 0, href: "/collections" },
    { label: "CURATED COLLECTIONS / 核心系列", count: collectionsRes?.total || 0, href: "/collections" },
    { label: "APPROVED MATERIALS / 面料档案", count: materialsRes?.total || 0, href: "/materials" },
    { label: "VERIFIED TECH PACKS / 技术工艺包", count: techPacksRes?.total || 0, href: "/technical-packs" },
    { label: "PROVENANCE DOSSIERS / 权威出处卷宗", count: dossiersRes?.total || 0, href: "/provenance" },
    { label: "CONSERVATION REPORTS / 修复保护报告", count: reportsRes?.total || 0, href: "/conservation" },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
      <header className="border-b border-neutral-800 pb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition">
          ← RETURN TO NÉRA ATELIER
        </Link>
        <span className="text-xs text-amber-400 uppercase tracking-widest block mt-4">SCHOLARLY & RESEARCH PORTAL</span>
        <h1 className="text-4xl font-light tracking-wider mt-2">ATELIER RESEARCH & HERITAGE INDEX</h1>
        <p className="text-xs text-neutral-400 mt-2">当代时装设计、典藏管护与生产档案全站检索总库 · SYSTEMATIC INDEX</p>
      </header>

      <section className="my-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statistics.map((stat, idx) => (
            <Link
              key={idx}
              href={stat.href}
              className="p-6 border border-neutral-800 bg-neutral-950 hover:border-neutral-600 transition space-y-3 block"
            >
              <div className="text-xs text-neutral-500">{stat.label}</div>
              <div className="text-4xl font-light text-white">{stat.count}</div>
              <div className="text-xs text-amber-400">EXPLORE MODULE →</div>
            </Link>
          ))}
        </div>

        <div className="p-8 border border-neutral-800 bg-neutral-950 space-y-4 max-w-3xl">
          <span className="text-xs text-neutral-500 uppercase">HERITAGE STATEMENT / 档案馆宣言</span>
          <h2 className="text-lg font-normal">DOCUMENTING THE SPACE BETWEEN BODY & ARCHITECTURE</h2>
          <p className="text-xs text-neutral-400 leading-relaxed">
            NÉRA ATELIER 档案馆将每件作品看作活态的历史凭证。从纸样基码、材料测试到试身签核与出场放行，
            全流程档案均采用博物馆级数字卷宗标准沉淀，为当代独立时装设计提供可追溯的专业生产根基。
          </p>
        </div>
      </section>

      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
        <span>NÉRA ATELIER © 2026</span>
        <span>GLOBAL HERITAGE INDEX</span>
      </footer>
    </main>
  );
}
