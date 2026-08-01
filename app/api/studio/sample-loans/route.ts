import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  sampleLoanItems,
  sampleLoans,
  type NewSampleLoan,
  type NewSampleLoanItem,
} from "@/db/schema";
import { rejectCrossOriginWrite, requireApiAdmin } from "@/lib/admin";
import {
  getSampleLoanWorkspace,
  listSampleLoanWorkspaces,
  sampleLoansToCsv,
} from "@/lib/sample-loans";
import {
  getShowroomRequestWorkspace,
  listShowroomRequestWorkspaces,
} from "@/lib/showroom-requests";

export const dynamic = "force-dynamic";

type CreatePayload = { requestId?: string };

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const [loans, requests] = await Promise.all([
      listSampleLoanWorkspaces(),
      listShowroomRequestWorkspaces(),
    ]);
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const date = new Date().toISOString().slice(0, 10);
      return new Response(sampleLoansToCsv(loans), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nera-sample-loans-${date}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }

    const activeRequestIds = new Set(
      loans.map((workspace) => workspace.loan.requestId),
    );
    return Response.json(
      {
        loans,
        eligibleRequests: requests.filter(
          (workspace) =>
            workspace.request.status === "approved" &&
            !activeRequestIds.has(workspace.request.id),
        ),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return loanError(error, "无法读取样衣借调台账，请稍后重试。");
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginWrite(request);
  if (originError) return originError;

  const auth = await requireApiAdmin();
  if (auth.response) return auth.response;

  try {
    const payload = (await request.json()) as CreatePayload;
    const requestId = cleanText(payload.requestId, 120);
    if (!requestId) {
      return Response.json(
        { error: "请选择一条已批准的 Pull Request。" },
        { status: 400 },
      );
    }

    const approved = await getShowroomRequestWorkspace(requestId);
    if (!approved) {
      return Response.json(
        { error: "Pull Request 不存在。" },
        { status: 404 },
      );
    }
    if (approved.request.status !== "approved") {
      return Response.json(
        { error: "只有“已确认”的 Pull Request 才能建立借调单。" },
        { status: 409 },
      );
    }
    if (approved.items.length === 0) {
      return Response.json(
        { error: "该请求没有可建立借调单的 Look。" },
        { status: 409 },
      );
    }

    const db = await getDb();
    const [existing] = await db
      .select({ id: sampleLoans.id })
      .from(sampleLoans)
      .where(eq(sampleLoans.requestId, requestId))
      .limit(1);
    if (existing) {
      return Response.json(
        {
          error: "该请求已经建立借调单。",
          loan: await getSampleLoanWorkspace(existing.id),
        },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const loanId = crypto.randomUUID();
    const values: NewSampleLoan = {
      id: loanId,
      requestId,
      loanCode: createLoanCode(now),
      status: "preparing",
      expectedReturnAt: approved.request.neededUntil,
      createdBy: auth.user.email,
      createdAt: now,
      updatedAt: now,
    };
    const items: NewSampleLoanItem[] = approved.items.map((item, index) => ({
      id: crypto.randomUUID(),
      loanId,
      requestItemId: item.id,
      workId: item.workId,
      workTitle: item.workTitle,
      lookNumber: item.lookNumber,
      imageKey: item.imageKey,
      status: "reserved",
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    }));

    await db.batch([
      db.insert(sampleLoans).values(values),
      db.insert(sampleLoanItems).values(items),
    ]);

    return Response.json(
      { loan: await getSampleLoanWorkspace(loanId) },
      { status: 201 },
    );
  } catch (error) {
    return loanError(error, "建立样衣借调单失败，请稍后重试。");
  }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function createLoanCode(date: string) {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  return `LOAN-${date.slice(2, 10).replaceAll("-", "")}-${suffix}`;
}

function loanError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  return Response.json(
    {
      error: message.includes("no such table")
        ? "样衣借调数据库尚未初始化，请完成新版部署后再试。"
        : message.includes("UNIQUE")
          ? "该请求已经建立借调单，请刷新台账。"
          : fallback,
    },
    { status: 500 },
  );
}
