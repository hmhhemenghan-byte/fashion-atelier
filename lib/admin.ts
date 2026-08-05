import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { isAdminEmail } from "@/lib/runtime";

export type AdminCheck =
  | { user: ChatGPTUser; response: null }
  | { user: null; response: Response };

export async function requireApiAdmin(): Promise<AdminCheck> {
  const user = await getChatGPTUser();
  if (!user) {
    return {
      user: null,
      response: Response.json(
        { error: "请先通过站点身份验证登录。" },
        { status: 401 },
      ),
    };
  }

  if (!(await isAdminEmail(user.email))) {
    return {
      user: null,
      response: Response.json(
        { error: "当前账号没有作品管理权限。" },
        { status: 403 },
      ),
    };
  }

  return { user, response: null };
}

export function rejectCrossOriginWrite(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  if (origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}
