// ألوان الحالات الخمس (§هـ.3) لـdeck.gl: ملء شفّاف + حدّ أعمق + هالة توهّج خفيفة.
const HEX: Record<string, string> = {
  announced: "#C7A24E",
  "in-progress": "#5775A8",
  completed: "#5E977A",
  withdrawn: "#B5616A",
  assumed: "#8B6FB0",
};

function toRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgb(state: string | null | undefined): [number, number, number] {
  return toRgb(HEX[state ?? ""] ?? "#8896aa");
}

export type RGBA = [number, number, number, number];

export function fillRgba(state: string | null | undefined): RGBA {
  const [r, g, b] = rgb(state);
  return [r, g, b, 64];
}
export function lineRgba(state: string | null | undefined): RGBA {
  const [r, g, b] = rgb(state);
  return [r, g, b, 235];
}
export function glowRgba(state: string | null | undefined): RGBA {
  const [r, g, b] = rgb(state);
  return [r, g, b, 80];
}
