import { describe, it, expect } from "vitest";
import {
  IMAGERY_PROVIDERS,
  buildImageryUrl,
  buildGoogleSessionUrl,
  buildGoogleTileUrl,
  buildAzureTileUrl,
  buildAirbusTileUrl,
  resolveUpstream,
} from "./imagery-proxy";

describe("buildImageryUrl — حقن المفتاح وترميز المسار", () => {
  it("يحقن token لـEsri ويحفظ ترتيب z/y/x", () => {
    const cfg = IMAGERY_PROVIDERS.esri!;
    const u = buildImageryUrl(cfg.upstream, ["tile", "5", "12", "9"], new URLSearchParams(), cfg.param, "K");
    expect(u).toContain("/MapServer/tile/5/12/9");
    expect(u).toContain("token=K");
  });

  it("يحفظ @ في المسار بلا ترميز %40", () => {
    const u = buildImageryUrl("https://example.com", ["a", "12@2x.jpg"], new URLSearchParams(), undefined);
    expect(u).toContain("/a/12@2x.jpg");
    expect(u).not.toContain("%40");
  });

  it("بلا مفتاح ⇒ لا يضيف معامل مفتاح (نقطة التقييم)", () => {
    const cfg = IMAGERY_PROVIDERS.esri!;
    const u = buildImageryUrl(cfg.evalUpstream!, ["tile", "5", "12", "9"], new URLSearchParams(), cfg.param);
    expect(u).not.toContain("token=");
  });

  it("المفتاح الحقيقي يفوز على قيمة token الواردة من العميل", () => {
    const cfg = IMAGERY_PROVIDERS.esri!;
    const u = buildImageryUrl(cfg.upstream, ["tile"], new URLSearchParams("token=EVIL"), cfg.param, "REAL");
    expect(u).toContain("token=REAL");
    expect(u).not.toContain("EVIL");
  });
});

describe("resolveUpstream — اختيار النقطة حسب المفتاح والبيئة", () => {
  const cfg = IMAGERY_PROVIDERS.esri!;

  it("المفتاح موجود ⇒ النقطة الإنتاجية مع المفتاح", () => {
    expect(resolveUpstream(cfg, "K", true)).toEqual({ base: cfg.upstream, token: "K" });
    expect(resolveUpstream(cfg, "K", false)).toEqual({ base: cfg.upstream, token: "K" });
  });

  it("بلا مفتاح في التطوير ⇒ نقطة التقييم بلا مفتاح", () => {
    expect(resolveUpstream(cfg, undefined, false)).toEqual({ base: cfg.evalUpstream });
  });

  it("بلا مفتاح في الإنتاج ⇒ خطأ (يفرض ضبط المفتاح)", () => {
    const r = resolveUpstream(cfg, undefined, true);
    expect(r).toHaveProperty("error");
  });

  it("مزوّد بلا بديل تقييم بلا مفتاح ⇒ خطأ حتى في التطوير", () => {
    const noEval = { envKey: "X_KEY", param: "k", upstream: "https://x" };
    const r = resolveUpstream(noEval, undefined, false);
    expect(r).toHaveProperty("error");
  });
});

describe("Google Map Tiles — بناء العناوين", () => {
  it("عنوان الجلسة يحمل المفتاح", () => {
    const u = buildGoogleSessionUrl("K");
    expect(u).toContain("/v1/createSession");
    expect(u).toContain("key=K");
  });

  it("عنوان البلاطة z/x/y مع الجلسة والمفتاح", () => {
    const u = buildGoogleTileUrl("14", "9123", "6543", "SESS", "K");
    expect(u).toContain("/v1/2dtiles/14/9123/6543");
    expect(u).toContain("session=SESS");
    expect(u).toContain("key=K");
  });
});

describe("Azure / Airbus — بناء العناوين", () => {
  it("Azure: z/x/y عبر معاملات الاستعلام + subscription-key + tilesetId", () => {
    const u = buildAzureTileUrl("14", "9123", "6543", "K");
    expect(u).toContain("zoom=14");
    expect(u).toContain("x=9123");
    expect(u).toContain("y=6543");
    expect(u).toContain("tilesetId=microsoft.imagery");
    expect(u).toContain("subscription-key=K");
  });

  it("Airbus: يعوّض {z}/{x}/{y} في قالب التجربة", () => {
    const t = "https://access.example/items/ID/wmts/.../3857/{z}/{x}/{y}.png";
    const u = buildAirbusTileUrl(t, "14", "9123", "6543");
    expect(u).toBe("https://access.example/items/ID/wmts/.../3857/14/9123/6543.png");
    expect(u).not.toContain("{z}");
  });
});
