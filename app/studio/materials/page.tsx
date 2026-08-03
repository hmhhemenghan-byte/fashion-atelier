import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import MaterialRoomClient from "./materials-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Material Room & Look BOM — NÉRA ATELIER",
  description: "NÉRA ATELIER 材料室与 Look BOM 单件用料表。",
};

export default async function MaterialRoomPage() {
  const user = await requireChatGPTUser("/studio/materials");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />材料室管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/materials")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <MaterialRoomClient />;
}
