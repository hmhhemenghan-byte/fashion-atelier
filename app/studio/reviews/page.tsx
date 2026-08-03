import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import AtelierReviewBoardClient from "./reviews-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Atelier Review Board — NÉRA ATELIER",
  description: "NÉRA ATELIER 设计评审台与修改任务追踪。",
};

export default async function AtelierReviewBoardPage() {
  const user = await requireChatGPTUser("/studio/reviews");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />设计评审台管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/reviews")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <AtelierReviewBoardClient />;
}
