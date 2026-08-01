"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SeasonCollectionPulse,
  SeasonCommandAgendaItem,
  SeasonCommandGroup,
  SeasonCommandOverview,
  SeasonCommandUrgency,
} from "@/lib/season-command";

type ApiPayload = {
  overview?: SeasonCommandOverview;
  error?: string;
};

const refreshEvents = [
  "nera:inventory-updated",
  "nera:placement-updated",
  "nera:request-updated",
  "nera:loan-updated",
  "nera:loan-closed",
  "nera:relationship-updated",
  "nera:outreach-updated",
  "nera:review-updated",
  "nera:material-updated",
  "nera:tech-pack-updated",
  "nera:fitting-updated",
  "nera:sample-signoff-updated",
  "nera:production-release-updated",
  "nera:production-exception-updated",
];

const groupLabels: Record<
  SeasonCommandGroup,
  { number: string; label: string }
> = {
  CREATE: { number: "A", label: "创造与编排" },
  PUBLISH: { number: "B", label: "发布与展示" },
  RELATION: { number: "C", label: "关系与履约" },
  OPERATIONS: { number: "D", label: "运营与影响" },
  ARCHIVE: { number: "E", label: "归档与交接" },
};

const urgencyLabels: Record<SeasonCommandUrgency, string> = {
  overdue: "已逾期",
  today: "今日",
  upcoming: "将到",
  attention: "需判断",
};

