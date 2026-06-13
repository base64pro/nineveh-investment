import { describe, expect, it } from "vitest";
import { usernameToEmail } from "./username";

describe("usernameToEmail", () => {
  it("اسم بسيط ← يُلحق النطاق الداخلي", () => {
    expect(usernameToEmail("viewer1")).toBe("viewer1@nineveh.local");
  });
  it("بريد كامل ← كما هو (بحروف صغيرة)", () => {
    expect(usernameToEmail("Admin@Gmail.com")).toBe("admin@gmail.com");
  });
  it("مسافات تُقلَّم", () => {
    expect(usernameToEmail("  user2  ")).toBe("user2@nineveh.local");
  });
  it("فارغ ← فارغ", () => {
    expect(usernameToEmail("   ")).toBe("");
  });
});
