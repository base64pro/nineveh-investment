import { describe, it, expect } from "vitest";
import { generateModel, type ModelKind } from "./index";

const KINDS: ModelKind[] = ["tower", "mall", "hotel"];

describe("building · generateModel", () => {
  it("يولّد الشبكات الستّ المسمّاة + ارتفاعاً موجباً لكل نوع", () => {
    for (const k of KINDS) {
      const m = generateModel(k, 40, 30);
      expect(m.body.positions.length).toBeGreaterThan(0);
      expect(m.glassA.positions).toBeInstanceOf(Float32Array);
      expect(m.accent.positions).toBeInstanceOf(Float32Array);
      expect(m.height).toBeGreaterThan(0);
    }
  });

  it("حتميّ: نداءان بنفس الوسائط ⇒ هندسة متطابقة (لا Math.random)", () => {
    for (const k of KINDS) {
      const a = generateModel(k, 44, 28, 60);
      const b = generateModel(k, 44, 28, 60);
      expect(Array.from(a.body.positions)).toEqual(Array.from(b.body.positions));
      expect(Array.from(a.accent.positions)).toEqual(Array.from(b.accent.positions));
      expect((a.extras ?? []).length).toBe((b.extras ?? []).length);
    }
  });

  it("إحداثيّات منتهية (بلا NaN/Infinity) وميزانيّة مضلّعات معقولة (أداء) لكلّ نوع", () => {
    const allFinite = (arr: Float32Array) => arr.every((v) => Number.isFinite(v));
    for (const k of KINDS) {
      const m = generateModel(k, 130, 105); // أكبر بصمة (أعلى كثافة)
      const meshes = [m.body, m.glassA, m.glassB, m.winCool, m.winWarm, m.accent, ...(m.extras ?? []).map((e) => e.mesh)];
      let verts = 0;
      for (const me of meshes) {
        expect(allFinite(me.positions)).toBe(true);
        expect(allFinite(me.normals)).toBe(true);
        verts += me.positions.length / 3;
      }
      expect(verts).toBeLessThan(220_000); // حارس انفجار هندسيّ (أداء) — لا حدّ جودة
    }
  });
});
