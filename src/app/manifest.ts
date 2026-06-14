import type { MetadataRoute } from "next";

// م8.2 · بيان PWA (تثبيت اختياري للجوال — إرشاد ناعم، لا حجب).
// display+orientation+أيقونات فقط؛ لا Service Worker ولا تخزين دون اتصال (التزاماً بـ§أ.2/§ب.4 «يعمل في المتصفّح»).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "نظام إدارة الاستثمار في نينوى",
    short_name: "استثمار نينوى",
    description: "نظام قيادة استثمارية لهيئة استثمار نينوى — خريطة تفاعلية وقرار مسند بالبيانات والقانون.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    background_color: "#070d18",
    theme_color: "#070d18",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
