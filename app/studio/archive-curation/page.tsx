import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ArchiveCuration from "../archive-curation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Archive Curation Workspace — NÉRA ATELIER",
  description: "NÉRA ATELIER 馆藏策展与选辑组合工作台。",
};

export default async function ArchiveCurationPage() {
  const user = await requireChatGPTUser("/studio/archive-curation");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />馆藏策展工作台管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/archive-curation")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ArchiveCuration />;
}
