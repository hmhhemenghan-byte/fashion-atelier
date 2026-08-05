import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ExhibitionInterpretation from "../exhibition-interpretation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Exhibition Interpretation — NÉRA ATELIER",
  description: "NÉRA ATELIER 展陈阐释与展项说明文本。",
};

export default async function ExhibitionInterpretationPage() {
  const user = await requireChatGPTUser("/studio/exhibition-interpretation");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />展陈阐释管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/exhibition-interpretation")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ExhibitionInterpretation />;
}
