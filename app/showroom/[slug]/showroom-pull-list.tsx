"use client";

import { useMemo, useState } from "react";
import type {
  ShowroomRequestPurpose,
  ShowroomRequestRole,
} from "@/lib/showroom-requests";

type PullListItem = {
  assignment: {
    workId: string;
    note: string;
    sampleStatus: "available" | "on_request" | "unavailable";
    featured: boolean;
  };
  work: {
    id: string;
    title: string;
    lookNumber: string;
    description: string;
    altText: string;
    imageKey: string;
  };
};

type SubmissionReceipt = {
  referenceCode: string;
  status: "submitted";
  submittedAt?: string;
  itemCount?: number;
  duplicate?: boolean;
};

const emptyForm = {
  requesterName: "",
  requesterEmail: "",
  organization: "",
  requesterRole: "" as ShowroomRequestRole | "",
  purpose: "" as ShowroomRequestPurpose | "",
  projectTitle: "",
  neededFrom: "",
  neededUntil: "",
  deliveryCity: "",
  notes: "",
  consent: false,
};

const roles: Array<{ value: ShowroomRequestRole; label: string }> = [
  { value: "buyer", label: "BUYER / 买手" },
  { value: "stylist", label: "STYLIST / 造型师" },
  { value: "editorial", label: "EDITORIAL / 编辑媒体" },
  { value: "talent", label: "TALENT / 艺人团队" },
  { value: "other", label: "OTHER / 其他" },
];

const purposes: Array<{
  value: ShowroomRequestPurpose;
  label: string;
}> = [
  { value: "editorial_shoot", label: "EDITORIAL SHOOT / 编辑拍摄" },
  { value: "red_carpet", label: "RED CARPET / 红毯" },
  { value: "fitting", label: "FITTING / 试衣" },
  { value: "buyer_review", label: "BUYER REVIEW / 买手审款" },
  { value: "event", label: "EVENT / 活动" },
  { value: "other", label: "OTHER / 其他" },
];

