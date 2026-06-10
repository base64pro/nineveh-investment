// تطبيق إعدادات العرض على المستند (مشترك بين اللوحة والمطبّق).
const FONT_PX: Record<string, string> = { sm: "15px", md: "16px", lg: "17.5px" };

export function applyFont(scale: string): void {
  if (typeof document !== "undefined") document.documentElement.style.fontSize = FONT_PX[scale] ?? FONT_PX.md!;
}
