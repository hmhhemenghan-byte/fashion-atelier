"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type FittingWorkspace = {
  session: {
    id: string;
    fittingCode: string;
    round: number;
    status: string;
    decision: string;
    sampleSize: string;
    fittingAt?: string;
    objective?: string;
    conclusion?: string;
    createdAt: string;
  };
  work: {
    id: string;
    title: string;
    lookNumber: string;
    imageUrl?: string;
  } | null;
  pack: {
    id: string;
    techPackCode: string;
    revision: number;
  } | null;
  summary: {
    activeIssues: number;
    resolvedIssues: number;
    criticalOpenIssues: number;
    imageCount: number;
    completeness: number;
    approvalReady: boolean;
  };
};

export default function FittingRoomClient() {
  const [fittings, setFittings] = useState<FittingWorkspace[]>([]);
  const [metrics, setMetrics] = useState<{
    sessionCount: number;
    reviewCount: number;
    approvedCount: number;
    closedCount: number;
    incompleteCount: number;
    criticalOpenIssueCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/studio/fittings");
        if (!res.ok) throw new Error("无法读取试身数据。");
        const data = await res.json();
        if (data.overview) {
          setFittings(data.overview.sessions || []);
          setMetrics(data.overview.metrics || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "读取试身数据失败。");
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
          <span className="text-xs text-amber-400 uppercase tracking-widest block">Phase 22 · VERIFY THE LINE.</span>
          <h1 className="text-3xl font-light tracking-wider mt-1">FITTING ROOM (试身审版室)</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/studio/fittings?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT JSON
          </a>
          <a
            href="/api/studio/fittings?format=sessions"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT SESSIONS CSV
          </a>
          <a
            href="/api/studio/fittings?format=issues"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT ISSUES CSV
          </a>
          <a
            href="/api/studio/fittings?format=images"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT EVIDENCE CSV
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 text-xs">
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-500 block uppercase">TOTAL SESSIONS</span>
            <strong className="text-xl font-light">{metrics.sessionCount}</strong>
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
            <span className="text-neutral-400 block uppercase">CLOSED</span>
            <strong className="text-xl font-light">{metrics.closedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-500 block uppercase">INCOMPLETE</span>
            <strong className="text-xl font-light">{metrics.incompleteCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-red-400 block uppercase">CRITICAL ISSUES</span>
            <strong className="text-xl font-light text-red-400">{metrics.criticalOpenIssueCount}</strong>
          </div>
        </div>
      )}

      {/* 试身场次列表 */}
      <main className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400">
            Fitting Sessions / 试身审版记录 ({fittings.length})
          </h2>
        </div>

        {fittings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fittings.map(({ session, work, pack, summary }) => (
              <div key={session.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs border border-neutral-700 px-2 py-0.5 uppercase">
                      Round {session.round} · {session.sampleSize || "标准尺码"}
                    </span>
                    <span className={`text-xs uppercase ${decisionColor(session.decision)}`}>
                      {session.decision}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 mb-1">{session.fittingCode}</div>
                  <h3 className="text-lg font-normal mb-1">
                    {work ? (work.lookNumber ? `Look ${work.lookNumber} - ${work.title}` : work.title) : "未关联 Look"}
                  </h3>
                  {pack && <div className="text-xs text-neutral-500 mb-3">关联技术包: {pack.techPackCode} (R{pack.revision})</div>}

                  {session.objective && (
                    <div className="text-xs text-neutral-400 mb-2">
                      <span className="text-neutral-500">本轮目标:</span> {session.objective}
                    </div>
                  )}

                  {session.conclusion && (
                    <div className="text-xs text-neutral-300 border-t border-neutral-900 pt-2">
                      <span className="text-neutral-500">结论:</span> {session.conclusion}
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-900 pt-3 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-500">
                    <span>完整度: {summary.completeness}%</span>
                    <span>影像证据: {summary.imageCount} 张</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>版型问题: {summary.activeIssues} 个 (已解决 {summary.resolvedIssues})</span>
                    {summary.criticalOpenIssues > 0 && (
                      <span className="text-red-400 font-bold">关键问题: {summary.criticalOpenIssues}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-center text-xs text-neutral-500">
            尚未建立试身记录。请在 Studio 主页面针对技术包建立第一个 Fitting Session。
          </div>
        )}
      </main>
    </div>
  );
}

function decisionColor(decision: string): string {
  if (decision === "approve") return "text-emerald-400";
  if (decision === "revise") return "text-amber-400";
  if (decision === "hold") return "text-red-400";
  return "text-neutral-400";
}
