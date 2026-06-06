// منطق وسيط MapTiler — معزول للاختبار (القاعدة 6: المفتاح لا يصل العميل أبداً).
export const MAPTILER_UPSTREAM = "https://api.maptiler.com";

/** يعيد كتابة عناوين JSON إلى الوسيط ويحذف أي معامل key. */
export function rewriteKeyless(body: string): string {
  return body
    .replaceAll(MAPTILER_UPSTREAM, "/api/maptiler")
    .replace(/\/api\/maptiler\/[^"\\]*/g, (url) => {
      const qi = url.indexOf("?");
      if (qi === -1) return url;
      const params = new URLSearchParams(url.slice(qi + 1));
      params.delete("key");
      const q = params.toString();
      return q ? `${url.slice(0, qi)}?${q}` : url.slice(0, qi);
    });
}
