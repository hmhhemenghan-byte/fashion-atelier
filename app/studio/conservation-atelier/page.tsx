import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ConservationAtelier from "../conservation-atelier";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conservation Atelier — NÉRA ATELIER",
  description: "NÉRA ATELIER 状态评估与修复预防工作台。",
};

export default async function ConservationAtelierPage() {
  const user = await requireChatGPTUser("/studio/conservation-atelier");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />保存修复工作台管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/conservation-atelier")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ConservationAtelier />;
}
