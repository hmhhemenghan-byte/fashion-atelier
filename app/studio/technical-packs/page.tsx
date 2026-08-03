import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import TechnicalAtelierClient from "./technical-packs-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Technical Atelier — NÉRA ATELIER",
  description: "NÉRA ATELIER 技术工艺包与尺寸规格管理。",
};

export default async function TechnicalAtelierPage() {
  const user = await requireChatGPTUser("/studio/technical-packs");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />技术工艺室管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/technical-packs")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <TechnicalAtelierClient />;
}
