"use client";

import { useEffect, useMemo, useState } from "react";
import type { Work } from "@/db/schema";
import type {
  SampleAsset,
  SampleAssetCategory,
  SampleAssetCondition,
  SampleAssetStatus,
  SampleAssetWithAssignment,
  SampleAuditItem,
  SampleAuditWorkspace,
} from "@/lib/sample-inventory";
import type { SampleLoanWorkspace } from "@/lib/sample-loans";

type ApiPayload = {
  assets?: SampleAssetWithAssignment[];
  works?: Work[];
  loans?: SampleLoanWorkspace[];
  audits?: SampleAuditWorkspace[];
  asset?: SampleAsset | SampleAssetWithAssignment;
  loan?: SampleLoanWorkspace | null;
  audit?: SampleAuditWorkspace | null;
  error?: string;
};

type AssetFilter =
  | "all"
  | "available"
  | "reserved"
  | "circulating"
  | "attention"
  | "archived";

const assetStatuses: Array<{ value: SampleAssetStatus; label: string }> = [
  { value: "available", label: "可用" },
  { value: "reserved", label: "已预留" },
  { value: "in_transit", label: "运输中" },
  { value: "out_on_loan", label: "借出中" },
  { value: "maintenance", label: "待维护" },
  { value: "missing", label: "缺失" },
  { value: "archived", label: "已归档" },
];

const categories: Array<{ value: SampleAssetCategory; label: string }> = [
  { value: "garment", label: "服装" },
  { value: "accessory", label: "配饰" },
  { value: "footwear", label: "鞋履" },
  { value: "bag", label: "包袋" },
  { value: "jewelry", label: "珠宝" },
  { value: "other", label: "其他" },
];

const conditions: Array<{ value: SampleAssetCondition; label: string }> = [
  { value: "not_checked", label: "未检查" },
  { value: "excellent", label: "极佳" },
  { value: "good", label: "良好" },
  { value: "worn", label: "有使用痕迹" },
  { value: "damaged", label: "损坏" },
];

const filters: Array<{ value: AssetFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "available", label: "可用" },
  { value: "reserved", label: "预留" },
  { value: "circulating", label: "流转中" },
  { value: "attention", label: "需处理" },
  { value: "archived", label: "归档" },
];

const emptyAssetForm = {
  workId: "",
  assetCode: "",
  tagCode: "",
  sizeLabel: "",
  colorLabel: "",
  category: "garment" as SampleAssetCategory,
  condition: "not_checked" as SampleAssetCondition,
  department: "SHOWROOM",
  homeLocation: "MAIN RACK",
  notes: "",
};

const emptyAuditForm = {
  label: "",
  scopeLocation: "",
  scopeDepartment: "",
  notes: "",
};

