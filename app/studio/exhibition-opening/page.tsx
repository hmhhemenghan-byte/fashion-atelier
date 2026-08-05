import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ExhibitionOpening from "../exhibition-opening";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Exhibition Opening Gate — NÉRA ATELIER",
  description: "NÉRA ATELIER 幕集开幕放行与授权。",
};

export default async function ExhibitionOpeningPage() {
  const user = await requireChatGPTUser("/studio/exhibition-opening");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />开幕放行管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/exhibition-opening")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ExhibitionOpening />;
}
