import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import FittingRoomClient from "./fittings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fitting Room — NÉRA ATELIER",
  description: "NÉRA ATELIER 试身审版室与版型问题追踪。",
};

export default async function FittingRoomPage() {
  const user = await requireChatGPTUser("/studio/fittings");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />试身审版室管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/fittings")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <FittingRoomClient />;
}
