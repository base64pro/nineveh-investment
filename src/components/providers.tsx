"use client";

import { useState, type ReactNode } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { looksLikeSessionDenied } from "@/lib/supabase/query-errors";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => {
    let lastRedirectAt = 0; // كبح ارتداد: تحويل واحد كحدّ أقصى كلّ 5ث (يمنع الحلقات، ويُعاد التسليح بعدها)
    return new QueryClient({
      // م9.12 · معالج أخطاء مركزيّ: عند إشارة سقوط جلسة، نتحقّق **نهائيّاً** عبر getUser الموثوق (نداء شبكيّ)، فإن
      // انعدم المستخدم نعيد تشغيل الخادم (router.refresh) فيحوّل الوسيط إلى /login — لا نُخفي خروجاً حقيقيّاً. الأخطاء
      // الشبكيّة العابرة (مثل إجهاض تحديث الرمز عند التحديث القسريّ) لا تَعبُر هذه البوّابة ويعيدها TanStack تلقائيّاً.
      queryCache: new QueryCache({
        onError: (error) => {
          if (!looksLikeSessionDenied(error)) return;
          void (async () => {
            try {
              const { data } = await createClient().auth.getUser();
              if (!data.user && Date.now() - lastRedirectAt > 5000) {
                lastRedirectAt = Date.now();
                router.refresh();
              }
            } catch {
              /* تعذّر التحقّق (شبكة) — لا نحوّل؛ قد يكون عابراً */
            }
          })();
        },
      }),
      defaultOptions: {
        queries: {
          // البيانات لحظيّة عبر Realtime (يُبطل ويُعيد الجلب فوراً مهما كانت النضارة) — فنضارة قصيرة تكفي وتمنع
          // إعادة جلب عند كلّ تركيز نافذة/تبويب (وهو ما كان يُكثّر تسابق تحديث الرمز الخلفيّ). إعادة الجلب عند عودة
          // الشبكة تبقى مفعّلة (refetchOnReconnect الافتراضيّ) فتُغطّي إيقاظ الجهاز من السكون.
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    });
  });

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* تنبيهات عربية أنيقة وسط-علوية (§هـ.3.4 · §ز.2): كحلي + توهّج هولوكرامي + Readex + أيقونات ملوّنة */}
        <Toaster
          position="top-center"
          dir="rtl"
          closeButton
          expand
          gap={10}
          offset={20}
          duration={3500}
          toastOptions={{
            classNames: {
              toast:
                "!font-readex !gap-2.5 !rounded-2xl !border !border-[rgba(148,175,209,0.42)] !bg-[hsl(220_36%_16%_/_0.97)] !text-foreground !shadow-[0_22px_55px_-14px_rgba(0,0,0,0.78),0_0_26px_-10px_rgba(148,175,209,0.55)] !backdrop-blur-md",
              title: "!text-[13px] !font-bold !text-foreground",
              description: "!text-xs !text-muted-foreground",
              closeButton:
                "!border-[rgba(148,175,209,0.4)] !bg-card !text-muted-foreground hover:!bg-accent hover:!text-foreground",
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
