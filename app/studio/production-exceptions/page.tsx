import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ProductionChangeControlClient from "./production-exceptions-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Production Change Control — NÉRA ATELIER",
  description: "NÉRA ATELIER 生产偏差控制与变更追踪。",
};

export default async function ProductionChangeControlPage() {
  const user = await requireChatGPTUser("/studio/production-exceptions");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />生产变更控制管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/production-exceptions")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ProductionChangeControlClient />;
}
