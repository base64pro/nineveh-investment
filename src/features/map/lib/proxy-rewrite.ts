// منطق وسيط MapTiler — معزول للاختبار (القاعدة 6: المفتاح لا يصل العميل أبداً).
// يُنتج عناوين مطلقة (MapLibre يرفض النسبية في sprite/glyphs/tiles).
export const MAPTILER_UPSTREAM = "https://api.maptiler.com";

function stripKey(url: string): string {
  const qi = url.indexOf("?");
  if (qi === -1) return url;
  const params = new URLSearchParams(url.slice(qi + 1));
  params.delete("key");
  const q = params.toString();
  return q ? `${url.slice(0, qi)}?${q}` : url.slice(0, qi);
}

/**
 * يحذف معامل key من عناوين MapTiler ثم يحوّلها إلى الوسيط المطلق.
 * @param origin أصل التطبيق (مثل http://localhost:3000) لإنتاج عناوين مطلقة.
 */
export function rewriteKeyless(body: string, origin: string): string {
  const proxyBase = `${origin}/api/maptiler`;
  return body
    .replace(/https:\/\/api\.maptiler\.com[^"\\]*/g, stripKey)
    .replaceAll(MAPTILER_UPSTREAM, proxyBase);
}
