"use client";

// م5.4 · لوحة الإعدادات (§هـ.5) — حساب · عرض · ذكاء (نموذج + مفاتيح آمنة) · تصدير.
// المفاتيح تُكتب ولا تُقرأ للعميل (تُعرض مقنّعة ••••)؛ النموذج المختار يُطبَّق على كل وظائف الذكاء.

import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Bot, Check, Download, KeyRound, Monitor, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combo } from "@/components/ui/combo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSettings } from "./use-settings";
import { applyFont } from "./apply";
import { changePassword, deleteApiKey, saveSettings, setApiKey } from "./actions";
import { CLAUDE_MODELS, type AppSettings } from "./types";

const TABS = [
  { id: "account", label: "الحساب", icon: UserCog },
  { id: "display", label: "العرض", icon: Monitor },
  { id: "ai", label: "الذكاء", icon: Bot },
  { id: "export", label: "التصدير", icon: Download },
] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground/90">{label}</label>
      {children}
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <span className="text-xs text-foreground/90">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-secondary")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", checked ? "start-0.5" : "start-[18px]")} />
      </button>
    </label>
  );
}

export function SettingsPanel() {
  const { data, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("account");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyInput, setKeyInput] = useState<Record<string, string>>({ anthropic: "", voyage: "" });
  const [pdf, setPdf] = useState({ org: "", header: "", footer: "" });

  const s = data?.settings;
  useEffect(() => {
    if (s) setPdf({ org: s.pdf_org_name ?? "", header: s.pdf_header ?? "", footer: s.pdf_footer ?? "" });
  }, [s]);

  async function commit(patch: Partial<AppSettings>): Promise<void> {
    const res = await saveSettings(patch);
    if (res.ok) {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    } else {
      toast.error("تعذّر حفظ الإعداد");
    }
  }

  async function onSaveKey(provider: string): Promise<void> {
    const k = keyInput[provider] ?? "";
    if (!k.trim()) return;
    setBusy(true);
    const res = await setApiKey(provider, k);
    setBusy(false);
    if (res.ok) {
      toast.success("حُفِظ المفتاح بأمان");
      setKeyInput((p) => ({ ...p, [provider]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    } else {
      toast.error(res.error);
    }
  }
  async function onDeleteKey(provider: string): Promise<void> {
    if (!window.confirm("حذف هذا المفتاح؟")) return;
    const res = await deleteApiKey(provider);
    if (res.ok) {
      toast.success("حُذِف المفتاح");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    } else {
      toast.error("تعذّر الحذف");
    }
  }
  async function onChangePwd(): Promise<void> {
    setBusy(true);
    const res = await changePassword(pwd);
    setBusy(false);
    if (res.ok) {
      toast.success("غُيِّرت كلمة المرور");
      setPwd("");
    } else {
      toast.error(res.error);
    }
  }

  if (isLoading || !s) {
    return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const INPUT = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex h-full flex-col">
      {/* تابات */}
      <div className="grid grid-cols-4 gap-1 border-b border-border p-2">
        {TABS.map((tt) => {
          const Icon = tt.icon;
          return (
            <button
              key={tt.id}
              type="button"
              onClick={() => setTab(tt.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition",
                tab === tt.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" />
              {tt.label}
            </button>
          );
        })}
      </div>

      <div className="scroll-slim min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === "account" ? (
          <>
            <Field label="البريد/المستخدم">
              <div className="rounded-md border border-border/60 bg-secondary/30 px-2.5 py-1.5 text-sm text-foreground/80">{data?.email ?? "غير متوفّر"}</div>
            </Field>
            <Field label="تغيير كلمة المرور" hint="٦ أحرف على الأقل">
              <div className="flex gap-2">
                <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="كلمة مرور جديدة" className={INPUT} autoComplete="new-password" />
                <Button type="button" size="sm" disabled={busy || pwd.length < 6} onClick={() => void onChangePwd()}>حفظ</Button>
              </div>
            </Field>
          </>
        ) : null}

        {tab === "display" ? (
          <>
            <Field label="السمة">
              <Combo value={s.theme} onChange={(v) => { setTheme(v); void commit({ theme: v }); }} options={[{ value: "light", label: "فاتح" }, { value: "dark", label: "داكن" }, { value: "system", label: "تلقائي" }]} ariaLabel="السمة" />
            </Field>
            <Field label="حجم الخطّ">
              <Combo value={s.font_scale} onChange={(v) => { applyFont(v); void commit({ font_scale: v }); }} options={[{ value: "sm", label: "صغير" }, { value: "md", label: "متوسط" }, { value: "lg", label: "كبير" }]} ariaLabel="حجم الخطّ" />
            </Field>
            <Field label="كثافة العرض">
              <Combo value={s.density} onChange={(v) => void commit({ density: v })} options={[{ value: "comfortable", label: "مريح" }, { value: "compact", label: "مدمج" }]} ariaLabel="كثافة العرض" />
            </Field>
            <Field label="أساس الخريطة الافتراضي" hint="يُطبَّق عند تحميل الخريطة">
              <Combo value={s.default_base} onChange={(v) => void commit({ default_base: v })} options={[{ value: "dark", label: "داكن" }, { value: "light", label: "فاتح" }, { value: "satellite", label: "قمر صناعي" }]} ariaLabel="أساس الخريطة" />
            </Field>
            <Field label="الطبقات عند البدء">
              <div className="space-y-1.5">
                <Toggle label="الحدود" checked={s.start_layers.boundaries !== false} onChange={(v) => void commit({ start_layers: { ...s.start_layers, boundaries: v } })} />
                <Toggle label="القطع" checked={s.start_layers.parcels !== false} onChange={(v) => void commit({ start_layers: { ...s.start_layers, parcels: v } })} />
              </div>
            </Field>
          </>
        ) : null}

        {tab === "ai" ? (
          <>
            <Field label="نموذج الذكاء" hint="يُطبَّق على كل وظائف النظام (المستشار · البحث · التوصيات)">
              <Combo value={s.ai_model} onChange={(v) => void commit({ ai_model: v })} options={CLAUDE_MODELS} allowCustom ariaLabel="نموذج الذكاء" />
            </Field>
            <Toggle label="تفعيل البحث على الويب (للتوصيات/الإثراء)" checked={s.web_search_enabled} onChange={(v) => void commit({ web_search_enabled: v })} />

            <div className="space-y-2 rounded-xl border border-border/60 bg-background/30 p-3">
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary/80"><KeyRound className="size-3.5" /> مفاتيح API</h4>
              <p className="text-[10px] text-muted-foreground">تُحفَظ خادمياً ولا تُعرَض أبداً. الحالة فقط: ✓ مضبوط / غير مضبوط.</p>
              {([{ id: "anthropic", label: "Anthropic (كلود)" }, { id: "voyage", label: "Voyage (تضمينات)" }] as const).map((p) => {
                const isSet = data?.keys[p.id];
                return (
                  <div key={p.id} className="space-y-1.5 border-t border-border/40 pt-2 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{p.label}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]", isSet ? "bg-state-completed/15 text-state-completed" : "bg-secondary/50 text-muted-foreground")}>
                        {isSet ? <><Check className="size-3" /> مضبوط ••••</> : "غير مضبوط"}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <input type="password" value={keyInput[p.id] ?? ""} onChange={(e) => setKeyInput((k) => ({ ...k, [p.id]: e.target.value }))} placeholder="ألصق المفتاح…" className={INPUT} autoComplete="off" />
                      <Button type="button" size="sm" disabled={busy || !(keyInput[p.id] ?? "").trim()} onClick={() => void onSaveKey(p.id)}>حفظ</Button>
                      {isSet ? <Button type="button" size="sm" variant="danger" onClick={() => void onDeleteKey(p.id)} aria-label="حذف"><Trash2 className="size-3.5" /></Button> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {tab === "export" ? (
          <>
            <Field label="صيغة التصدير الافتراضية">
              <Combo value={s.default_export} onChange={(v) => void commit({ default_export: v })} options={[{ value: "pdf", label: "PDF" }, { value: "csv", label: "CSV" }]} ariaLabel="صيغة التصدير" />
            </Field>
            <Field label="هوية الـPDF" hint="تظهر في ترويسة/تذييل التقارير (م6)">
              <div className="space-y-2">
                <input value={pdf.org} onChange={(e) => setPdf((p) => ({ ...p, org: e.target.value }))} placeholder="اسم الهيئة" className={INPUT} />
                <input value={pdf.header} onChange={(e) => setPdf((p) => ({ ...p, header: e.target.value }))} placeholder="نصّ الترويسة" className={INPUT} />
                <input value={pdf.footer} onChange={(e) => setPdf((p) => ({ ...p, footer: e.target.value }))} placeholder="نصّ التذييل" className={INPUT} />
                <Button type="button" size="sm" onClick={() => void commit({ pdf_org_name: pdf.org || null, pdf_header: pdf.header || null, pdf_footer: pdf.footer || null }).then(() => toast.success("حُفِظت هوية التصدير"))}>حفظ الهوية</Button>
              </div>
            </Field>
          </>
        ) : null}
      </div>
    </div>
  );
}
