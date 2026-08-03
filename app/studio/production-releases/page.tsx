"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type ReleaseWorkspace = {
  release: {
    id: string;
    releaseCode: string;
    sequence: number;
    releaseMode: string;
    status: string;
    decision: string;
    factoryName?: string;
    authorizationCode: string | null;
    releasedAt: string | null;
    createdAt: string;
  };
  work: {
    id: string;
    title: string;
    lookNumber: string;
  } | null;
  pack: {
    id: string;
    techPackCode: string;
  } | null;
  signoff: {
    id: string;
    signoffCode: string;
    sealCode: string | null;
  } | null;
  summary: {
    readyChecks: number;
    blockedChecks: number;
    pendingChecks: number;
    completeness: number;
    releasable: boolean;
  };
};

export default function ProductionReleaseDeskPage() {
  const [releases, setReleases] = useState<ReleaseWorkspace[]>([]);
  const [metrics, setMetrics] = useState<{
    releaseCount: number;
    reviewCount: number;
    readyCount: number;
    releasedCount: number;
    blockedCheckCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/studio/production-releases");
        if (!res.ok) throw new Error("无法读取生产放行数据。");
        const data = await res.json();
        if (data.overview) {
          setReleases(data.overview.releases || []);
          setMetrics(data.overview.metrics || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "读取生产放行数据失败。");
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
          <span className="text-xs text-amber-400 uppercase tracking-widest block">Phase 24 · RELEASE THE DEFINITION.</span>
          <h1 className="text-3xl font-light tracking-wider mt-1">PRODUCTION RELEASE DESK (生产放行台)</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/studio/production-releases?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT JSON
          </a>
          <a
            href="/api/studio/production-releases?format=releases"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT RELEASES CSV
          </a>
          <a
            href="/api/studio/production-releases?format=checks"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT READINESS CHECKS CSV
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 text-xs">
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-500 block uppercase">TOTAL RELEASES</span>
            <strong className="text-xl font-light">{metrics.releaseCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-amber-400 block uppercase">IN REVIEW</span>
            <strong className="text-xl font-light text-amber-400">{metrics.reviewCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-emerald-400 block uppercase">READY</span>
            <strong className="text-xl font-light text-emerald-400">{metrics.readyCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-amber-300 block uppercase">RELEASED (NERA-GO)</span>
            <strong className="text-xl font-light text-amber-300">{metrics.releasedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-red-400 block uppercase">BLOCKED CHECKS</span>
            <strong className="text-xl font-light text-red-400">{metrics.blockedCheckCount}</strong>
          </div>
        </div>
      )}

      {/* 放行包列表 */}
      <main className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400">
            Production Release Packs / 生产放行包档案 ({releases.length})
          </h2>
        </div>

        {releases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {releases.map(({ release, work, pack, signoff, summary }) => (
              <div key={release.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs border border-neutral-700 px-2 py-0.5 uppercase">
                      Seq #{release.sequence} · {release.releaseMode}
                    </span>
                    <span className={`text-xs uppercase ${statusColor(release.status)}`}>
                      {release.status}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 mb-1">{release.releaseCode}</div>
                  <h3 className="text-lg font-normal mb-1">
                    {work ? (work.lookNumber ? `Look ${work.lookNumber} - ${work.title}` : work.title) : "未关联 Look"}
                  </h3>

                  {release.authorizationCode && (
                    <div className="my-2 p-2 border border-emerald-500/40 bg-emerald-950/20 text-emerald-300 text-xs tracking-wider">
                      NERA-GO: {release.authorizationCode}
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-neutral-400 mt-2">
                    {signoff && <div><span className="text-neutral-500">封样标识:</span> {signoff.sealCode || signoff.signoffCode}</div>}
                    {pack && <div><span className="text-neutral-500">技术包:</span> {pack.techPackCode}</div>}
                    {release.factoryName && <div><span className="text-neutral-500">执行方/版房:</span> {release.factoryName}</div>}
                  </div>
                </div>

                <div className="border-t border-neutral-900 pt-3 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-500">
                    <span>完整度: {summary.completeness}%</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>8 项准备: Ready {summary.readyChecks} / 8</span>
                    {summary.blockedChecks > 0 && (
                      <span className="text-red-400 font-bold">阻塞项: {summary.blockedChecks}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-center text-xs text-neutral-500">
            尚未建立生产放行包。必须先在 Final Sample Gate 中封存 Look 的最终样衣并生成 NERA-SEAL。
          </div>
        )}
      </main>
    </div>
  );
}

function statusColor(status: string): string {
  if (status === "released") return "text-emerald-300";
  if (status === "ready") return "text-emerald-400";
  if (status === "in_review") return "text-amber-400";
  return "text-neutral-400";
}