export default function SeasonCommand() {
  const [overview, setOverview] =
    useState<SeasonCommandOverview | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const nextOverview = await requestCommandOverview();
      setOverview(nextOverview);
      setSelectedCollectionId((current) => {
        if (
          current &&
          nextOverview.collections.some(
            (collection) => collection.id === current,
          )
        ) {
          return current;
        }
        return nextOverview.focusCollectionId;
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法读取季度作战台。",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialOverview() {
      try {
        const nextOverview = await requestCommandOverview();
        if (cancelled) return;
        setOverview(nextOverview);
        setSelectedCollectionId(nextOverview.focusCollectionId);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "无法读取季度作战台。",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleRefresh = () => void loadOverview(true);
    refreshEvents.forEach((eventName) =>
      window.addEventListener(eventName, handleRefresh),
    );
    return () => {
      refreshEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleRefresh),
      );
    };
  }, [loadOverview]);

  const selectedCollection = useMemo(
    () =>
      overview?.collections.find(
        (collection) => collection.id === selectedCollectionId,
      ) ??
      overview?.collections[0] ??
      null,
    [overview, selectedCollectionId],
  );

  const visibleAgenda = useMemo(() => {
    if (!overview) return [];
    if (!selectedCollection) return overview.agenda;
    return overview.agenda.filter(
      (item) =>
        !item.collectionId || item.collectionId === selectedCollection.id,
    );
  }, [overview, selectedCollection]);

  if (loading && !overview) {
    return (
      <section
        className="studio-command is-loading"
        id="season-control-tower"
        aria-busy="true"
      >
        <span>18</span>
        <p>正在汇集本季事实与关键路径…</p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section
        className="studio-command is-loading is-error"
        id="season-control-tower"
      >
        <span>18</span>
        <p>{error || "季度作战台暂时不可用。"}</p>
        <button type="button" onClick={() => void loadOverview()}>
          重新读取
        </button>
      </section>
    );
  }

  const groupedModules = (
    Object.keys(groupLabels) as SeasonCommandGroup[]
  ).map((group) => ({
    group,
    modules: overview.modules.filter((module) => module.group === group),
  }));

  return (
    <section
      className={`studio-command${refreshing ? " is-refreshing" : ""}`}
      id="season-control-tower"
      aria-labelledby="season-command-title"
    >
      <div className="studio-command-hero">
        <span aria-hidden="true">18</span>
        <div>
          <small>PHASE 18 / SEASON OPERATING SYSTEM</small>
          <h2 id="season-command-title">
            SEASON
            <i>CONTROL</i>
            TOWER
          </h2>
          <p>
            把系列、发布、展厅、样衣、关系与外联放回同一条关键路径。
            这里只汇总已经发生的事实，把判断权留给设计师。
          </p>
        </div>
        <aside>
          <span>GO / NO-GO FACT CHECK</span>
          <strong>
            {overview.metrics.gateClearCount
              .toString()
              .padStart(2, "0")}
            <em>/ {overview.metrics.gateTotalCount}</em>
          </strong>
          <p>
            个发布关卡已清晰
            <small>
              {overview.metrics.gateClearCount ===
              overview.metrics.gateTotalCount
                ? "当前没有硬性阻塞"
                : `仍有 ${
                    overview.metrics.gateTotalCount -
                    overview.metrics.gateClearCount
                  } 项需要人工处理`}
            </small>
          </p>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void loadOverview(true)}
          >
            {refreshing ? "正在同步…" : "刷新事实"} <span>↻</span>
          </button>
        </aside>
      </div>

      <div className="studio-command-protocol">
        <span>CONTROL PROTOCOL</span>
        <p>事实汇总</p>
        <b>→</b>
        <p>设计师判断</p>
        <b>→</b>
        <p>人工执行</p>
        <small>
          NO AUTO-SEND · NO HIDDEN SCORE · NO TOKEN EXPOSURE
        </small>
      </div>

      {error && (
        <p className="studio-command-notice" role="status">
          {error}
        </p>
      )}

      <div className="studio-command-metrics">
        <CommandMetric
          number={overview.metrics.editorialScore}
          suffix="/100"
          label="编辑准备度"
          detail="由作品、系列、过程与发布资料即时核对"
        />
        <CommandMetric
          number={overview.metrics.attentionCount}
          label="行动议程"
          detail="逾期、今日与需要人工判断的事实"
          attention={overview.metrics.attentionCount > 0}
        />
        <CommandMetric
          number={overview.metrics.liveLoans}
          label="进行中借调"
          detail={`${overview.metrics.activeShowrooms} 个展厅当前开放`}
        />
        <CommandMetric
          number={overview.metrics.pendingApproval}
          label="外联待批准"
          detail={`${overview.metrics.openOpportunities} 个关系机会仍开放`}
          attention={overview.metrics.pendingApproval > 0}
        />
      </div>

      <section
        className="studio-command-focus"
        aria-labelledby="season-focus-title"
      >
        <header>
          <div>
            <small>01 / COLLECTION PULSE</small>
            <h3 id="season-focus-title">当前系列脉搏</h3>
          </div>
          {overview.collections.length > 1 && (
            <nav aria-label="切换当前系列">
              {overview.collections.map((collection, index) => (
                <button
                  type="button"
                  key={collection.id}
                  className={
                    collection.id === selectedCollection?.id
                      ? "is-active"
                      : ""
                  }
                  aria-pressed={
                    collection.id === selectedCollection?.id
                  }
                  onClick={() => setSelectedCollectionId(collection.id)}
                >
                  <span>{(index + 1).toString().padStart(2, "0")}</span>
                  {collection.title}
                </button>
              ))}
            </nav>
          )}
        </header>

        {selectedCollection ? (
          <CollectionPulse collection={selectedCollection} />
        ) : (
          <div className="studio-command-empty">
            <span>NO SEASON / 还没有系列</span>
            <h4>先建立本季的第一个 Collection。</h4>
            <a href="#collection-system">进入系列系统 →</a>
          </div>
        )}
      </section>

      <section
        className="studio-command-gates"
        aria-labelledby="season-gates-title"
      >
        <header>
          <div>
            <small>02 / RELEASE GATES</small>
            <h3 id="season-gates-title">八项发布关卡</h3>
          </div>
          <p>
            每一项只使用明确状态与截止时间，不对人物价值或商业结果评分。
          </p>
        </header>
        <div>
          {overview.gates.map((gate, index) => (
            <a
              className={gate.passed ? "is-clear" : "is-attention"}
              href={gate.href}
              key={gate.id}
            >
              <span>{(index + 1).toString().padStart(2, "0")}</span>
              <b>{gate.passed ? "CLEAR" : "CHECK"}</b>
              <h4>{gate.label}</h4>
              <p>{gate.detail}</p>
              <i aria-hidden="true">↘</i>
            </a>
          ))}
        </div>
      </section>

      <div className="studio-command-grid">
        <section
          className="studio-command-agenda"
          aria-labelledby="season-agenda-title"
        >
          <header>
            <div>
              <small>03 / ACTION AGENDA</small>
              <h3 id="season-agenda-title">本季行动议程</h3>
            </div>
            <span>
              {visibleAgenda.length.toString().padStart(2, "0")} ITEMS
            </span>
          </header>
          {visibleAgenda.length > 0 ? (
            <ol>
              {visibleAgenda.map((item, index) => (
                <AgendaRow item={item} index={index} key={item.id} />
              ))}
            </ol>
          ) : (
            <div className="studio-command-agenda-empty">
              <span>ALL CLEAR</span>
              <p>当前筛选下没有需要处理的事实。</p>
            </div>
          )}
        </section>

        <section
          className="studio-command-map"
          aria-labelledby="season-map-title"
        >
          <header>
            <div>
              <small>04 / STUDIO MAP</small>
              <h3 id="season-map-title">工作台索引</h3>
            </div>
            <span>24 WORKBENCHES</span>
          </header>
          <div>
            {groupedModules.map(({ group, modules }) => (
              <section key={group}>
                <header>
                  <span>{groupLabels[group].number}</span>
                  <div>
                    <b>{group}</b>
                    <small>{groupLabels[group].label}</small>
                  </div>
                </header>
                <div>
                  {modules.map((module) => (
                    <a
                      className={`is-${module.state}`}
                      href={module.href}
                      key={module.phase}
                    >
                      <span>{module.phase}</span>
                      <div>
                        <strong>{module.label}</strong>
                        <small>{module.english}</small>
                      </div>
                      <b>
                        {module.value}
                        <small>{module.unit}</small>
                      </b>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>

      <footer className="studio-command-footer">
        <span>LAST FACT SYNC</span>
        <time dateTime={overview.generatedAt}>
          {formatDateTime(overview.generatedAt)}
        </time>
        <p>
          {overview.archive.latestLabel
            ? `最新归档：${overview.archive.latestLabel} · nera-archive/${overview.archive.schemaVersion}`
            : "尚未创建不可变交接快照"}
        </p>
        <a href="#archive-handoff">前往归档 →</a>
      </footer>
    </section>
  );
}

function CommandMetric({
  number,
  suffix = "",
  label,
  detail,
  attention = false,
}: {
  number: number;
  suffix?: string;
  label: string;
  detail: string;
  attention?: boolean;
}) {
  return (
    <article className={attention ? "is-attention" : ""}>
      <span>LIVE</span>
      <strong>
        {number.toString().padStart(2, "0")}
        {suffix && <small>{suffix}</small>}
      </strong>
      <h3>{label}</h3>
      <p>{detail}</p>
    </article>
  );
}

function CollectionPulse({
  collection,
}: {
  collection: SeasonCollectionPulse;
}) {
  return (
    <div className="studio-command-pulse">
      <div className="studio-command-pulse-title">
        <span>{collection.readiness}%</span>
        <div>
          <small>
            {collection.season || "SEASON"} / {collection.year}
          </small>
          <h4>{collection.title}</h4>
          <p>
            {collection.status === "published" ? "系列已公开" : "系列仍为草稿"}
            {" · "}
            {collection.publishedLookCount}/{collection.lookCount} 个 Look
            已公开
          </p>
        </div>
      </div>
      <div className="studio-command-pulse-bar">
        <span style={{ width: `${collection.readiness}%` }} />
      </div>
      <div className="studio-command-pulse-checks">
        {collection.checks.map((check) => (
          <div
            className={check.passed ? "is-clear" : "is-open"}
            key={check.id}
          >
            <span>{check.passed ? "●" : "○"}</span>
            <p>{check.label}</p>
          </div>
        ))}
      </div>
      <dl>
        <div>
          <dt>PUBLICATION</dt>
          <dd>
            {collection.publication?.headline || "尚未建立发布包"}
            <small>
              {collection.publication
                ? statusLabel(collection.publication.status)
                : "OPEN"}
            </small>
          </dd>
        </div>
        <div>
          <dt>NEXT MILESTONE</dt>
          <dd>
            {collection.nextEventAt
              ? formatDateTime(collection.nextEventAt)
              : "尚无未来排期"}
            <small>{collection.eventCount} EVENTS</small>
          </dd>
        </div>
        <div>
          <dt>OUTREACH</dt>
          <dd>
            {collection.activeCampaignCount} 个活动可执行
            <small>
              {collection.pendingApprovalCount} PENDING /{" "}
              {collection.campaignCount} TOTAL
            </small>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AgendaRow({
  item,
  index,
}: {
  item: SeasonCommandAgendaItem;
  index: number;
}) {
  return (
    <li className={`is-${item.urgency}`}>
      <span>{(index + 1).toString().padStart(2, "0")}</span>
      <time dateTime={item.dueAt ?? undefined}>
        {item.dueAt ? formatShortDate(item.dueAt) : "OPEN"}
      </time>
      <div>
        <small>{item.eyebrow}</small>
        <h4>{item.title}</h4>
        <p>{item.detail}</p>
      </div>
      <b>{urgencyLabels[item.urgency]}</b>
      <a href={item.href} aria-label={`处理：${item.title}`}>
        ↗
      </a>
    </li>
  );
}

function statusLabel(status: string): string {
  if (status === "published") return "PUBLISHED";
  if (status === "scheduled") return "SCHEDULED";
  return "DRAFT";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function requestCommandOverview(): Promise<SeasonCommandOverview> {
  const response = await fetch("/api/studio/command", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.overview) {
    throw new Error(payload.error || "无法读取季度作战台。");
  }
  return payload.overview;
}
