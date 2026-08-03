"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type TechPackWorkspace = {
  pack: {
    id: string;
    techPackCode: string;
    revision: number;
    status: string;
    sampleStage: string;
    baseSize: string;
    unit: string;
    fitIntent?: string;
    patternReference?: string;
    createdAt: string;
  };
  work: {
    id: string;
    title: string;
    lookNumber: string;
    imageUrl?: string;
  } | null;
  sketchUrl: string | null;
  summary: {
    activeMeasurements: number;
    activeConstructionNotes: number;
    confirmedConstructionNotes: number;
    criticalOpenNotes: number;
    completeness: number;
    approvalReady: boolean;
  };
};

export default function TechnicalAtelierPage() {
  const [packs, setPacks] = useState<TechPackWorkspace[]>([]);
  const [metrics, setMetrics] = useState<{
    packCount: number;
    reviewCount: number;
    approvedCount: number;
    lockedCount: number;
    incompleteCount: number;
    criticalOpenCount: number;
    worksWithoutPackCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/studio/technical-packs");
        if (!res.ok) throw new Error("无法读取技术包数据。");
        const data = await res.json();
        if (data.overview) {
          setPacks(data.overview.packs || []);
          setMetrics(data.overview.metrics || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "读取技术包数据失败。");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono">
      {/* 头部 Hero 区域 */}
      <header className="border-b border-neutral-800 pb-6 mb-8 flex justify-between items-end">
        <div>
          <Link href="/studio" className="text-xs text-neutral-500 hover:text-white transition mb-2 inline-block">
            ← RETURN TO STUDIO
          </Link>
          <span className="text-xs text-blue-400 uppercase tracking-widest block">Phase 21 · MAKE IT BUILDABLE.</span>
          <h1 className="text-3xl font-light tracking-wider mt-1">TECHNICAL ATELIER (技术工艺包)</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/studio/technical-packs?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT JSON
          </a>
          <a
            href="/api/studio/technical-packs?format=packs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT PACKS CSV
          </a>
          <a
            href="/api/studio/technical-packs?format=measurements"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT MEASUREMENTS CSV
          </a>
          <a
            href="/api/studio/technical-packs?format=construction"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT CONSTRUCTION CSV
          </a>
        </div>
      </header>

      {error && (
        <div className="p-4 mb-6 border border-red-800 bg-red-950/40 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* 指标栏 */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8 text-xs">
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-500 block uppercase">REVISIONS</span>
            <strong className="text-xl font-light">{metrics.packCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-amber-400 block uppercase">IN REVIEW</span>
            <strong className="text-xl font-light text-amber-400">{metrics.reviewCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-emerald-400 block uppercase">APPROVED</span>
            <strong className="text-xl font-light text-emerald-400">{metrics.approvedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-blue-400 block uppercase">LOCKED</span>
            <strong className="text-xl font-light text-blue-400">{metrics.lockedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-400 block uppercase">INCOMPLETE</span>
            <strong className="text-xl font-light">{metrics.incompleteCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-red-400 block uppercase">CRITICAL RISKS</span>
            <strong className="text-xl font-light text-red-400">{metrics.criticalOpenCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-500 block uppercase">UNPACKED LOOKS</span>
            <strong className="text-xl font-light">{metrics.worksWithoutPackCount}</strong>
          </div>
        </div>
      )}

      {/* 技术包矩阵 */}
      <main className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400">
            Technical Pack Revisions / 技术包版本档案 ({packs.length})
          </h2>
        </div>

        {packs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map(({ pack, work, sketchUrl, summary }) => (
              <div key={pack.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs border border-neutral-700 px-2 py-0.5 uppercase">
                      R{pack.revision} · {pack.sampleStage}
                    </span>
                    <span className={`text-xs uppercase ${statusColor(pack.status)}`}>
                      {pack.status}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 mb-1">{pack.techPackCode}</div>
                  <h3 className="text-lg font-normal mb-2">
                    {work ? (work.lookNumber ? `Look ${work.lookNumber} - ${work.title}` : work.title) : "未关联 Look"}
                  </h3>

                  {sketchUrl ? (
                    <div className="w-full h-36 bg-neutral-900 border border-neutral-800 overflow-hidden mb-3">
                      <img src={sketchUrl} alt={pack.techPackCode} className="w-full h-full object-contain p-2" />
                    </div>
                  ) : work?.imageUrl ? (
                    <div className="w-full h-36 bg-neutral-900 border border-neutral-800 overflow-hidden mb-3">
                      <img src={work.imageUrl} alt={work.title} className="w-full h-full object-cover opacity-60" />
                    </div>
                  ) : null}

                  <div className="space-y-1 text-xs text-neutral-400">
                    <div><span className="text-neutral-500">基码与单位:</span> {pack.baseSize || "未填"} ({pack.unit})</div>
                    {pack.patternReference && <div><span className="text-neutral-500">纸样编号:</span> {pack.patternReference}</div>}
                    {pack.fitIntent && <div><span className="text-neutral-500">版型意图:</span> {pack.fitIntent}</div>}
                  </div>
                </div>

                <div className="border-t border-neutral-900 pt-3 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-500">
                    <span>完整度: {summary.completeness}%</span>
                    <span>尺寸点: {summary.activeMeasurements}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>工艺说明: {summary.activeConstructionNotes} (已确认 {summary.confirmedConstructionNotes})</span>
                    {summary.criticalOpenNotes > 0 && (
                      <span className="text-red-400 font-bold">关键风险: {summary.criticalOpenNotes}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-center text-xs text-neutral-500">
            尚未建立技术包。请在 Studio 主页面为 Look 建立第一个 Technical Pack。
          </div>
        )}
      </main>
    </div>
  );
}

function statusColor(status: string): string {
  if (status === "approved") return "text-emerald-400";
  if (status === "locked") return "text-blue-400";
  if (status === "review") return "text-amber-400";
  return "text-neutral-400";
}
