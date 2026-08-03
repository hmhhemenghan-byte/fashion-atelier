"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type SignoffWorkspace = {
  signoff: {
    id: string;
    signoffCode: string;
    round: number;
    sampleType: string;
    status: string;
    decision: string;
    sampleSize: string;
    sealCode: string | null;
    sealedAt: string | null;
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
  fitting: {
    id: string;
    fittingCode: string;
  } | null;
  summary: {
    passedChecks: number;
    failedChecks: number;
    pendingChecks: number;
    evidenceCount: number;
    completeness: number;
    sealable: boolean;
  };
};

export default function FinalSampleGateClient() {
  const [signoffs, setSignoffs] = useState<SignoffWorkspace[]>([]);
  const [metrics, setMetrics] = useState<{
    signoffCount: number;
    reviewCount: number;
    approvedCount: number;
    sealedCount: number;
    failedCheckCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/studio/sample-signoffs");
        if (!res.ok) throw new Error("无法读取封样签核数据。");
        const data = await res.json();
        if (data.overview) {
          setSignoffs(data.overview.signoffs || []);
          setMetrics(data.overview.metrics || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "读取封样签核数据失败。");
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
          <span className="text-xs text-amber-400 uppercase tracking-widest block">Phase 23 · SEAL THE REFERENCE.</span>
          <h1 className="text-3xl font-light tracking-wider mt-1">FINAL SAMPLE GATE (封样签核台)</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/studio/sample-signoffs?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT JSON
          </a>
          <a
            href="/api/studio/sample-signoffs?format=signoffs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT SIGNOFFS CSV
          </a>
          <a
            href="/api/studio/sample-signoffs?format=checks"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT CHECKS CSV
          </a>
          <a
            href="/api/studio/sample-signoffs?format=images"
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8 text-xs">
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-neutral-500 block uppercase">TOTAL SIGNOFFS</span>
            <strong className="text-xl font-light">{metrics.signoffCount}</strong>
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
            <span className="text-amber-300 block uppercase">SEALED (NERA-SEAL)</span>
            <strong className="text-xl font-light text-amber-300">{metrics.sealedCount}</strong>
          </div>
          <div className="p-3 border border-neutral-800 bg-neutral-950">
            <span className="text-red-400 block uppercase">FAILED CHECKS</span>
            <strong className="text-xl font-light text-red-400">{metrics.failedCheckCount}</strong>
          </div>
        </div>
      )}

      {/* 封样列表 */}
      <main className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400">
            Final Sample Control Gates / 封样关卡档案 ({signoffs.length})
          </h2>
        </div>

        {signoffs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {signoffs.map(({ signoff, work, pack, fitting, summary }) => (
              <div key={signoff.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs border border-neutral-700 px-2 py-0.5 uppercase">
                      Round {signoff.round} · {signoff.sampleType}
                    </span>
                    <span className={`text-xs uppercase ${statusColor(signoff.status)}`}>
                      {signoff.status}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 mb-1">{signoff.signoffCode}</div>
                  <h3 className="text-lg font-normal mb-1">
                    {work ? (work.lookNumber ? `Look ${work.lookNumber} - ${work.title}` : work.title) : "未关联 Look"}
                  </h3>

                  {signoff.sealCode && (
                    <div className="my-2 p-2 border border-amber-500/40 bg-amber-950/20 text-amber-300 text-xs tracking-wider">
                      NERA-SEAL: {signoff.sealCode}
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-neutral-400 mt-2">
                    {pack && <div><span className="text-neutral-500">技术包:</span> {pack.techPackCode}</div>}
                    {fitting && <div><span className="text-neutral-500">试身场次:</span> {fitting.fittingCode}</div>}
                  </div>
                </div>

                <div className="border-t border-neutral-900 pt-3 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-500">
                    <span>完整度: {summary.completeness}%</span>
                    <span>私密证据: {summary.evidenceCount} 张</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>8 项核对: 通过 {summary.passedChecks} / 8</span>
                    {summary.failedChecks > 0 && (
                      <span className="text-red-400 font-bold">失败项: {summary.failedChecks}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-center text-xs text-neutral-500">
            尚未建立封样记录。必须先在 Fitting Room 中批准 Look 的试身结论，方可建立封样关卡。
          </div>
        )}
      </main>
    </div>
  );
}

function statusColor(status: string): string {
  if (status === "sealed") return "text-amber-300";
  if (status === "approved") return "text-emerald-400";
  if (status === "in_review") return "text-amber-400";
  return "text-neutral-400";
}