export default function ShowroomPullList(props: {
  items: PullListItem[];
  showroomSlug: string;
  showroomTitle: string;
  accessKey: string;
  submissionEnabled: boolean;
  allowDownloads: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);

  const itemById = useMemo(
    () => new Map(props.items.map((item) => [item.work.id, item])),
    [props.items],
  );
  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => itemById.get(id))
        .filter((item): item is PullListItem => Boolean(item)),
    [itemById, selectedIds],
  );

  function toggleItem(item: PullListItem) {
    if (item.assignment.sampleStatus === "unavailable" || receipt) return;
    setError("");
    setSelectedIds((current) =>
      current.includes(item.work.id)
        ? current.filter((id) => id !== item.work.id)
        : current.length >= 30
          ? current
          : [...current, item.work.id],
    );
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!props.submissionEnabled || !props.accessKey) {
      setError("设计师预览不会提交请求，请从有效邀请链接测试访客流程。");
      return;
    }
    if (selectedItems.length === 0) {
      setError("请先从 Line Sheet 选择至少一件 Look。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/showroom/${encodeURIComponent(props.showroomSlug)}/requests`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accessKey: props.accessKey,
            ...form,
            neededFrom: form.neededFrom || null,
            neededUntil: form.neededUntil || null,
            items: selectedItems.map((item) => ({
              workId: item.work.id,
              note: itemNotes[item.work.id] || "",
            })),
          }),
        },
      );
      const payload = (await response.json()) as SubmissionReceipt & {
        error?: string;
      };
      if (!response.ok || !payload.referenceCode) {
        throw new Error(payload.error || "暂时无法提交 Pull Request。");
      }
      setReceipt(payload);
      requestAnimationFrame(() => {
        document
          .getElementById("showroom-response")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "暂时无法提交 Pull Request。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function scrollToResponse() {
    document
      .getElementById("showroom-response")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="showroom-look-grid">
        {props.items.map((item, index) => {
          const { assignment, work } = item;
          const selected = selectedIds.includes(work.id);
          const requestable = assignment.sampleStatus !== "unavailable";
          return (
            <article
              className={`showroom-look showroom-look--${(index % 5) + 1}${assignment.featured ? " is-featured" : ""}${selected ? " is-pulled" : ""}`}
              key={work.id}
            >
              <figure>
                <img
                  src={mediaUrl(work.imageKey)}
                  alt={work.altText}
                  loading={index > 2 ? "lazy" : undefined}
                />
                <span>
                  {work.lookNumber ||
                    `LOOK ${String(index + 1).padStart(2, "0")}`}
                </span>
                {assignment.featured && <strong>KEY LOOK</strong>}
                {selected && <b>PULL {selectedIds.indexOf(work.id) + 1}</b>}
              </figure>
              <div className="showroom-look-meta">
                <small>
                  {String(index + 1).padStart(2, "0")} /{" "}
                  {String(props.items.length).padStart(2, "0")}
                </small>
                <h3>{work.title}</h3>
                <p>
                  {assignment.note ||
                    work.description ||
                    "Selected for this private appointment."}
                </p>
                <div>
                  <span>
                    SAMPLE / {sampleStatusLabel(assignment.sampleStatus)}
                  </span>
                  <div className="showroom-look-actions">
                    {props.allowDownloads && (
                      <a
                        href={mediaUrl(work.imageKey)}
                        download={`${safeFilename(work.title)}.jpg`}
                      >
                        DOWNLOAD ↘
                      </a>
                    )}
                    <button
                      type="button"
                      className={selected ? "is-selected" : ""}
                      disabled={!requestable || Boolean(receipt)}
                      aria-pressed={selected}
                      onClick={() => toggleItem(item)}
                    >
                      {!requestable
                        ? "REFERENCE ONLY"
                        : selected
                          ? "REMOVE FROM PULL −"
                          : "ADD TO PULL +"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section
        className={`showroom-response${receipt ? " is-complete" : ""}`}
        id="showroom-response"
        aria-labelledby="showroom-response-title"
      >
        <header>
          <div>
            <span>03 / APPOINTMENT RESPONSE</span>
            <h2 id="showroom-response-title">
              BUILD YOUR<br />
              <i>PULL LIST.</i>
            </h2>
          </div>
          <p>
            Select the looks relevant to your project and send one professional
            request to the atelier. Availability remains subject to review; this
            is not an order or reservation.
          </p>
        </header>

        {receipt ? (
          <div className="showroom-response-receipt">
            <div>
              <span>REQUEST RECEIVED</span>
              <strong>{receipt.referenceCode}</strong>
              <small>
                {receipt.duplicate
                  ? "WE FOUND YOUR RECENT REQUEST"
                  : "STATUS / SUBMITTED"}
              </small>
            </div>
            <section>
              <span>PROJECT</span>
              <h3>{form.projectTitle}</h3>
              <p>
                The atelier will review dates, availability and logistics before
                confirming anything. Keep this reference for your correspondence.
              </p>
              <dl>
                <div>
                  <dt>LOOKS</dt>
                  <dd>{String(selectedItems.length).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>REQUESTER</dt>
                  <dd>{form.requesterName}</dd>
                </div>
                <div>
                  <dt>SHOWROOM</dt>
                  <dd>{props.showroomTitle}</dd>
                </div>
              </dl>
            </section>
          </div>
        ) : (
          <form className="showroom-response-form" onSubmit={submitRequest}>
            <aside>
              <div>
                <span>YOUR EDIT</span>
                <strong>{String(selectedItems.length).padStart(2, "0")}</strong>
                <small>SELECTED LOOKS</small>
              </div>
              {selectedItems.length === 0 ? (
                <p>Use “ADD TO PULL” on the Line Sheet to begin your edit.</p>
              ) : (
                <ol>
                  {selectedItems.map((item, index) => (
                    <li key={item.work.id}>
                      <img
                        src={mediaUrl(item.work.imageKey)}
                        alt=""
                        aria-hidden="true"
                      />
                      <div>
                        <span>
                          {String(index + 1).padStart(2, "0")} ·{" "}
                          {item.work.lookNumber || "LOOK"}
                        </span>
                        <strong>{item.work.title}</strong>
                        <input
                          value={itemNotes[item.work.id] || ""}
                          maxLength={500}
                          placeholder="Optional note: size, talent or styling"
                          aria-label={`Note for ${item.work.title}`}
                          onChange={(event) =>
                            setItemNotes((current) => ({
                              ...current,
                              [item.work.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.work.title}`}
                        onClick={() => toggleItem(item)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </aside>

            <div className="showroom-response-fields">
              <div className="showroom-response-field-grid">
                <label>
                  <span>NAME *</span>
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    autoComplete="name"
                    value={form.requesterName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        requesterName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>WORK EMAIL *</span>
                  <input
                    required
                    type="email"
                    maxLength={200}
                    autoComplete="email"
                    value={form.requesterEmail}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        requesterEmail: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>ORGANIZATION</span>
                  <input
                    maxLength={200}
                    autoComplete="organization"
                    value={form.organization}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        organization: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>ROLE *</span>
                  <select
                    required
                    value={form.requesterRole}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        requesterRole: event.target
                          .value as ShowroomRequestRole,
                      }))
                    }
                  >
                    <option value="">SELECT ROLE</option>
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="is-wide">
                  <span>PROJECT / PUBLICATION *</span>
                  <input
                    required
                    minLength={2}
                    maxLength={200}
                    value={form.projectTitle}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        projectTitle: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="is-wide">
                  <span>REQUEST PURPOSE *</span>
                  <select
                    required
                    value={form.purpose}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        purpose: event.target
                          .value as ShowroomRequestPurpose,
                      }))
                    }
                  >
                    <option value="">SELECT PURPOSE</option>
                    {purposes.map((purpose) => (
                      <option key={purpose.value} value={purpose.value}>
                        {purpose.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>NEEDED FROM</span>
                  <input
                    type="date"
                    value={form.neededFrom}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        neededFrom: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>RETURN BY</span>
                  <input
                    type="date"
                    min={form.neededFrom || undefined}
                    value={form.neededUntil}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        neededUntil: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="is-wide">
                  <span>DELIVERY / FITTING CITY</span>
                  <input
                    maxLength={160}
                    autoComplete="address-level2"
                    value={form.deliveryCity}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        deliveryCity: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="is-wide">
                  <span>PROJECT NOTES</span>
                  <textarea
                    rows={5}
                    maxLength={3000}
                    placeholder="Talent, sizing, shoot date, publication timing or special handling."
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label className="showroom-response-consent">
                <input
                  required
                  type="checkbox"
                  checked={form.consent}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      consent: event.target.checked,
                    }))
                  }
                />
                <span>
                  I confirm these details may be used by NÉRA ATELIER to review
                  and respond to this professional request.
                </span>
              </label>

              {error && (
                <p className="showroom-response-error" role="alert">
                  {error}
                </p>
              )}
              {!props.submissionEnabled && (
                <p className="showroom-response-preview">
                  DESIGNER PREVIEW / Submission is enabled only through a valid
                  invitation link.
                </p>
              )}
              <button
                className="showroom-response-submit"
                type="submit"
                disabled={
                  submitting ||
                  selectedItems.length === 0 ||
                  !props.submissionEnabled
                }
              >
                {submitting
                  ? "SENDING REQUEST…"
                  : `SEND ${String(selectedItems.length).padStart(2, "0")} LOOK REQUEST →`}
              </button>
            </div>
          </form>
        )}
      </section>

      {selectedItems.length > 0 && !receipt && (
        <div className="showroom-pull-tray" role="status">
          <div>
            <span>PULL LIST</span>
            <strong>{String(selectedItems.length).padStart(2, "0")}</strong>
            <small>LOOKS SELECTED</small>
          </div>
          <div aria-hidden="true">
            {selectedItems.slice(0, 4).map((item) => (
              <img
                key={item.work.id}
                src={mediaUrl(item.work.imageKey)}
                alt=""
              />
            ))}
            {selectedItems.length > 4 && (
              <span>+{selectedItems.length - 4}</span>
            )}
          </div>
          <button type="button" onClick={scrollToResponse}>
            COMPLETE REQUEST →
          </button>
        </div>
      )}
    </>
  );
}

function sampleStatusLabel(value: string) {
  if (value === "available") return "AVAILABLE";
  if (value === "unavailable") return "NOT AVAILABLE";
  return "ON REQUEST";
}

function mediaUrl(imageKey: string) {
  return `/api/media/${imageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function safeFilename(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "nera-look"
  );
}
