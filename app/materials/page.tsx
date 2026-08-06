import React from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { materials } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Material & Swatch Library — NÉRA ATELIER",
  description: "探索 NÉRA ATELIER 时装材料室、结构羊毛、液态真丝与可持续面料档案。",
};

export default async function PublicMaterialsIndexPage() {
  const db = await getDb();

  const publicMaterials = await db
    .select()
    .from(materials)
    .where(eq(materials.status, "approved"))
    .orderBy(desc(materials.createdAt))
    .limit(24)
    .catch(() => []);

  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
      <header className="border-b border-neutral-800 pb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition">
          ← RETURN TO NÉRA ATELIER
        </Link>
        <span className="text-xs text-amber-400 uppercase tracking-widest block mt-4">CRAFT & MATERIALITY</span>
        <h1 className="text-4xl font-light tracking-wider mt-2">MATERIAL & SWATCH LIBRARY</h1>
        <p className="text-xs text-neutral-400 mt-2">面料、皮衣与五金辅料档案库 · TOUCH & SPECIFICATION</p>
      </header>

      <section className="my-12 space-y-6">
        <div className="flex justify-between items-center text-xs text-neutral-500 border-b border-neutral-900 pb-2">
          <span>APPROVED MATERIALS / 已认证材料 ({publicMaterials.length})</span>
          <span>SUSTAINABLE & ARCHIVAL GRADE</span>
        </div>

        {publicMaterials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicMaterials.map((item) => (
              <div key={item.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-3">
                <div className="flex justify-between items-start text-xs">
                  <span className="border border-neutral-700 px-2 py-0.5 uppercase">{item.category}</span>
                  <span className="text-emerald-400 uppercase">APPROVED</span>
                </div>
                <div className="text-xs text-neutral-500">{item.materialCode}</div>
                <h2 className="text-lg font-normal">{item.name}</h2>
                <div className="space-y-1 text-xs text-neutral-400">
                  {item.composition && <div><span className="text-neutral-500">成分:</span> {item.composition}</div>}
                  {item.colorName && <div><span className="text-neutral-500">颜色:</span> {item.colorName}</div>}
                  {item.supplierName && <div><span className="text-neutral-500">供应方:</span> {item.supplierName}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-xs text-neutral-500 text-center">
            公开展出材料准备中。请登录 Studio 查看内部研究材料。
          </div>
        )}
      </section>

      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
        <span>NÉRA ATELIER © 2026</span>
        <span>MATERIAL ARCHIVE</span>
      </footer>
    </main>
  );
}
