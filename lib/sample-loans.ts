import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleLoanItems,
  sampleLoans,
  showroomRequests,
  showrooms,
  type SampleLoan,
  type SampleLoanItem,
} from "@/db/schema";

export const SAMPLE_LOAN_STATUSES = [
  "preparing",
  "ready",
  "dispatched",
  "delivered",
  "in_use",
  "return_due",
  "return_in_transit",
  "returned",
  "closed",
  "cancelled",
] as const;

export const SAMPLE_LOAN_ITEM_STATUSES = [
  "reserved",
  "packing",
  "dispatched",
  "with_recipient",
  "returning",
  "returned",
  "unavailable",
  "damaged",
  "lost",
] as const;

export const SAMPLE_CONDITIONS = [
  "not_checked",
  "excellent",
  "good",
  "worn",
  "damaged",
] as const;

export type SampleLoanStatus = (typeof SAMPLE_LOAN_STATUSES)[number];
export type SampleLoanItemStatus =
  (typeof SAMPLE_LOAN_ITEM_STATUSES)[number];
export type SampleCondition = (typeof SAMPLE_CONDITIONS)[number];

export type SampleLoanWorkspace = {
  loan: SampleLoan;
  request: {
    id: string;
    referenceCode: string;
    requesterName: string;
    requesterEmail: string;
    organization: string;
    requesterRole: string;
    purpose: string;
    projectTitle: string;
    neededFrom: string | null;
    neededUntil: string | null;
    deliveryCity: string;
  };
  showroom: {
    id: string;
    slug: string;
    title: string;
  };
  items: SampleLoanItem[];
};

export async function listAllSampleLoans(limit = 1000) {
  const db = await getDb();
  return db
    .select()
    .from(sampleLoans)
    .orderBy(desc(sampleLoans.createdAt))
    .limit(limit);
}

export async function listAllSampleLoanItems() {
  const db = await getDb();
  return db
    .select()
    .from(sampleLoanItems)
    .orderBy(
      asc(sampleLoanItems.loanId),
      asc(sampleLoanItems.sortOrder),
      asc(sampleLoanItems.createdAt),
    );
}

export async function listSampleLoanWorkspaces(limit = 250) {
  const db = await getDb();
  const rows = await db
    .select({
      loan: sampleLoans,
      request: {
        id: showroomRequests.id,
        referenceCode: showroomRequests.referenceCode,
        requesterName: showroomRequests.requesterName,
        requesterEmail: showroomRequests.requesterEmail,
        organization: showroomRequests.organization,
        requesterRole: showroomRequests.requesterRole,
        purpose: showroomRequests.purpose,
        projectTitle: showroomRequests.projectTitle,
        neededFrom: showroomRequests.neededFrom,
        neededUntil: showroomRequests.neededUntil,
        deliveryCity: showroomRequests.deliveryCity,
      },
      showroom: {
        id: showrooms.id,
        slug: showrooms.slug,
        title: showrooms.title,
      },
    })
    .from(sampleLoans)
    .innerJoin(
      showroomRequests,
      eq(sampleLoans.requestId, showroomRequests.id),
    )
    .innerJoin(showrooms, eq(showroomRequests.showroomId, showrooms.id))
    .orderBy(desc(sampleLoans.updatedAt), desc(sampleLoans.createdAt))
    .limit(limit);

  if (rows.length === 0) return [] satisfies SampleLoanWorkspace[];

  const items = await db
    .select()
    .from(sampleLoanItems)
    .where(
      inArray(
        sampleLoanItems.loanId,
        rows.map((row) => row.loan.id),
      ),
    )
    .orderBy(
      asc(sampleLoanItems.loanId),
      asc(sampleLoanItems.sortOrder),
    );
  const itemsByLoan = new Map<string, SampleLoanItem[]>();
  items.forEach((item) => {
    const current = itemsByLoan.get(item.loanId) ?? [];
    current.push(item);
    itemsByLoan.set(item.loanId, current);
  });

  return rows.map((row) => ({
    ...row,
    items: itemsByLoan.get(row.loan.id) ?? [],
  })) satisfies SampleLoanWorkspace[];
}

export async function getSampleLoanWorkspace(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      loan: sampleLoans,
      request: {
        id: showroomRequests.id,
        referenceCode: showroomRequests.referenceCode,
        requesterName: showroomRequests.requesterName,
        requesterEmail: showroomRequests.requesterEmail,
        organization: showroomRequests.organization,
        requesterRole: showroomRequests.requesterRole,
        purpose: showroomRequests.purpose,
        projectTitle: showroomRequests.projectTitle,
        neededFrom: showroomRequests.neededFrom,
        neededUntil: showroomRequests.neededUntil,
        deliveryCity: showroomRequests.deliveryCity,
      },
      showroom: {
        id: showrooms.id,
        slug: showrooms.slug,
        title: showrooms.title,
      },
    })
    .from(sampleLoans)
    .innerJoin(
      showroomRequests,
      eq(sampleLoans.requestId, showroomRequests.id),
    )
    .innerJoin(showrooms, eq(showroomRequests.showroomId, showrooms.id))
    .where(eq(sampleLoans.id, id))
    .limit(1);
  if (!row) return null;

  const items = await db
    .select()
    .from(sampleLoanItems)
    .where(eq(sampleLoanItems.loanId, id))
    .orderBy(asc(sampleLoanItems.sortOrder));
  return { ...row, items } satisfies SampleLoanWorkspace;
}

export function sampleLoansToCsv(workspaces: SampleLoanWorkspace[]) {
  const columns = [
    "loanCode",
    "loanStatus",
    "requestReference",
    "project",
    "requester",
    "email",
    "organization",
    "showroom",
    "destinationCity",
    "deliveryAddress",
    "contactPhone",
    "outboundCarrier",
    "outboundTracking",
    "outboundSentAt",
    "expectedReturnAt",
    "returnCarrier",
    "returnTracking",
    "returnReceivedAt",
    "lookNumber",
    "lookTitle",
    "sampleCode",
    "size",
    "itemStatus",
    "outboundCondition",
    "returnCondition",
    "conditionNotes",
    "logisticsNotes",
  ] as const;
  const lines = [columns.map(csvCell).join(",")];

  workspaces.forEach(({ loan, request, showroom, items }) => {
    const detailRows = items.length > 0 ? items : [null];
    detailRows.forEach((item) => {
      lines.push(
        [
          loan.loanCode,
          loan.status,
          request.referenceCode,
          request.projectTitle,
          request.requesterName,
          request.requesterEmail,
          request.organization,
          showroom.title,
          request.deliveryCity,
          loan.deliveryAddress,
          loan.contactPhone,
          loan.outboundCarrier,
          loan.outboundTracking,
          loan.outboundSentAt,
          loan.expectedReturnAt,
          loan.returnCarrier,
          loan.returnTracking,
          loan.returnReceivedAt,
          item?.lookNumber ?? "",
          item?.workTitle ?? "",
          item?.sampleCode ?? "",
          item?.sizeLabel ?? "",
          item?.status ?? "",
          item?.outboundCondition ?? "",
          item?.returnCondition ?? "",
          item?.conditionNotes ?? "",
          loan.logisticsNotes,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });

  return `\ufeff${lines.join("\r\n")}`;
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
