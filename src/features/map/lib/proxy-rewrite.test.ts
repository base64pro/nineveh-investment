import { describe, it, expect } from "vitest";
import { rewriteKeyless } from "./proxy-rewrite";

const ORIGIN = "http://localhost:3000";

describe("وسيط MapTiler — منع تسرّب المفتاح + عناوين مطلقة (القاعدة 6)", () => {
  it("يحوّل إلى عناوين الوسيط المطلقة ويحذف المفتاح", () => {
    const input = JSON.stringify({
      sources: { src: { url: "https://api.maptiler.com/tiles/v3/tiles.json?key=SECRET" } },
      glyphs: "https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=SECRET",
      sprite: "https://api.maptiler.com/maps/streets-v2-dark/sprite?key=SECRET",
    });
    const out = rewriteKeyless(input, ORIGIN);
    expect(out).not.toContain("SECRET");
    expect(out).not.toContain("api.maptiler.com");
    expect(out).toContain(`${ORIGIN}/api/maptiler/tiles/v3/tiles.json`);
    expect(out).toContain(`${ORIGIN}/api/maptiler/fonts/{fontstack}/{range}.pbf`);
    expect(out).toContain(`${ORIGIN}/api/maptiler/maps/streets-v2-dark/sprite`);
  });

  it("يحذف key ويحفظ بقيّة المعاملات", () => {
    const out = rewriteKeyless('"https://api.maptiler.com/x?foo=1&key=SECRET&bar=2"', ORIGIN);
    expect(out).not.toContain("SECRET");
    expect(out).toContain("foo=1");
    expect(out).toContain("bar=2");
  });

  it("العناوين بلا معاملات تصبح مطلقة كما هي", () => {
    const out = rewriteKeyless('"https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf"', ORIGIN);
    expect(out).toBe(`"${ORIGIN}/api/maptiler/tiles/v3/{z}/{x}/{y}.pbf"`);
  });
});
