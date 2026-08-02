"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type Review = {
  id: string;
  reviewType: string;
  title: string;
  status: string;
  observations?: string;
  rationale?: string;
  createdAt: string;
};

type ActionItem = {
  id: string;
  title?: string;
  description?: string;
  priority: string;
  ownerName?: string;
  assignee?: string;
  dueAt?: string;
  dueDate?: string;
  status?: string;
  isCompleted?: boolean;
};

export default function AtelierReviewBoardPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/studio/reviews");
        if (!res.ok) throw new Error("无法读取评审数据。");
        const data = await res.json();
        if (data.reviews) setReviews(data.reviews);
        if (data.actionItems) setActions(data.actionItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : "读取评审数据失败。");
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
          <span className="text-xs text-neutral-500 uppercase tracking-widest block">Phase 19 · Research & Specs</span>
          <h1 className="text-3xl font-light tracking-wider mt-1">ATELIER REVIEW BOARD</h1>
        </div>
        <div className="flex gap-4">
          <a
            href="/api/studio/reviews?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT JSON
          </a>
          <a
            href="/api/studio/reviews?format=csv"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT CSV
          </a>
        </div>
      </header>

      {error && (
        <div className="p-4 mb-6 border border-red-800 bg-red-950/40 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* 评审视图与任务队列 */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
            <h2 className="text-sm uppercase tracking-widest text-neutral-400">
              Active Reviews / 评审卡片
            </h2>
            <span className="text-xs text-neutral-500">{reviews.length} REVIEWS</span>
          </div>

          {reviews.length > 0 ? (
            reviews.map((rev) => (
              <div key={rev.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-xs border border-neutral-700 px-2 py-0.5 uppercase">
                    {rev.reviewType || "REVIEW"}
                  </span>
                  <span className={`text-xs uppercase ${statusColor(rev.status)}`}>
                    {rev.status}
                  </span>
                </div>
                <h3 className="text-xl font-normal">{rev.title}</h3>
                {rev.observations && (
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    观察记录：{rev.observations}
                  </p>
                )}
                {rev.rationale && (
                  <div className="text-xs text-neutral-500 border-t border-neutral-900 pt-3">
                    决策依据：{rev.rationale}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 border border-neutral-800 bg-neutral-950 space-y-4">
              <div className="flex justify-between items-start">
                <span className="text-xs border border-neutral-700 px-2 py-0.5 uppercase">SILHOUETTE</span>
                <span className="text-xs text-amber-400 uppercase">REVISION REQUIRED</span>
              </div>
              <h3 className="text-xl font-normal">Look 04 廓形与肩膀比例复审</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                观察记录：肩线垫肩结构偏硬，破坏整体流畅度。需调整内衬结构并重新出样。
              </p>
              <div className="text-xs text-neutral-500 border-t border-neutral-900 pt-3">
                决策依据：需保持概念稿中的流线线条感，无法直接通过。
              </div>
            </div>
          )}
        </section>

        {/* 关键修改任务 */}
        <section className="space-y-4">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
            <h2 className="text-sm uppercase tracking-widest text-neutral-400">
              Critical Action Items / 关键修改任务
            </h2>
            <span className="text-xs text-neutral-500">{actions.length} ACTIONS</span>
          </div>

          {actions.length > 0 ? (
            actions.map((act) => (
              <div key={act.id} className="p-4 border border-neutral-800 bg-neutral-950 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-bold uppercase ${priorityColor(act.priority)}`}>
                    [{act.priority || "MEDIUM"}]
                  </span>
                  <span className="text-neutral-500">截止: {act.dueAt || act.dueDate || "OPEN"}</span>
                </div>
                <p className="text-xs text-neutral-300">{act.title || act.description}</p>
                <div className="text-xs text-neutral-500">负责人: {act.ownerName || act.assignee || "未指定"}</div>
              </div>
            ))
          ) : (
            <div className="p-4 border border-neutral-800 bg-neutral-950 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-400 font-bold">[CRITICAL]</span>
                <span className="text-neutral-500">截止: 2026-08-05</span>
              </div>
              <p className="text-xs text-neutral-300">重新制作 Look 04 垫肩纸样与拆解测试</p>
              <div className="text-xs text-neutral-500">负责人: 版房主管</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function statusColor(status: string): string {
  if (status === "passed" || status === "approved" || status === "closed") return "text-emerald-400";
  if (status === "revision_required" || status === "revise") return "text-amber-400";
  if (status === "dropped" || status === "cancelled") return "text-red-400";
  return "text-neutral-400";
}

function priorityColor(priority: string): string {
  if (priority === "critical" || priority === "high") return "text-red-400";
  if (priority === "medium" || priority === "normal") return "text-amber-400";
  return "text-neutral-400";
}
