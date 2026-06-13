// تطبيق إعدادات العرض على المستند (مشترك بين اللوحة والمطبّق).
// الكثافة «مدمج» تقلّص جذر القياس 8% — تباعد Tailwind كله rem فيتكثّف فعلياً مع النص.
const FONT_PX: Record<string, number> = { sm: 15, md: 16, lg: 17.5 };

export function applyDisplay(fontScale: string, density: string): void {
  if (typeof document === "undefined") return;
  const base = FONT_PX[fontScale] ?? FONT_PX.md!;
  const factor = density === "compact" ? 0.92 : 1;
  document.documentElement.style.fontSize = `${(base * factor).toFixed(2)}px`;
}