export default function SampleInventoryAudit() {
  const [assets, setAssets] = useState<SampleAssetWithAssignment[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loans, setLoans] = useState<SampleLoanWorkspace[]>([]);
  const [audits, setAudits] = useState<SampleAuditWorkspace[]>([]);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [auditForm, setAuditForm] = useState(emptyAuditForm);
  const [loading, setLoading] = useState(true);
  const [savingAsset, setSavingAsset] = useState(false);
  const [savingAudit, setSavingAudit] = useState(false);
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const payload = await requestInventory();
        if (!cancelled) {
          setAssets(payload.assets);
          setWorks(payload.works);
          setLoans(payload.loans);
          setAudits(payload.audits);
          if (payload.works[0]) {
            setAssetForm((current) => ({
              ...current,
              workId: payload.works[0].id,
            }));
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "无法读取样衣资产库。",
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

  useEffect(() => {
    let cancelled = false;
    async function syncLoans() {
      try {
        const payload = await requestInventory();
        if (!cancelled) {
          setAssets(payload.assets);
          setLoans(payload.loans);
          setAudits(payload.audits);
        }
      } catch {
        // Keep the current board usable when a background sync is interrupted.
      }
    }
    window.addEventListener("nera:loan-updated", syncLoans);
    return () => {
      cancelled = true;
      window.removeEventListener("nera:loan-updated", syncLoans);
    };
  }, []);

  async function refresh(successMessage = "", notify = true) {
    setError("");
    if (successMessage) setMessage(successMessage);
    try {
      const payload = await requestInventory();
      setAssets(payload.assets);
      setWorks(payload.works);
      setLoans(payload.loans);
      setAudits(payload.audits);
      if (notify) {
        window.dispatchEvent(new CustomEvent("nera:inventory-updated"));
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "无法刷新样衣资产库。",
      );
    }
  }

  const activeLoanItems = useMemo(
    () =>
      loans.flatMap((workspace) =>
        ["closed", "cancelled", "returned"].includes(workspace.loan.status)
          ? []
          : workspace.items
              .filter(
                (item) =>
                  !["returned", "lost", "damaged", "unavailable"].includes(
                    item.status,
                  ),
              )
              .map((item) => ({ workspace, item })),
      ),
    [loans],
  );

  const metrics = useMemo(
    () => ({
      total: assets.length,
      available: assets.filter((row) => row.asset.status === "available")
        .length,
      circulating: assets.filter((row) =>
        ["in_transit", "out_on_loan"].includes(row.asset.status),
      ).length,
      attention: assets.filter((row) =>
        ["maintenance", "missing"].includes(row.asset.status),
      ).length,
      unassigned: activeLoanItems.filter(({ item }) => !item.sampleAssetId)
        .length,
      openAudits: audits.filter((item) =>
        ["counting", "review"].includes(item.audit.status),
      ).length,
      discrepancies: audits
        .filter((item) => item.audit.status === "review")
        .reduce((total, item) => total + item.summary.unresolved, 0),
    }),
    [activeLoanItems, assets, audits],
  );

  const visibleAssets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return assets.filter((row) => {
      if (!matchesAssetFilter(row.asset, filter)) return false;
      if (!needle) return true;
      return [
        row.asset.assetCode,
        row.asset.tagCode,
        row.asset.workTitle,
        row.asset.lookNumber,
        row.asset.sizeLabel,
        row.asset.colorLabel,
        row.asset.department,
        row.asset.currentLocation,
        row.assignment?.loanCode,
        row.assignment?.projectTitle,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [assets, filter, query]);

  async function createAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!assetForm.workId) return setError("请选择对应作品。");
    setSavingAsset(true);
    try {
      const response = await fetch("/api/studio/sample-inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(assetForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.asset) {
        throw new Error(payload.error || "建立样衣资产失败。");
      }
      const workId = assetForm.workId;
      setAssetForm({ ...emptyAssetForm, workId });
      await refresh("实物样衣已登记并获得唯一资产编号。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立样衣资产失败。",
      );
    } finally {
      setSavingAsset(false);
    }
  }

  async function assignAsset(itemId: string, assetId: string) {
    setError("");
    setMessage("");
    setAssigningItemId(itemId);
    try {
      const response = await fetch(
        `/api/studio/sample-inventory/assignments/${encodeURIComponent(itemId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetId: assetId || null }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.loan) {
        throw new Error(payload.error || "分配实物样衣失败。");
      }
      window.dispatchEvent(
        new CustomEvent("nera:inventory-updated", {
          detail: payload.loan,
        }),
      );
      await refresh(
        assetId ? "实物样衣已分配到借调项。" : "实物样衣已解除分配。",
        false,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "分配实物样衣失败。",
      );
    } finally {
      setAssigningItemId(null);
    }
  }

  async function createAudit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSavingAudit(true);
    try {
      const response = await fetch("/api/studio/sample-audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(auditForm),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.audit) {
        throw new Error(payload.error || "建立盘点会话失败。");
      }
      setAuditForm(emptyAuditForm);
      await refresh("盘点会话已建立，可开始扫描资产编号或标签。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "建立盘点会话失败。",
      );
    } finally {
      setSavingAudit(false);
    }
  }

  if (loading) {
    return (
      <section className="studio-inventory is-loading">
        <p>正在准备 Sample Inventory &amp; Audit…</p>
      </section>
    );
  }

  return (
    <section
      className="studio-inventory"
      id="sample-inventory"
      aria-labelledby="sample-inventory-title"
    >
      <header className="studio-inventory-hero">
        <span className="studio-inventory-number" aria-hidden="true">
          12
        </span>
        <div>
          <span>12 / SAMPLE INVENTORY &amp; AUDIT</span>
          <h2 id="sample-inventory-title">
            在库。流转。<i>核对。</i>
          </h2>
          <p>
            为每件实物建立唯一身份，让系统记录与现场库位在借出、归还和换季归档时保持一致。
          </p>
        </div>
        <aside>
          <span>PHYSICAL TRUTH</span>
          <strong>{String(metrics.available).padStart(2, "0")}</strong>
          <small>AVAILABLE NOW</small>
          <dl>
            <div>
              <dt>TOTAL ASSETS</dt>
              <dd>{metrics.total}</dd>
            </div>
            <div>
              <dt>CIRCULATING</dt>
              <dd>{metrics.circulating}</dd>
            </div>
            <div className={metrics.attention ? "is-alert" : ""}>
              <dt>ATTENTION</dt>
              <dd>{metrics.attention}</dd>
            </div>
            <div className={metrics.discrepancies ? "is-alert" : ""}>
              <dt>DISCREPANCIES</dt>
              <dd>{metrics.discrepancies}</dd>
            </div>
          </dl>
        </aside>
      </header>

      <div className="studio-inventory-protocol">
        <span>SINGLE SOURCE / 实物唯一身份</span>
        <p>
          资产编号永久不变；标签编号可对应条码或 RFID。借调状态会同步资产可用性，
          盘点只在差异确认后改写库位或缺失状态。
        </p>
      </div>

      {(error || message) && (
        <div
          className={`studio-inventory-notice${error ? " is-error" : ""}`}
          role="status"
        >
          {error || message}
        </div>
      )}

      <section className="studio-inventory-register">
        <header>
          <div>
            <span>ASSET REGISTRATION</span>
            <h3>登记实物样衣</h3>
          </div>
          <strong>{String(metrics.total).padStart(2, "0")} ASSETS</strong>
        </header>
        <form onSubmit={(event) => void createAsset(event)}>
          <label className="is-wide">
            <span>对应作品 *</span>
            <select
              required
              value={assetForm.workId}
              onChange={(event) =>
                setAssetForm({ ...assetForm, workId: event.target.value })
              }
            >
              {works.length === 0 && <option value="">暂无作品</option>}
              {works.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.lookNumber || "LOOK"} · {work.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>资产编号</span>
            <input
              maxLength={80}
              value={assetForm.assetCode}
              placeholder="留空自动生成"
              onChange={(event) =>
                setAssetForm({ ...assetForm, assetCode: event.target.value })
              }
            />
          </label>
          <label>
            <span>标签 / RFID</span>
            <input
              maxLength={160}
              value={assetForm.tagCode}
              placeholder="可选"
              onChange={(event) =>
                setAssetForm({ ...assetForm, tagCode: event.target.value })
              }
            />
          </label>
          <label>
            <span>尺码</span>
            <input
              maxLength={80}
              value={assetForm.sizeLabel}
              onChange={(event) =>
                setAssetForm({ ...assetForm, sizeLabel: event.target.value })
              }
            />
          </label>
          <label>
            <span>颜色</span>
            <input
              maxLength={120}
              value={assetForm.colorLabel}
              onChange={(event) =>
                setAssetForm({ ...assetForm, colorLabel: event.target.value })
              }
            />
          </label>
          <label>
            <span>类别</span>
            <select
              value={assetForm.category}
              onChange={(event) =>
                setAssetForm({
                  ...assetForm,
                  category: event.target.value as SampleAssetCategory,
                })
              }
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>初始品相</span>
            <select
              value={assetForm.condition}
              onChange={(event) =>
                setAssetForm({
                  ...assetForm,
                  condition: event.target.value as SampleAssetCondition,
                })
              }
            >
              {conditions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>部门</span>
            <input
              maxLength={160}
              value={assetForm.department}
              onChange={(event) =>
                setAssetForm({ ...assetForm, department: event.target.value })
              }
            />
          </label>
          <label>
            <span>固定库位</span>
            <input
              required
              maxLength={180}
              value={assetForm.homeLocation}
              onChange={(event) =>
                setAssetForm({
                  ...assetForm,
                  homeLocation: event.target.value,
                })
              }
            />
          </label>
          <label className="is-wide">
            <span>资产备注</span>
            <textarea
              maxLength={1600}
              rows={3}
              value={assetForm.notes}
              onChange={(event) =>
                setAssetForm({ ...assetForm, notes: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={savingAsset || works.length === 0}>
            {savingAsset ? "正在登记…" : "建立实物资产 →"}
          </button>
        </form>
      </section>

      <section className="studio-inventory-allocation">
        <header>
          <div>
            <span>LOAN ALLOCATION</span>
            <h3>借调实物分配</h3>
          </div>
          <strong
            className={metrics.unassigned ? "is-alert" : undefined}
          >
            {String(metrics.unassigned).padStart(2, "0")} UNASSIGNED
          </strong>
        </header>
        {activeLoanItems.length === 0 ? (
          <p>暂无进行中的借调项。</p>
        ) : (
          <div>
            {activeLoanItems.map(({ workspace, item }) => {
              const matching = assets.filter(
                (row) =>
                  row.asset.workId === item.workId &&
                  (row.asset.status === "available" ||
                    row.asset.id === item.sampleAssetId),
              );
              return (
                <article key={item.id}>
                  <img src={mediaUrl(item.imageKey)} alt={item.workTitle} />
                  <div>
                    <span>{workspace.loan.loanCode}</span>
                    <h4>{item.workTitle}</h4>
                    <p>
                      {item.lookNumber || "LOOK"} ·{" "}
                      {workspace.request.projectTitle}
                    </p>
                  </div>
                  <label>
                    <span>实物样衣</span>
                    <select
                      value={item.sampleAssetId ?? ""}
                      disabled={assigningItemId === item.id}
                      onChange={(event) =>
                        void assignAsset(item.id, event.target.value)
                      }
                    >
                      <option value="">
                        {item.sampleAssetId ? "解除分配" : "选择可用资产"}
                      </option>
                      {matching.map((row) => (
                        <option key={row.asset.id} value={row.asset.id}>
                          {row.asset.assetCode} ·{" "}
                          {row.asset.sizeLabel || "NO SIZE"} ·{" "}
                          {row.asset.currentLocation}
                        </option>
                      ))}
                    </select>
                  </label>
                  <b className={item.sampleAssetId ? "is-ready" : ""}>
                    {item.sampleAssetId ? "ALLOCATED" : "NEEDS ASSET"}
                  </b>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="studio-inventory-ledger">
        <header>
          <div>
            <span>MASTER INVENTORY</span>
            <h3>样衣资产总表</h3>
          </div>
          <a href="/api/studio/sample-inventory?format=csv" download>
            导出库存 CSV ↘
          </a>
        </header>
        <div className="studio-inventory-tools">
          <div>
            {filters.map((item) => (
              <button
                type="button"
                key={item.value}
                className={filter === item.value ? "is-active" : ""}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span>
                  {
                    assets.filter((row) =>
                      matchesAssetFilter(row.asset, item.value),
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <label>
            <span>搜索资产</span>
            <input
              type="search"
              value={query}
              placeholder="资产编号、作品、库位、借调单"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {assets.length === 0 ? (
          <div className="studio-inventory-empty">
            <span>INVENTORY / 00</span>
            <h4>尚未登记实物样衣。</h4>
            <p>从上方选择作品，为第一件实物建立唯一身份。</p>
          </div>
        ) : visibleAssets.length === 0 ? (
          <div className="studio-inventory-empty">
            <span>NO MATCH</span>
            <h4>当前筛选没有资产。</h4>
          </div>
        ) : (
          <div className="studio-inventory-list">
            {visibleAssets.map((row) => (
              <AssetCard
                key={`${row.asset.id}:${row.asset.updatedAt}`}
                row={row}
                onRefresh={refresh}
                onError={setError}
              />
            ))}
          </div>
        )}
      </section>

      <section className="studio-audits">
        <header>
          <div>
            <span>INVENTORY AUDITS</span>
            <h3>现场盘点与差异处置</h3>
          </div>
          <strong>{String(metrics.openAudits).padStart(2, "0")} OPEN</strong>
        </header>
        <form
          className="studio-audit-create"
          onSubmit={(event) => void createAudit(event)}
        >
          <label>
            <span>盘点名称 *</span>
            <input
              required
              maxLength={180}
              value={auditForm.label}
              placeholder="例如：AW27 季末盘点"
              onChange={(event) =>
                setAuditForm({ ...auditForm, label: event.target.value })
              }
            />
          </label>
          <label>
            <span>限定库位</span>
            <input
              maxLength={180}
              value={auditForm.scopeLocation}
              placeholder="留空核对全部库位"
              onChange={(event) =>
                setAuditForm({
                  ...auditForm,
                  scopeLocation: event.target.value,
                })
              }
            />
          </label>
          <label>
            <span>限定部门</span>
            <input
              maxLength={160}
              value={auditForm.scopeDepartment}
              placeholder="留空核对全部部门"
              onChange={(event) =>
                setAuditForm({
                  ...auditForm,
                  scopeDepartment: event.target.value,
                })
              }
            />
          </label>
          <label className="is-wide">
            <span>盘点说明</span>
            <input
              maxLength={1600}
              value={auditForm.notes}
              onChange={(event) =>
                setAuditForm({ ...auditForm, notes: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={savingAudit || assets.length === 0}>
            {savingAudit ? "正在建立…" : "开始盘点 →"}
          </button>
        </form>

        {audits.length === 0 ? (
          <div className="studio-audits-empty">
            <span>AUDIT LEDGER / 00</span>
            <h4>尚无盘点会话。</h4>
          </div>
        ) : (
          <div className="studio-audits-list">
            {audits.map((audit, index) => (
              <AuditCard
                key={`${audit.audit.id}:${audit.audit.updatedAt}`}
                workspace={audit}
                initiallyOpen={
                  index === 0 &&
                  ["counting", "review"].includes(audit.audit.status)
                }
                onRefresh={refresh}
                onError={setError}
                onMessage={setMessage}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function AssetCard(props: {
  row: SampleAssetWithAssignment;
  onRefresh: (message?: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => assetEditForm(props.row.asset));
  const { asset, assignment } = props.row;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onError("");
    setSaving(true);
    try {
      const response = await fetch(
        `/api/studio/sample-inventory/${encodeURIComponent(asset.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.asset) {
        throw new Error(payload.error || "保存样衣资产失败。");
      }
      await props.onRefresh(`资产 ${asset.assetCode} 已更新。`);
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "保存样衣资产失败。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className={`studio-asset is-${asset.status}${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="studio-asset-head"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <img src={mediaUrl(asset.imageKey)} alt={asset.workTitle} />
        <span>{asset.assetCode}</span>
        <div>
          <small>{asset.lookNumber || categoryLabel(asset.category)}</small>
          <strong>{asset.workTitle}</strong>
        </div>
        <div>
          <small>LOCATION</small>
          <strong>{asset.currentLocation}</strong>
        </div>
        <div>
          <small>SIZE / CONDITION</small>
          <strong>
            {asset.sizeLabel || "—"} / {conditionLabel(asset.condition)}
          </strong>
        </div>
        <b>{assetStatusLabel(asset.status)}</b>
        <i>{open ? "−" : "+"}</i>
      </button>
      {open && (
        <div className="studio-asset-body">
          <aside>
            <span>IDENTITY</span>
            <strong>{asset.assetCode}</strong>
            <dl>
              <div>
                <dt>TAG / RFID</dt>
                <dd>{asset.tagCode || "NOT SET"}</dd>
              </div>
              <div>
                <dt>HOME</dt>
                <dd>{asset.homeLocation}</dd>
              </div>
              <div>
                <dt>DEPARTMENT</dt>
                <dd>{asset.department}</dd>
              </div>
              <div>
                <dt>LAST AUDIT</dt>
                <dd>
                  {asset.lastAuditAt
                    ? formatDateTime(asset.lastAuditAt)
                    : "NEVER"}
                </dd>
              </div>
            </dl>
            {assignment && (
              <div className="studio-asset-assignment">
                <span>ACTIVE LOAN</span>
                <strong>{assignment.loanCode}</strong>
                <p>
                  {assignment.projectTitle} · {assignment.requesterName}
                </p>
                <a href="#sample-fulfilment">查看借调单 ↑</a>
              </div>
            )}
          </aside>
          <form onSubmit={(event) => void save(event)}>
            <div>
              <label>
                <span>标签 / RFID</span>
                <input
                  maxLength={160}
                  value={form.tagCode}
                  onChange={(event) =>
                    setForm({ ...form, tagCode: event.target.value })
                  }
                />
              </label>
              <label>
                <span>尺码</span>
                <input
                  maxLength={80}
                  value={form.sizeLabel}
                  onChange={(event) =>
                    setForm({ ...form, sizeLabel: event.target.value })
                  }
                />
              </label>
              <label>
                <span>颜色</span>
                <input
                  maxLength={120}
                  value={form.colorLabel}
                  onChange={(event) =>
                    setForm({ ...form, colorLabel: event.target.value })
                  }
                />
              </label>
              <label>
                <span>类别</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value as SampleAssetCategory,
                    })
                  }
                >
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as SampleAssetStatus,
                    })
                  }
                >
                  {assetStatuses.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>品相</span>
                <select
                  value={form.condition}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      condition: event.target.value as SampleAssetCondition,
                    })
                  }
                >
                  {conditions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>部门</span>
                <input
                  maxLength={160}
                  value={form.department}
                  onChange={(event) =>
                    setForm({ ...form, department: event.target.value })
                  }
                />
              </label>
              <label>
                <span>固定库位</span>
                <input
                  maxLength={180}
                  value={form.homeLocation}
                  onChange={(event) =>
                    setForm({ ...form, homeLocation: event.target.value })
                  }
                />
              </label>
              <label>
                <span>当前位置</span>
                <input
                  maxLength={180}
                  value={form.currentLocation}
                  onChange={(event) =>
                    setForm({ ...form, currentLocation: event.target.value })
                  }
                />
              </label>
              <label className="is-wide">
                <span>备注</span>
                <textarea
                  maxLength={1600}
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                />
              </label>
            </div>
            <button type="submit" disabled={saving}>
              {saving ? "正在保存…" : "保存资产资料"}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function AuditCard(props: {
  workspace: SampleAuditWorkspace;
  initiallyOpen: boolean;
  onRefresh: (message?: string) => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [open, setOpen] = useState(props.initiallyOpen);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState({
    code: "",
    observedLocation: props.workspace.audit.scopeLocation || "MAIN RACK",
    observedCondition: "not_checked" as SampleAssetCondition,
  });
  const { audit, items, summary } = props.workspace;

  async function scanAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onError("");
    props.onMessage("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/studio/sample-audits/${encodeURIComponent(audit.id)}/scan`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(scan),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.audit) {
        throw new Error(payload.error || "登记扫描失败。");
      }
      setScan((current) => ({ ...current, code: "" }));
      await props.onRefresh(`已扫描 ${scan.code.toUpperCase()}。`);
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "登记扫描失败。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function auditAction(
    action: "finish_count" | "complete" | "cancel",
  ) {
    props.onError("");
    props.onMessage("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/studio/sample-audits/${encodeURIComponent(audit.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.audit) {
        throw new Error(payload.error || "更新盘点状态失败。");
      }
      await props.onRefresh(
        action === "finish_count"
          ? "扫描已结束，未出现的资产已列为缺失，进入差异复核。"
          : action === "complete"
            ? "盘点已完成并写入所有资产的最近盘点时间。"
            : "盘点会话已取消。",
      );
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "更新盘点状态失败。",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resolveItem(item: SampleAuditItem) {
    props.onError("");
    props.onMessage("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/studio/sample-audits/${encodeURIComponent(audit.id)}/items/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.audit) {
        throw new Error(payload.error || "处理盘点差异失败。");
      }
      await props.onRefresh(`差异 ${item.assetCode} 已处理并写回资产库。`);
    } catch (cause) {
      props.onError(
        cause instanceof Error ? cause.message : "处理盘点差异失败。",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`studio-audit is-${audit.status}${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="studio-audit-head"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{audit.auditCode}</span>
        <div>
          <small>{formatDateTime(audit.startedAt)}</small>
          <strong>{audit.label}</strong>
        </div>
        <div>
          <small>SCOPE</small>
          <strong>
            {audit.scopeLocation || "ALL LOCATIONS"} ·{" "}
            {audit.scopeDepartment || "ALL DEPARTMENTS"}
          </strong>
        </div>
        <div>
          <small>PROGRESS</small>
          <strong>
            {summary.matched +
              summary.accountedOut +
              summary.misplaced +
              summary.unexpected}
            {" / "}
            {summary.total}
          </strong>
        </div>
        <b>{auditStatusLabel(audit.status)}</b>
        <i>{open ? "−" : "+"}</i>
      </button>
      {open && (
        <div className="studio-audit-body">
          <section className="studio-audit-summary">
            <div>
              <span>MATCHED</span>
              <strong>{summary.matched}</strong>
            </div>
            <div>
              <span>PENDING</span>
              <strong>{summary.pending}</strong>
            </div>
            <div>
              <span>ACCOUNTED OUT</span>
              <strong>{summary.accountedOut}</strong>
            </div>
            <div className={summary.misplaced ? "is-alert" : ""}>
              <span>MISPLACED</span>
              <strong>{summary.misplaced}</strong>
            </div>
            <div className={summary.missing ? "is-alert" : ""}>
              <span>MISSING</span>
              <strong>{summary.missing}</strong>
            </div>
            <div className={summary.unexpected ? "is-alert" : ""}>
              <span>UNEXPECTED</span>
              <strong>{summary.unexpected}</strong>
            </div>
            <a
              href={`/api/studio/sample-audits/${encodeURIComponent(audit.id)}?format=csv`}
              download
            >
              CSV ↘
            </a>
          </section>

          {audit.status === "counting" && (
            <form
              className="studio-audit-scanner"
              onSubmit={(event) => void scanAsset(event)}
            >
              <label>
                <span>扫描资产编号 / 标签 *</span>
                <input
                  required
                  autoFocus
                  maxLength={160}
                  value={scan.code}
                  placeholder="SMP-… / RFID"
                  onChange={(event) =>
                    setScan({ ...scan, code: event.target.value })
                  }
                />
              </label>
              <label>
                <span>现场位置 *</span>
                <input
                  required
                  maxLength={180}
                  value={scan.observedLocation}
                  onChange={(event) =>
                    setScan({
                      ...scan,
                      observedLocation: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>现场品相</span>
                <select
                  value={scan.observedCondition}
                  onChange={(event) =>
                    setScan({
                      ...scan,
                      observedCondition: event.target
                        .value as SampleAssetCondition,
                    })
                  }
                >
                  {conditions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "正在登记…" : "登记扫描 →"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void auditAction("finish_count")}
              >
                结束扫描，生成差异
              </button>
            </form>
          )}

          <div className="studio-audit-items">
            {items.map((item) => (
              <article
                key={item.id}
                className={`is-${item.result}${item.resolvedAt ? " is-resolved" : ""}`}
              >
                <span>{item.assetCode}</span>
                <div>
                  <strong>{item.workTitle || "UNLINKED ASSET"}</strong>
                  <small>
                    EXPECTED / {item.expectedLocation || "—"} · OBSERVED /{" "}
                    {item.observedLocation || "—"}
                  </small>
                </div>
                <b>{auditResultLabel(item.result)}</b>
                {audit.status === "review" &&
                  ["misplaced", "missing", "unexpected"].includes(
                    item.result,
                  ) &&
                  !item.resolvedAt && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resolveItem(item)}
                    >
                      接受处理
                    </button>
                  )}
                {item.resolvedAt && <i>RESOLVED</i>}
              </article>
            ))}
          </div>

          {audit.status === "review" && (
            <footer>
              <p>
                {summary.unresolved > 0
                  ? `仍有 ${summary.unresolved} 条差异需要确认。`
                  : "全部差异已处理，可以完成盘点。"}
              </p>
              <button
                type="button"
                disabled={busy || summary.unresolved > 0}
                onClick={() => void auditAction("complete")}
              >
                完成盘点并锁定结果 →
              </button>
            </footer>
          )}
        </div>
      )}
    </article>
  );
}

async function requestInventory() {
  const response = await fetch("/api/studio/sample-inventory", {
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;
  if (
    !response.ok ||
    !payload.assets ||
    !payload.works ||
    !payload.loans ||
    !payload.audits
  ) {
    throw new Error(payload.error || "无法读取样衣资产库。");
  }
  return {
    assets: payload.assets,
    works: payload.works,
    loans: payload.loans,
    audits: payload.audits,
  };
}

function assetEditForm(asset: SampleAsset) {
  return {
    tagCode: asset.tagCode ?? "",
    sizeLabel: asset.sizeLabel,
    colorLabel: asset.colorLabel,
    category: asset.category,
    status: asset.status,
    condition: asset.condition,
    department: asset.department,
    homeLocation: asset.homeLocation,
    currentLocation: asset.currentLocation,
    notes: asset.notes,
  };
}

function matchesAssetFilter(asset: SampleAsset, filter: AssetFilter) {
  if (filter === "all") return true;
  if (filter === "circulating") {
    return ["in_transit", "out_on_loan"].includes(asset.status);
  }
  if (filter === "attention") {
    return ["maintenance", "missing"].includes(asset.status);
  }
  return asset.status === filter;
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function assetStatusLabel(status: SampleAssetStatus) {
  return assetStatuses.find((item) => item.value === status)?.label ?? status;
}

function categoryLabel(category: SampleAssetCategory) {
  return categories.find((item) => item.value === category)?.label ?? category;
}

function conditionLabel(condition: SampleAssetCondition) {
  return (
    conditions.find((item) => item.value === condition)?.label ?? condition
  );
}

function auditStatusLabel(status: SampleAuditWorkspace["audit"]["status"]) {
  return (
    {
      counting: "扫描中",
      review: "差异复核",
      completed: "已完成",
      cancelled: "已取消",
    } as const
  )[status];
}

function auditResultLabel(result: SampleAuditItem["result"]) {
  return (
    {
      pending: "待扫描",
      matched: "位置一致",
      accounted_out: "借出在外",
      misplaced: "库位不符",
      missing: "未找到",
      unexpected: "意外出现",
    } as const
  )[result];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
