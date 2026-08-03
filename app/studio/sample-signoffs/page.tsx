import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import FinalSampleGateClient from "./sample-signoffs-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Final Sample Gate — NÉRA ATELIER",
  description: "NÉRA ATELIER 封样签核台与 NERA-SEAL 封样记录。",
};

export default async function FinalSampleGatePage() {
  const user = await requireChatGPTUser("/studio/sample-signoffs");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />封样签核台管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/sample-signoffs")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <FinalSampleGateClient />;
}
