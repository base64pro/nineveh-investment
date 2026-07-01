import { describe, it, expect } from "vitest";
import { GOOGLE_TILES_API, buildGoogleSessionUrl, buildGoogleTileUrl } from "./imagery-proxy";

describe("Google Map Tiles — بناء العناوين", () => {
  it("ثابت الـAPI صحيح", () => {
    expect(GOOGLE_TILES_API).toBe("https://tile.googleapis.com/v1");
  });

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

  it("المفتاح الحقيقي لا يتسرّب في المسار (معامل استعلام فقط)", () => {
    const u = buildGoogleTileUrl("3", "4", "5", "S", "SECRET");
    expect(u.startsWith("https://tile.googleapis.com/v1/2dtiles/3/4/5?")).toBe(true);
  });
});
