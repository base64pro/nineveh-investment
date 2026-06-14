import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// الخطّ العربي Readex Pro (§هـ.3) — متغيّر CSS لاستخدامه في Tailwind.
// preload:false — يزيل روابط preload للـwoff2 (كانت تُحذّر «preloaded but not used»)؛ swap يضمن سلاسة العرض.
const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "نظام إدارة الاستثمار في نينوى",
  description:
    "نظام قيادة استثمارية لهيئة استثمار نينوى — خريطة تفاعلية وقرار مسند بالبيانات والقانون.",
  // م8.2 · تطبيق ويب على iOS (تثبيت اختياري): اسم قصير + شريط حالة شفّاف يمدّ المحتوى ملء الشاشة
  // (الإزاحة الآمنة تُعالَج بـ var(--sat) على الهيدبار). manifest.ts يُربط تلقائياً في App Router.
  appleWebApp: {
    capable: true,
    title: "استثمار نينوى",
    statusBarStyle: "black-translucent",
  },
};

// ثبات صارم على الجوال (طلب معتمد): منع تكبير المتصفّح وتكبير تركيز الإدخال على iOS تماماً —
// خريطة MapLibre تُدير تكبيرها داخلياً فلا يتأثّر. viewport-fit=cover لاحترام حواف iPhone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#070d18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // العربية + RTL إلزامية (§ح.3 · §و.4).
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${readex.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
