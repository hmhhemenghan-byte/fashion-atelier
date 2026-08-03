"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type ExceptionWorkspace = {
  exception: {
    id: string;
    exceptionCode: string;
    category: string;
    severity: string;
    status: string;
    decision: string;
    title: string;
    affectedScope?: string;
    observedDeviation?: string;
    dueAt?: string;
    closedAt: string | null;
    createdAt: string;
  };
  work: {
    id: string;
    title: string;
    lookNumber: string;
  } | null;
  release: {
    id: string;
    releaseCode: string;
    authorizationCode: string | null;
  } | null;
  actions: Array<{
    id: string;
    actionType: string;
    note: string;
    occurredAt: string;
  }>;
  summary: {
    actionCount: number;
    isOverdue: boolean;
  };
};

export default function ProductionChangeControlPage() {
  const [exceptions, setExceptions] = useState<ExceptionWorkspace[]>([]);
  const [metrics, setMetrics] = useState<{
    exceptionCount: number;
    openCount: number;
    decidedCount: number;
    verifiedCount: number;
    closedCount: number;
    overdueCount: number;
    highRiskOpenCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/studio/production-exceptions");
        if (!res.ok) throw new Error("无法读取生产偏差数据。");
        const data = await res.json();
        if (data.overview) {
          setExceptions(data.overview.exceptions || []);
          setMetrics(data.overview.metrics || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "读取生产偏差数据失败。");
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
          <span className="text-xs text-amber-400 uppercase tracking-widest block">Phase 25 · HOLD THE LINE. PROTECT THE INTENT.</span>
          <h1 className="text-3xl font-light tracking-wider mt-1">PRODUCTION CHANGE CONTROL (生产变更控制)</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/studio/production-exceptions?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT JSON
          </a>
          <a
            href="/api/studio/production-exceptions?format=exceptions"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT EXCEPTIONS CSV
          </a>
          <a
            href="/api/studio/production-exceptions?format=actions"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT TIMELINE CSV
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
            <span className="text-neutral-500 block uppercase">TOTAL DEVIATIONS</span>
            <strong className="text-xl font-light">{metrics.exceptionCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-amber-400 block uppercase">OPEN</span>
            <strong className="text-xl font-light text-amber-400">{metrics.openCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-blue-400 block uppercase">DECIDED</span>
            <strong className="text-xl font-light text-blue-400">{metrics.decidedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-emerald-400 block uppercase">VERIFIED</span>
            <strong className="text-xl font-light text-emerald-400">{metrics.verifiedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-400 block uppercase">CLOSED</span>
            <strong className="text-xl font-light">{metrics.closedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-red-400 block uppercase">OVERDUE REVIEWS</span>
            <strong className="text-xl font-light text-red-400">{metrics.overdueCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-red-400 block uppercase">HIGH-RISK OPEN</span>
            <strong className="text-xl font-light text-red-400">{metrics.highRiskOpenCount}</strong>
          </div>
        </div>
      )}

      {/* 偏差案件列表 */}
      <main className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400">
            Production Deviations & Change Logs / 生产偏差案件 ({exceptions.length})
          </h2>
        </div>

        {exceptions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exceptions.map(({ exception, work, release, actions, summary }) => (
              <div key={exception.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs border px-2 py-0.5 uppercase ${severityBorder(exception.severity)}`}>
                      Δ {exception.category} · {exception.severity}
                    </span>
                    <span className={`text-xs uppercase ${statusColor(exception.status)}`}>
                      {exception.status}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 mb-1">{exception.exceptionCode}</div>
                  <h3 className="text-lg font-normal mb-2">{exception.title}</h3>

                  <div className="space-y-1 text-xs text-neutral-400">
                    <div>
                      <span className="text-neutral-500">Look:</span> {work ? (work.lookNumber ? `Look ${work.lookNumber} - ${work.title}` : work.title) : "未关联"}
                    </div>
                    {release && <div><span className="text-neutral-500">NERA-GO:</span> {release.authorizationCode || release.releaseCode}</div>}
                    {exception.affectedScope && <div><span className="text-neutral-500">影响范围:</span> {exception.affectedScope}</div>}
                    {exception.observedDeviation && (
                      <div className="text-neutral-300 mt-2 border-l border-neutral-800 pl-2 py-1">
                        {exception.observedDeviation}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-neutral-900 pt-3 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-500">
                    <span>决策: {exception.decision}</span>
                    <span>时间线: {summary.actionCount} 条</span>
                  </div>
                  {summary.isOverdue && (
                    <div className="text-red-400 font-bold text-right">
                      ! 复核已逾期
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-center text-xs text-neutral-500">
            无生产偏差案件。所有已生成的 NERA-GO 授权放行均运行正常。
          </div>
        )}
      </main>
    </div>
  );
}

function severityBorder(severity: string): string {
  if (severity === "critical" || severity === "high") return "border-red-600 text-red-400";
  if (severity === "medium") return "border-amber-600 text-amber-400";
  return "border-neutral-700 text-neutral-400";
}

function statusColor(status: string): string {
  if (status === "closed") return "text-neutral-500";
  if (status === "verified") return "text-emerald-400";
  if (status === "decided") return "text-blue-400";
  if (status === "in_review" || status === "open") return "text-amber-400";
  return "text-neutral-400";
}
