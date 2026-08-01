import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleCommunications,
  type SampleCommunication,
} from "@/db/schema";
import type { SampleLoanWorkspace } from "@/lib/sample-loans";

export type { SampleCommunication } from "@/db/schema";

export const SAMPLE_COMMUNICATION_KINDS = [
  "confirmation",
  "dispatch",
  "delivery",
  "return_reminder",
  "overdue",
  "return_received",
  "exception",
  "custom",
] as const;

export const SAMPLE_COMMUNICATION_CHANNELS = [
  "email",
  "phone",
  "messaging",
  "in_person",
  "internal",
] as const;

export const SAMPLE_COMMUNICATION_DIRECTIONS = [
  "outbound",
  "inbound",
  "internal",
] as const;

export const SAMPLE_COMMUNICATION_STATUSES = [
  "draft",
  "logged",
  "acknowledged",
  "resolved",
] as const;

export type SampleCommunicationKind =
  (typeof SAMPLE_COMMUNICATION_KINDS)[number];
export type SampleCommunicationChannel =
  (typeof SAMPLE_COMMUNICATION_CHANNELS)[number];
export type SampleCommunicationDirection =
  (typeof SAMPLE_COMMUNICATION_DIRECTIONS)[number];
export type SampleCommunicationStatus =
  (typeof SAMPLE_COMMUNICATION_STATUSES)[number];

export type SampleCorrespondencePayload = {
  loans: SampleLoanWorkspace[];
  communications: SampleCommunication[];
};

export async function listAllSampleCommunications(limit = 5000) {
  const db = await getDb();
  return db
    .select()
    .from(sampleCommunications)
    .orderBy(
      desc(sampleCommunications.occurredAt),
      desc(sampleCommunications.createdAt),
    )
    .limit(limit);
}

export async function getSampleCommunication(id: string) {
  const db = await getDb();
  const [entry] = await db
    .select()
    .from(sampleCommunications)
    .where(eq(sampleCommunications.id, id))
    .limit(1);
  return entry ?? null;
}

export function sampleCorrespondenceToCsv(
  entries: SampleCommunication[],
  loans: SampleLoanWorkspace[],
) {
  const loanById = new Map(loans.map((workspace) => [workspace.loan.id, workspace]));
  const columns = [
    "loanCode",
    "requestReference",
    "project",
    "requester",
    "email",
    "organization",
    "loanStatus",
    "communicationKind",
    "channel",
    "direction",
    "communicationStatus",
    "recipientName",
    "recipientAddress",
    "subject",
    "body",
    "followUpAt",
    "occurredAt",
    "resolvedAt",
    "createdBy",
    "createdAt",
    "updatedAt",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];

  entries.forEach((entry) => {
    const workspace = loanById.get(entry.loanId);
    lines.push(
      [
        workspace?.loan.loanCode ?? "",
        workspace?.request.referenceCode ?? "",
        workspace?.request.projectTitle ?? "",
        workspace?.request.requesterName ?? "",
        workspace?.request.requesterEmail ?? "",
        workspace?.request.organization ?? "",
        workspace?.loan.status ?? "",
        entry.kind,
        entry.channel,
        entry.direction,
        entry.status,
        entry.recipientName,
        entry.recipientAddress,
        entry.subject,
        entry.body,
        entry.followUpAt,
        entry.occurredAt,
        entry.resolvedAt,
        entry.createdBy,
        entry.createdAt,
        entry.updatedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  });

  return `\ufeff${lines.join("\r\n")}`;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
