import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ExhibitionWatch from "../exhibition-watch";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Exhibition Watch — NÉRA ATELIER",
  description: "NÉRA ATELIER 展期巡查与实时监测控制台。",
};

export default async function ExhibitionWatchPage() {
  const user = await requireChatGPTUser("/studio/exhibition-watch");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />展期巡查管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/exhibition-watch")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ExhibitionWatch />;
}
