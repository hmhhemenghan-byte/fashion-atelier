import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import Link from "next/link";
import StudioClient from "./studio-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "作品管理 — NÉRA ATELIER",
  description: "上传、预览并发布 NÉRA ATELIER 时装作品。",
};

export default async function StudioPage() {
  const user = await requireChatGPTUser("/studio");
  const signOutToStudio = await chatGPTSignOutPath("/studio");
  const signOutToHome = await chatGPTSignOutPath("/");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />作品管理权限。</h1>
          <p>请使用已加入设计师名单的授权账号登录。</p>
          <a className="studio-primary" href={signOutToStudio}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div className="studio-user">
          <span>DESIGNER ACCESS</span>
          <strong>{user.displayName}</strong>
          <a href={signOutToHome}>退出</a>
        </div>
      </header>
      <StudioClient />
    </main>
  );
}
