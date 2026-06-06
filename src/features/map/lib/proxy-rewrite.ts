// منطق وسيط MapTiler — معزول للاختبار (القاعدة 6: المفتاح لا يصل العميل أبداً).
// يحذف المفتاح ويحوّل النطاق إلى مسار الوسيط؛ العميل يحوّلها إلى مطلقة (loadStyle).
export const MAPTILER_UPSTREAM = "https://api.maptiler.com";

function stripKey(url: string): string {
  const qi = url.indexOf("?");
  if (qi === -1) return url;
  const params = new URLSearchParams(url.slice(qi + 1));
  params.delete("key");
  const q = params.toString();
  return q ? `${url.slice(0, qi)}?${q}` : url.slice(0, qi);
}

export function rewriteKeyless(body: string): string {
  return body
    .replace(/https:\/\/api\.maptiler\.com[^"\\]*/g, stripKey)
    .replaceAll(MAPTILER_UPSTREAM, "/api/maptiler");
}
