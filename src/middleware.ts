import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// يطبَّق على مسارات الصفحات (حماية + إعادة توجيه). مسارات api تحمي نفسها (hasSession).
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|apple-icon|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
