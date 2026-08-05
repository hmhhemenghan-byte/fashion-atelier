import React from "react";
import Link from "next/link";
import { getDb } from "@/db";
import { curatorialProjects } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: `Exhibition — ${slug} — NÉRA ATELIER`,
    description: `NÉRA ATELIER 时装展陈与当代典藏展`,
  };
}

export default async function PublicExhibitionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  
  const [project] = await db
    .select()
    .from(curatorialProjects)
    .where(eq(curatorialProjects.projectCode, slug))
    .limit(1);

  if (!project) {
    return (
      <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
        <header className="border-b border-neutral-800 pb-6">
          <Link href="/" className="text-xs text-neutral-500 hover:text-white transition">
            ← NÉRA ATELIER / PUBLIC EXHIBITIONS
          </Link>
          <span className="text-xs text-amber-400 uppercase tracking-widest block mt-4">VIRTUAL EXHIBITION HALL</span>
          <h1 className="text-4xl font-light tracking-wider mt-2">{slug.toUpperCase()}</h1>
        </header>

        <section className="my-16 space-y-6 max-w-3xl">
          <p className="text-sm text-neutral-400 leading-relaxed">
            欢迎来到 NÉRA ATELIER 线上数字展厅。本展项呈现独立时装设计与典藏工坊的核心剪裁、面料试验与权威出处卷宗。
          </p>
          <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-2">
            <span className="text-xs text-neutral-500 uppercase">LOCATION / 展馆</span>
            <div className="text-lg font-light">MAIN GALLERY · SECTION A</div>
          </div>
        </section>

        <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
          <span>NÉRA ATELIER © 2026</span>
          <span>CURATORIAL ARCHIVE</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
      <header className="border-b border-neutral-800 pb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:text-white transition">
          ← NÉRA ATELIER / PUBLIC EXHIBITIONS
        </Link>
        <span className="text-xs text-amber-400 uppercase tracking-widest block mt-4">CURATED EXHIBITION · {project.status.toUpperCase()}</span>
        <h1 className="text-4xl font-light tracking-wider mt-2">{project.title}</h1>
      </header>

      <section className="my-16 space-y-6 max-w-3xl">
        <div className="text-xs text-neutral-500">{project.projectCode}</div>
        {project.thesis && <h2 className="text-xl font-normal text-neutral-200">主旨: {project.thesis}</h2>}
        {project.narrative && (
          <p className="text-sm text-neutral-400 leading-relaxed border-l border-neutral-800 pl-4 py-2">
            {project.narrative}
          </p>
        )}
      </section>

      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
        <span>NÉRA ATELIER © 2026</span>
        <span>EXHIBITION CURATION ARCHIVE</span>
      </footer>
    </main>
  );
}
