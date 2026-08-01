import { listPublishedWorks, mediaUrl } from "@/lib/works";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await listPublishedWorks();
    return Response.json({
      works: rows.map((work) => ({ ...work, imageUrl: mediaUrl(work.imageKey) })),
    });
  } catch {
    return Response.json({ works: [] });
  }
}
