import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";
import ExhibitionDelivery from "../exhibition-delivery";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Exhibition Delivery — NÉRA ATELIER",
  description: "NÉRA ATELIER 展品出库与点交离馆工作台。",
};

export default async function ExhibitionDeliveryPage() {
  const user = await requireChatGPTUser("/studio/exhibition-delivery");

  if (!(await isAdminEmail(user.email))) {
    return (
      <main className="studio-shell studio-blocked">
        <Link className="studio-brand" href="/">NÉRA <span>ATELIER</span></Link>
        <div>
          <p className="studio-kicker">ACCESS / 权限</p>
          <h1>此账号没有<br />展品出库管理权限。</h1>
          <p>请使用已加入设计师名单的 ChatGPT 账号登录。</p>
          <a className="studio-primary" href={chatGPTSignOutPath("/studio/exhibition-delivery")}>切换账号 →</a>
        </div>
      </main>
    );
  }

  return <ExhibitionDelivery />;
}
