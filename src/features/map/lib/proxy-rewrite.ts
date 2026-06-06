// منطق وسيط MapTiler — معزول للاختبار (القاعدة 6: المفتاح لا يصل العميل أبداً).
export const MAPTILER_UPSTREAM = "https://api.maptiler.com";

function stripKey(url: string): string {
  const qi = url.indexOf("?");
  if (qi === -1) return url;
  const params = new URLSearchParams(url.slice(qi + 1));
  params.delete("key");
  const q = params.toString();
  return q ? `${url.slice(0, qi)}?${q}` : url.slice(0, qi);
}

/** يحذف المفتاح من عناوين JSON ويحوّل النطاق إلى مسار الوسيط (العميل يحوّلها مطلقة). */
export function rewriteKeyless(body: string): string {
  return body
    .replace(/https:\/\/api\.maptiler\.com[^"\\]*/g, stripKey)
    .replaceAll(MAPTILER_UPSTREAM, "/api/maptiler");
}

/**
 * يبني عنوان MapTiler الأعلى مع حقن المفتاح.
 * new URL يحفظ المحارف الصالحة في المسار (مثل @ في sprite@2x) ويرمّز المسافات فقط
 * — بخلاف encodeURIComponent الذي يرمّز @ فيكسر مسار الـsprite.
 */
export function buildUpstreamUrl(
  path: string[],
  incoming: URLSearchParams,
  key: string,
): string {
  const url = new URL(`${MAPTILER_UPSTREAM}/${path.join("/")}`);
  incoming.forEach((value, name) => url.searchParams.set(name, value));
  url.searchParams.set("key", key);
  return url.toString();
}
