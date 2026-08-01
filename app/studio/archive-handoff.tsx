"use client";

import { useEffect, useState } from "react";
import type {
  ArchiveDelta,
  ArchiveHandoffOverview,
  ArchiveSnapshotSummary,
} from "@/lib/archive-handoff";

type ApiPayload = {
  overview?: ArchiveHandoffOverview;
  snapshot?: ArchiveSnapshotSummary;
  error?: string;
};

export default function ArchiveHandoff() {
  const [overview, setOverview] =
    useState<ArchiveHandoffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const nextOverview = await requestOverview();
        if (!cancelled) setOverview(nextOverview);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "无法读取交接档案。",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh(successMessage = "") {
    setError("");
    if (successMessage) setMessage(successMessage);
    try {
      setOverview(await requestOverview());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法刷新交接档案。",
      );
    }
  }

  async function createSnapshot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (label.trim().length < 2) {
      setError("请填写至少 2 个字符的快照名称。");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/studio/archives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, notes }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.snapshot) {
        throw new Error(payload.error || "创建交接快照失败。");
      }
      setLabel("");
      setNotes("");
      await refresh("不可变交接快照已生成，并锁定当前数据校验摘要。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "创建交接快照失败。",
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyHash() {
    if (!overview) return;
    setError("");
    try {
      await navigator.clipboard.writeText(overview.currentManifestHash);
      setMessage("当前 SHA-256 校验摘要已复制。");
    } catch {
      setError("无法复制校验摘要，请手动选择复制。");
    }
  }

  if (loading) {
    return (
      <section className="archive-handoff is-loading">
        <p>正在核对 Archive &amp; Handoff 数据包…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="archive-handoff is-loading">
        <p>{error || "交接档案暂时不可用。"}</p>
        <button type="button" onClick={() => void refresh()}>
          重新读取
        </button>
      </section>
    );
  }

  const scoreStyle = {
    "--archive-progress": `${overview.portabilityScore * 3.6}deg`,
  } as React.CSSProperties;

  return (
    <section
      className="archive-handoff"
      id="archive-handoff"
      aria-labelledby="archive-handoff-title"
    >
      <header className="archive-handoff-hero">
        <div className="archive-handoff-number" aria-hidden="true">
          07
        </div>
        <div className="archive-handoff-title">
          <span>07 / ARCHIVE &amp; HANDOFF</span>
          <h2 id="archive-handoff-title">
            归档。校验。<i>带走。</i>
          </h2>
          <p>
            把源码之外的 D1 内容关系与 R2 媒体索引固化为可验证的数据基线，
            为迁移、备份与下一位协作者准备一套完整交接语言。
          </p>
        </div>
        <div className="archive-score" style={scoreStyle}>
          <div>
            <span>PORTABILITY</span>
            <strong>{overview.portabilityScore}</strong>
            <small>{overview.statusLabel} / 100</small>
          </div>
        </div>
      </header>

      <div className="archive-status-strip">
        <div>
          <span>LIVE MANIFEST</span>
          <code>{shortHash(overview.currentManifestHash, 18)}</code>
        </div>
        <div>
          <span>ARCHIVE STATE</span>
          <strong>
            {overview.latestIsCurrent ? "CURRENT / 已锁定" : "DRIFT / 待归档"}
          </strong>
        </div>
        <div>
          <span>LAST AUDIT</span>
          <strong>{formatDateTime(overview.generatedAt)}</strong>
        </div>
        <button type="button" onClick={() => void copyHash()}>
          复制完整校验码
        </button>
      </div>

      {(error || message) && (
        <div
          className={`archive-notice${error ? " is-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {error || message}
        </div>
      )}

      <div className="archive-inventory" aria-label="交接内容统计">
        <InventoryMetric
          number="01"
          label="WORKS"
          value={overview.inventory.works}
          detail={`${overview.inventory.workImages} 张细节图 · ${overview.inventory.processEntries} 条过程`}
        />
        <InventoryMetric
          number="02"
          label="COLLECTIONS"
          value={overview.inventory.collections}
          detail={`${overview.inventory.collectionAssignments} 条编排关系`}
        />
        <InventoryMetric
          number="03"
          label="MATERIALS"
          value={overview.inventory.materials}
          detail={`${overview.inventory.workMaterials} 条 Look 用料`}
        />
        <InventoryMetric
          number="04"
          label="TECH PACKS"
          value={overview.inventory.technicalPacks}
          detail={`${overview.inventory.techPackMeasurements} 条尺寸 · ${overview.inventory.techPackConstructionNotes} 条工艺`}
        />
        <InventoryMetric
          number="05"
          label="FITTINGS"
          value={overview.inventory.fittingSessions}
          detail={`${overview.inventory.fittingIssues} 条问题 · ${overview.inventory.fittingImages} 张证据`}
        />
        <InventoryMetric
          number="06"
          label="SAMPLE GATES"
          value={overview.inventory.sampleSignoffs}
          detail={`${overview.inventory.sampleSignoffChecks} 条核对 · ${overview.inventory.sampleSignoffImages} 张证据`}
        />
        <InventoryMetric
          number="07"
          label="PRODUCTION RELEASE"
          value={overview.inventory.productionReleases}
          detail={`${overview.inventory.productionReleaseChecks} 条准备核对`}
        />
        <InventoryMetric
          number="08"
          label="PRODUCTION CHANGE"
          value={overview.inventory.productionExceptions}
          detail={`${overview.inventory.productionExceptionActions} 条人工处置记录`}
        />
        <InventoryMetric
          number="09"
          label="MEDIA"
          value={overview.inventory.mediaAssets}
          detail={`${formatBytes(overview.inventory.mediaBytes)} · ALT ${overview.altCoverage}% · QA ${overview.editorialScore}`}
        />
      </div>

      <div className="archive-workbench">
        <section className="archive-export" aria-labelledby="archive-export-title">
          <header>
            <span>PORTABLE OUTPUTS / 交接输出</span>
            <h3 id="archive-export-title">一套数据，五种去向。</h3>
            <p>
              JSON 保留完整关系，CSV 服务内容迁移与人工核对，QA 和 iCal
              负责发布质量与排期连续性。
            </p>
          </header>
          <div className="archive-export-grid">
            <ExportCard
              index="A"
              title="完整交接数据包"
              format="JSON / RELATIONAL"
              detail="作品、图库、过程、系列、材料与 Look 用料、技术包、尺寸规格、工艺说明、生产放行与偏差时间线、设计评审、发布、排期、私享展厅、样衣、关系、外联、QA 与媒体清单。"
              href="/api/studio/handoff?format=bundle"
              tone="primary"
            />
            <ExportCard
              index="B"
              title="作品迁移表"
              format="CSV / UTF-8"
              detail="面向 CMS 导入与表格整理的扁平作品数据。"
              href="/api/studio/export?format=csv"
            />
            <ExportCard
              index="C"
              title="媒体对象清单"
              format="CSV / R2 MANIFEST"
              detail="对象键、来源关系、类型、尺寸、描述与可访问路径。"
              href="/api/studio/handoff?format=media-csv"
              tone="acid"
            />
            <ExportCard
              index="D"
              title="编辑质量报告"
              format="JSON / QA"
              detail={`${overview.issueCount} 项当前检查，供发布复核与内容交接。`}
              href="/api/studio/overview?download=1"
            />
            <ExportCard
              index="E"
              title="编辑日历"
              format="ICAL / CALENDAR"
              detail="带走试衣、拍摄、媒体交付与发布节点。"
              href="/api/studio/calendar?format=ics"
            />
          </div>
        </section>

        <section
          className="archive-readiness"
          aria-labelledby="archive-readiness-title"
        >
          <header>
            <span>HANDOFF PROTOCOL</span>
            <h3 id="archive-readiness-title">交接协议</h3>
          </header>
          <div className="archive-checklist">
            {overview.checklist.map((item, index) => (
              <article
                className={`archive-check is-${item.status}`}
                key={item.id}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <b>{item.status === "ready" ? "READY" : "CHECK"}</b>
              </article>
            ))}
          </div>
          <aside className="archive-handoff-note">
            <span>MEDIA TRANSFER NOTE</span>
            <p>
              数据包不复制图片二进制；媒体清单保留稳定对象键。正式迁移时按清单批量复制
              R2 对象，再映射到新存储域即可，避免在浏览器里生成高风险的大型压缩包。
            </p>
          </aside>
        </section>
      </div>

      <div className="archive-ledger">
        <section
          className="archive-snapshot-maker"
          aria-labelledby="snapshot-maker-title"
        >
          <header>
            <span>IMMUTABLE BASELINE</span>
            <h3 id="snapshot-maker-title">锁定一个交接版本。</h3>
          </header>
          <p>
            快照一旦建立便不可修改或删除。它保存当时的完整 JSON
            数据与校验摘要，可用于证明后来发生了哪些内容变化。
          </p>
          <form onSubmit={createSnapshot}>
            <label>
              <span>快照名称 *</span>
              <input
                value={label}
                maxLength={120}
                placeholder={`交接基线 / ${formatDay(new Date().toISOString())}`}
                onChange={(event) => setLabel(event.target.value)}
                disabled={creating}
              />
            </label>
            <label>
              <span>交接说明</span>
              <textarea
                value={notes}
                maxLength={2000}
                rows={4}
                placeholder="例如：媒体交付前基线；包含最终 Look 顺序与发布排期。"
                onChange={(event) => setNotes(event.target.value)}
                disabled={creating}
              />
            </label>
            <button type="submit" disabled={creating}>
              {creating ? "正在计算并锁定…" : "生成不可变快照 →"}
            </button>
          </form>
          {overview.latestSnapshot && (
            <LatestDelta
              delta={overview.latestDelta}
              latestIsCurrent={overview.latestIsCurrent}
              snapshot={overview.latestSnapshot}
            />
          )}
        </section>

        <section
          className="archive-history"
          aria-labelledby="archive-history-title"
        >
          <header>
            <div>
              <span>PROVENANCE LEDGER</span>
              <h3 id="archive-history-title">归档账本</h3>
            </div>
            <strong>
              {String(overview.snapshots.length).padStart(2, "0")} SNAPSHOTS
            </strong>
          </header>
          {overview.snapshots.length === 0 ? (
            <div className="archive-history-empty">
              <span>Ø</span>
              <strong>尚无交接快照</strong>
              <p>创建首个快照后，这里会形成不可变的版本记录。</p>
            </div>
          ) : (
            <div className="archive-history-list">
              {overview.snapshots.map((snapshot, index) => (
                <article
                  className={`archive-history-row${index === 0 ? " is-latest" : ""}`}
                  key={snapshot.id}
                >
                  <div className="archive-history-index">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {index === 0 && <small>LATEST</small>}
                  </div>
                  <div className="archive-history-copy">
                    <small>{formatDateTime(snapshot.createdAt)}</small>
                    <strong>{snapshot.label}</strong>
                    {snapshot.notes && <p>{snapshot.notes}</p>}
                    <code>SHA256 / {shortHash(snapshot.manifestHash, 20)}</code>
                  </div>
                  <div className="archive-history-counts">
                    <span>{snapshot.workCount} WORKS</span>
                    <span>{snapshot.showroomRequestCount} RESPONSES</span>
                    <span>{snapshot.sampleLoanCount} LOANS</span>
                    <span>{snapshot.sampleCommunicationCount} COMMS</span>
                    <span>{snapshot.sampleAssetCount} ASSETS</span>
                    <span>{snapshot.sampleAuditCount} AUDITS</span>
                    <span>{snapshot.samplePlacementCount} PLACEMENTS</span>
                    <span>{snapshot.relationshipContactCount} RELATIONS</span>
                    <span>{snapshot.relationshipOpportunityCount} OPPS</span>
                    <span>{snapshot.relationshipActivityCount} TOUCHPOINTS</span>
                    <span>{snapshot.outreachCampaignCount} CAMPAIGNS</span>
                    <span>{snapshot.outreachRecipientCount} RECIPIENTS</span>
                    <span>{snapshot.designReviewCount} REVIEWS</span>
                    <span>{snapshot.designReviewActionCount} REVISIONS</span>
                    <span>{snapshot.materialCount} MATERIALS</span>
                    <span>{snapshot.workMaterialCount} LOOK BOM</span>
                    <span>{snapshot.technicalPackCount} TECH PACKS</span>
                    <span>{snapshot.techPackMeasurementCount} MEASUREMENTS</span>
                    <span>{snapshot.techPackConstructionNoteCount} CONSTRUCTION</span>
                    <span>{snapshot.fittingSessionCount} FITTINGS</span>
                    <span>{snapshot.fittingIssueCount} FIT ISSUES</span>
                    <span>{snapshot.fittingImageCount} FIT IMAGES</span>
                    <span>{snapshot.sampleSignoffCount} SAMPLE GATES</span>
                    <span>{snapshot.sampleSignoffCheckCount} GATE CHECKS</span>
                    <span>{snapshot.sampleSignoffImageCount} GATE IMAGES</span>
                    <span>{snapshot.productionReleaseCount} RELEASE PACKS</span>
                    <span>{snapshot.productionReleaseCheckCount} RELEASE CHECKS</span>
                    <span>{snapshot.productionExceptionCount} DEVIATIONS</span>
                    <span>{snapshot.productionExceptionActionCount} CHANGE ACTIONS</span>
                    <span>{snapshot.mediaCount} MEDIA</span>
                    <span>{formatBytes(snapshot.mediaBytes)}</span>
                  </div>
                  <a
                    href={`/api/studio/archives/${encodeURIComponent(snapshot.id)}?download=1`}
                  >
                    下载 JSON ↘
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function InventoryMetric(props: {
  number: string;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <article>
      <span>{props.number}</span>
      <small>{props.label}</small>
      <strong>{props.value}</strong>
      <p>{props.detail}</p>
    </article>
  );
}

function ExportCard(props: {
  index: string;
  title: string;
  format: string;
  detail: string;
  href: string;
  tone?: "primary" | "acid";
}) {
  return (
    <a
      className={`archive-export-card${props.tone ? ` is-${props.tone}` : ""}`}
      href={props.href}
    >
      <div>
        <span>{props.index}</span>
        <small>{props.format}</small>
      </div>
      <strong>{props.title}</strong>
      <p>{props.detail}</p>
      <b>DOWNLOAD ↘</b>
    </a>
  );
}

function LatestDelta(props: {
  delta: ArchiveDelta | null;
  latestIsCurrent: boolean;
  snapshot: ArchiveSnapshotSummary;
}) {
  const delta = props.delta;
  return (
    <aside
      className={`archive-delta${props.latestIsCurrent ? " is-current" : ""}`}
    >
      <header>
        <span>CHANGE SINCE LATEST</span>
        <strong>{props.latestIsCurrent ? "ZERO DRIFT" : "CONTENT DRIFT"}</strong>
      </header>
      <p>
        对比「{props.snapshot.label}」· {formatDateTime(props.snapshot.createdAt)}
      </p>
      {delta && (
        <div>
          <DeltaValue label="WORKS" value={delta.works} />
          <DeltaValue label="COLLECTIONS" value={delta.collections} />
          <DeltaValue label="PROCESS" value={delta.processEntries} />
          <DeltaValue label="EVENTS" value={delta.calendarEvents} />
          <DeltaValue label="RESPONSES" value={delta.showroomRequests} />
          <DeltaValue label="LOANS" value={delta.sampleLoans} />
          <DeltaValue label="COMMS" value={delta.sampleCommunications} />
          <DeltaValue label="ASSETS" value={delta.sampleAssets} />
          <DeltaValue label="AUDITS" value={delta.sampleAudits} />
          <DeltaValue label="PLACEMENTS" value={delta.samplePlacements} />
          <DeltaValue label="RELATIONS" value={delta.relationshipContacts} />
          <DeltaValue label="OPPS" value={delta.relationshipOpportunities} />
          <DeltaValue label="TOUCHPOINTS" value={delta.relationshipActivities} />
          <DeltaValue label="CAMPAIGNS" value={delta.outreachCampaigns} />
          <DeltaValue label="RECIPIENTS" value={delta.outreachRecipients} />
          <DeltaValue label="REVIEWS" value={delta.designReviews} />
          <DeltaValue label="REVISIONS" value={delta.designReviewActions} />
          <DeltaValue label="MATERIALS" value={delta.materials} />
          <DeltaValue label="LOOK BOM" value={delta.workMaterials} />
          <DeltaValue label="TECH PACKS" value={delta.technicalPacks} />
          <DeltaValue
            label="MEASUREMENTS"
            value={delta.techPackMeasurements}
          />
          <DeltaValue
            label="CONSTRUCTION"
            value={delta.techPackConstructionNotes}
          />
          <DeltaValue label="FITTINGS" value={delta.fittingSessions} />
          <DeltaValue label="FIT ISSUES" value={delta.fittingIssues} />
          <DeltaValue label="FIT IMAGES" value={delta.fittingImages} />
          <DeltaValue label="SAMPLE GATES" value={delta.sampleSignoffs} />
          <DeltaValue
            label="GATE CHECKS"
            value={delta.sampleSignoffChecks}
          />
          <DeltaValue
            label="GATE IMAGES"
            value={delta.sampleSignoffImages}
          />
          <DeltaValue
            label="RELEASE PACKS"
            value={delta.productionReleases}
          />
          <DeltaValue
            label="RELEASE CHECKS"
            value={delta.productionReleaseChecks}
          />
          <DeltaValue
            label="DEVIATIONS"
            value={delta.productionExceptions}
          />
          <DeltaValue
            label="CHANGE ACTIONS"
            value={delta.productionExceptionActions}
          />
          <DeltaValue label="MEDIA" value={delta.mediaAssets} />
          <DeltaValue
            label="STORAGE"
            value={delta.mediaBytes}
            formatter={formatSignedBytes}
          />
        </div>
      )}
    </aside>
  );
}

function DeltaValue(props: {
  label: string;
  value: number;
  formatter?: (value: number) => string;
}) {
  return (
    <span>
      <small>{props.label}</small>
      <strong>
        {props.formatter
          ? props.formatter(props.value)
          : `${props.value > 0 ? "+" : ""}${props.value}`}
      </strong>
    </span>
  );
}

async function requestOverview() {
  const response = await fetch("/api/studio/archives", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取交接档案。");
  }
  return payload.overview;
}

function shortHash(value: string, length: number) {
  if (value.length <= length) return value;
  const side = Math.floor((length - 1) / 2);
  return `${value.slice(0, side)}…${value.slice(-side)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSignedBytes(bytes: number) {
  return `${bytes > 0 ? "+" : bytes < 0 ? "−" : ""}${formatBytes(Math.abs(bytes))}`;
}
