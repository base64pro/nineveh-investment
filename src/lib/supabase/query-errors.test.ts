import { describe, expect, it } from "vitest";
import { looksLikeSessionDenied } from "./query-errors";

describe("looksLikeSessionDenied", () => {
  it("يَصدُق على سقوط الجلسة الفعليّ: منع صلاحيّة PostgREST (anon ضدّ دالّة authenticated)", () => {
    expect(looksLikeSessionDenied({ code: "42501", message: "permission denied for function dashboard_stats" })).toBe(true);
    expect(looksLikeSessionDenied({ status: 403 })).toBe(true);
    expect(looksLikeSessionDenied({ status: 401 })).toBe(true);
    expect(looksLikeSessionDenied({ code: "PGRST301", message: "JWT expired" })).toBe(true);
    expect(looksLikeSessionDenied(new Error("Invalid Refresh Token"))).toBe(true);
  });

  it("يَكذِب على الخطأ الشبكيّ العابر (إجهاض تحديث المهلّل عند التحديث القسريّ) — لا تحويل زائف", () => {
    expect(looksLikeSessionDenied(new TypeError("Failed to fetch"))).toBe(false);
    expect(looksLikeSessionDenied({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe(false);
    expect(looksLikeSessionDenied(new Error("NetworkError when attempting to fetch resource"))).toBe(false);
  });

  it("يَكذِب على خطأ بيانات عاديّ وعلى المدخلات الفارغة", () => {
    expect(looksLikeSessionDenied({ code: "PGRST116", message: "Results contain 0 rows" })).toBe(false);
    expect(looksLikeSessionDenied(null)).toBe(false);
    expect(looksLikeSessionDenied(undefined)).toBe(false);
    expect(looksLikeSessionDenied("boom")).toBe(false);
  });
});
