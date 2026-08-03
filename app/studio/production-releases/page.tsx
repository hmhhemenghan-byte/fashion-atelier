import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ProductionReleaseDeskClient from "./production-releases-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Production Release Desk — NÉRA ATELIER",
  description: "NÉRA ATELIER 生产放行台与 NERA-GO 授权。",
};

export default async function ProductionReleaseDeskPage() {
  const user = await requireChatGPTUser("/studio/production-releases");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />生产放行台管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/production-releases")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ProductionReleaseDeskClient />;
}
