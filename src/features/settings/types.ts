// أنواع الإعدادات — منفصلة عن "use server".
export interface AppSettings {
  theme: string; // light | dark | system
  density: string; // comfortable | compact
  font_scale: string; // sm | md | lg
  default_base: string; // dark | light | satellite
  start_layers: Record<string, boolean>;
  web_search_enabled: boolean;
  ai_model: string;
  pdf_org_name: string | null;
  pdf_header: string | null;
  pdf_footer: string | null;
  default_export: string; // pdf | csv
}

export interface SettingsView {
  settings: AppSettings;
  keys: { anthropic: boolean; voyage: boolean };
  email: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  density: "comfortable",
  font_scale: "md",
  default_base: "dark",
  start_layers: { boundaries: true, parcels: true },
  web_search_enabled: false,
  ai_model: "claude-opus-4-8",
  pdf_org_name: null,
  pdf_header: null,
  pdf_footer: null,
  default_export: "pdf",
};

// نماذج كلود المتاحة (§هـ.5.ج) — قابلة للإضافة يدوياً.
export const CLAUDE_MODELS = [
  { value: "claude-opus-4-8", label: "Claude Opus 4.8 — الأقوى" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — متوازن" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — الأسرع" },
];
