"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

type Material = {
  id: string;
  materialCode: string;
  name: string;
  category: string;
  status: string;
  composition?: string;
  colorName?: string;
  colorCode?: string;
  supplierName?: string;
  swatchImageKey?: string;
  createdAt: string;
};

type MaterialAssignment = {
  assignment: {
    id: string;
    role: string;
    status: string;
    placement?: string;
    consumption?: string;
    unit?: string;
  };
  work: {
    id: string;
    title: string;
    lookNumber: string;
  } | null;
};

type MaterialWorkspace = {
  material: Material;
  imageUrl: string | null;
  assignments: MaterialAssignment[];
  summary: {
    usageCount: number;
    activeUsageCount: number;
    approvedUsageCount: number;
    completeness: number;
    missingFields: string[];
  };
};

export default function MaterialRoomPage() {
  const [materials, setMaterials] = useState<MaterialWorkspace[]>([]);
  const [metrics, setMetrics] = useState<{
    materialCount: number;
    approvedCount: number;
    samplingCount: number;
    activeBomCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/studio/materials");
        if (!res.ok) throw new Error("无法读取材料室数据。");
        const data = await res.json();
        if (data.overview) {
          setMaterials(data.overview.materials || []);
          setMetrics(data.overview.metrics || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "读取材料室数据失败。");
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
          <span className="text-xs text-amber-400 uppercase tracking-widest block">Phase 20 · Touch. Test. Compose.</span>
          <h1 className="text-3xl font-light tracking-wider mt-1">MATERIAL ROOM & LOOK BOM</h1>
        </div>
        <div className="flex gap-4">
          <a
            href="/api/studio/materials?format=json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT JSON
          </a>
          <a
            href="/api/studio/materials?format=materials"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT MATERIALS CSV
          </a>
          <a
            href="/api/studio/materials?format=bom"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs border border-neutral-700 hover:border-white transition"
          >
            EXPORT BOM CSV
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 border border-neutral-800 bg-neutral-950">
            <span className="text-xs text-neutral-500 block uppercase">TOTAL MATERIALS</span>
            <strong className="text-2xl font-light">{metrics.materialCount}</strong>
          </div>
          <div className="p-4 border border-neutral-800 bg-neutral-950">
            <span className="text-xs text-emerald-400 block uppercase">APPROVED</span>
            <strong className="text-2xl font-light text-emerald-400">{metrics.approvedCount}</strong>
          </div>
          <div className="p-4 border border-neutral-800 bg-neutral-950">
            <span className="text-xs text-amber-400 block uppercase">SAMPLING</span>
            <strong className="text-2xl font-light text-amber-400">{metrics.samplingCount}</strong>
          </div>
          <div className="p-4 border border-neutral-800 bg-neutral-950">
            <span className="text-xs text-neutral-400 block uppercase">ACTIVE BOM RECORDS</span>
            <strong className="text-2xl font-light">{metrics.activeBomCount}</strong>
          </div>
        </div>
      )}

      {/* 材料列表与 BOM 关系 */}
      <main className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
          <h2 className="text-sm uppercase tracking-widest text-neutral-400">
            Material Library / 材料档案 ({materials.length})
          </h2>
        </div>

        {materials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materials.map(({ material, imageUrl, assignments, summary }) => (
              <div key={material.id} className="p-6 border border-neutral-800 bg-neutral-950 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs border border-neutral-700 px-2 py-0.5 uppercase">
                      {material.category}
                    </span>
                    <span className={`text-xs uppercase ${statusColor(material.status)}`}>
                      {material.status}
                    </span>
                  </div>

                  <div className="text-xs text-neutral-500 mb-1">{material.materialCode}</div>
                  <h3 className="text-lg font-normal mb-2">{material.name}</h3>

                  {imageUrl && (
                    <div className="w-full h-32 bg-neutral-900 border border-neutral-800 overflow-hidden mb-3">
                      <img src={imageUrl} alt={material.name} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-neutral-400">
                    {material.composition && <div><span className="text-neutral-500">成分:</span> {material.composition}</div>}
                    {(material.colorName || material.colorCode) && (
                      <div><span className="text-neutral-500">颜色:</span> {material.colorName} {material.colorCode && `(${material.colorCode})`}</div>
                    )}
                    {material.supplierName && <div><span className="text-neutral-500">供应方:</span> {material.supplierName}</div>}
                  </div>
                </div>

                <div className="border-t border-neutral-900 pt-3 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-neutral-500">
                    <span>完整度: {summary.completeness}%</span>
                    <span>引用 Look: {summary.activeUsageCount}</span>
                  </div>
                  {assignments.length > 0 && (
                    <div className="text-neutral-400">
                      Look BOM: {assignments.map(a => a.work ? LookLabel(a.work) : "").filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-neutral-800 bg-neutral-950 text-center text-xs text-neutral-500">
            尚未建立材料档案。请在 Studio 主页面建立本季的第一个材料。
          </div>
        )}
      </main>
    </div>
  );
}

function LookLabel(work: { title: string; lookNumber: string }) {
  return work.lookNumber ? `Look ${work.lookNumber}` : work.title;
}

function statusColor(status: string): string {
  if (status === "approved") return "text-emerald-400";
  if (status === "sampling") return "text-amber-400";
  if (status === "research") return "text-neutral-400";
  if (status === "hold" || status === "archived") return "text-red-400";
  return "text-neutral-400";
}
