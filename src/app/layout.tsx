import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// الخطّ العربي Readex Pro (§هـ.3) — متغيّر CSS لاستخدامه في Tailwind.
const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "نظام إدارة الاستثمار في نينوى",
  description: "نظام قيادة استثمارية لهيئة استثمار نينوى — خريطة تفاعلية وقرار مسند بالبيانات والقانون.",
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
