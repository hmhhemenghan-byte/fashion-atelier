"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type CommandItem = {
  id: string;
  title: string;
  category: string;
  href: string;
  shortcut?: string;
};

const commands: CommandItem[] = [
  { id: "studio", title: "Studio Overview (主工作台)", category: "Navigation", href: "/studio", shortcut: "G S" },
  { id: "reviews", title: "Atelier Review Board (设计评审台)", category: "Design", href: "/studio/reviews" },
  { id: "materials", title: "Material Room & Look BOM (材料室)", category: "Design", href: "/studio/materials" },
  { id: "technical-packs", title: "Technical Atelier (技术工艺包)", category: "Production", href: "/studio/technical-packs" },
  { id: "fittings", title: "Fitting Room (试身审版室)", category: "Production", href: "/studio/fittings" },
  { id: "sample-signoffs", title: "Final Sample Gate (封样签核台)", category: "Production", href: "/studio/sample-signoffs" },
  { id: "production-releases", title: "Production Release Desk (生产放行台)", category: "Production", href: "/studio/production-releases" },
  { id: "production-exceptions", title: "Production Change Control (生产变更控制)", category: "Production", href: "/studio/production-exceptions" },
  { id: "production-acceptances", title: "Edition Acceptance Gate (成衣验收台)", category: "Quality", href: "/studio/production-acceptances" },
  { id: "provenance-dossiers", title: "Provenance Dossier Publishing (权威卷宗)", category: "Curation", href: "/studio/provenance-dossiers" },
  { id: "conservation-atelier", title: "Conservation Atelier (保存修复)", category: "Curation", href: "/studio/conservation-atelier" },
  { id: "exhibition-readiness", title: "Exhibition Readiness (展前准备度)", category: "Exhibition", href: "/studio/exhibition-readiness" },
  { id: "exhibition-watch", title: "Exhibition Watch (展期巡查监测)", category: "Exhibition", href: "/studio/exhibition-watch" },
  { id: "exhibition-recovery", title: "Exhibition Recovery (撤展恢复核销)", category: "Exhibition", href: "/studio/exhibition-recovery" },
  { id: "archive-curation", title: "Archive Curation Workspace (馆藏策展)", category: "Curation", href: "/studio/archive-curation" },
  { id: "exhibition-interpretation", title: "Exhibition Interpretation (展陈阐释)", category: "Exhibition", href: "/studio/exhibition-interpretation" },
  { id: "exhibition-delivery", title: "Exhibition Delivery (展品点交出库)", category: "Exhibition", href: "/studio/exhibition-delivery" },
  { id: "exhibition-installation", title: "Exhibition Installation (进场布展)", category: "Exhibition", href: "/studio/exhibition-installation" },
  { id: "exhibition-opening", title: "Exhibition Opening Gate (开幕放行)", category: "Exhibition", href: "/studio/exhibition-opening" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!open) return null;

  const filtered = commands.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-24 font-mono">
      <div className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 shadow-2xl p-4 text-white space-y-4">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search workspace... (Cmd+K)"
            className="w-full bg-transparent text-sm focus:outline-none text-white placeholder-neutral-500"
          />
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-neutral-500 hover:text-white px-2 py-1 border border-neutral-800"
          >
            ESC
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-1">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
                className="w-full text-left p-3 hover:bg-neutral-900 flex justify-between items-center transition border border-transparent hover:border-neutral-800"
              >
                <div>
                  <span className="text-xs text-neutral-500 uppercase tracking-widest block">
                    [{item.category}]
                  </span>
                  <span className="text-sm font-light text-neutral-200">{item.title}</span>
                </div>
                {item.shortcut && (
                  <span className="text-xs text-neutral-600 border border-neutral-800 px-2 py-0.5">
                    {item.shortcut}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-neutral-500">
              No workspace or command matches "{search}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
