import React from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Press Kit & Media Asset Center — NÉRA ATELIER",
  description: "下载 NÉRA ATELIER 官方新闻包、高分辨率造型图集与品牌标志包。",
};

export default function PublicPressKitsPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8 font-mono flex flex-col justify-between">
      <header className="border-b border-neutral-800 pb-6">
        <Link href="/press" className="text-xs text-neutral-500 hover:text-white transition">
          ← RETURN TO PRESS ROOM
        </Link>
        <span className="text-xs text-purple-400 uppercase tracking-widest block mt-4">MEDIA ASSETS & DOWNLOADS</span>
        <h1 className="text-4xl font-light tracking-wider mt-2">PRESS KIT & ASSET CENTER</h1>
        <p className="text-xs text-neutral-400 mt-2">新闻发布包、高精度造型图册、矢量 Logo 与设计师专访稿 · HIGH-RES & BRAND LOGO</p>
      </header>

      <section className="my-12 space-y-8 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
            <span className="text-xs text-neutral-500 uppercase">PRESS PACKAGE 01</span>
            <h2 className="text-xl font-normal">AW 2027 SECOND SKIN LOOKBOOK (300 DPI)</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              包含 12 套完整 Look 的 TIFF/JPG 高解析度白底大图、模特细节特写与设计阐释文档。
            </p>
            <div className="pt-2 flex justify-between items-center text-xs">
              <span className="text-neutral-500">FORMAT: ZIP (145 MB)</span>
              <a href="/press" className="px-3 py-1 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 transition">
                DOWNLOAD KIT →
              </a>
            </div>
          </div>

          <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
            <span className="text-xs text-neutral-500 uppercase">BRAND ASSET 02</span>
            <h2 className="text-xl font-normal">NÉRA ATELIER IDENTITY & VECTOR LOGO</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              品牌标准字 SVG/EPS 矢量文件、标准黑白配色指南与定制排版规范。
            </p>
            <div className="pt-2 flex justify-between items-center text-xs">
              <span className="text-neutral-500">FORMAT: VECTOR (12 MB)</span>
              <a href="/press" className="px-3 py-1 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 transition">
                DOWNLOAD LOGOS →
              </a>
            </div>
          </div>
        </div>

        <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-3">
          <span className="text-xs text-neutral-500 uppercase">MEDIA INQUIRY & SAMPLE REQUEST</span>
          <h3 className="text-lg font-normal">公关样衣借调与媒体专访</h3>
          <p className="text-xs text-neutral-400">
            媒体与时尚编辑如需借调实体 Look 样品或预约设计师专访，请登录 Studio 或联系公关室。
          </p>
        </div>
      </section>

      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex justify-between">
        <span>NÉRA ATELIER © 2026</span>
        <span>PRESS DESK</span>
      </footer>
    </main>
  );
}
