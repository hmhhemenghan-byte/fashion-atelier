import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ExhibitionReadiness from "../exhibition-readiness";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Exhibition Readiness — NÉRA ATELIER",
  description: "NÉRA ATELIER 展前准备度与展出方案控制台。",
};

export default async function ExhibitionReadinessPage() {
  const user = await requireChatGPTUser("/studio/exhibition-readiness");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />展前准备度管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/exhibition-readiness")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ExhibitionReadiness />;
}
