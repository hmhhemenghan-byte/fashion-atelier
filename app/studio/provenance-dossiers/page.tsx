import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ProvenanceDossier from "../provenance-dossier";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provenance Dossier Publishing — NÉRA ATELIER",
  description: "NÉRA ATELIER 权威出处卷宗发布与公信度管理。",
};

export default async function ProvenanceDossierPage() {
  const user = await requireChatGPTUser("/studio/provenance-dossiers");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />出处卷宗管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/provenance-dossiers")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ProvenanceDossier />;
}
