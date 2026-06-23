"use client";

// م9.2 · قسم المجسّم ثلاثي الأبعاد في نافذة القطعة المفترضة (الخارطة الاستثمارية):
// رفع glb/gltf/stl (سكتشب ويب) + محرّر تموضع (مقياس/دوران/ارتفاع) + حذف — للمدير فقط (RLS مكمّل).
// النموذج «تصوّر تصميمي مبدئي»؛ يحلّ محلّ الكتلة الإجرائية في العرض (م9.3ب).

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Loader2, Trash2, UploadCloud } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { ParcelKind } from "@/features/map/lib/map-nav-store";
import { deleteParcelModel, MAX_PARCEL_MODELS, type ModelTransform, type ParcelModel, updateParcelModel, uploadParcelModel, useParcelModels } from "./model-lib";

export function ModelsSection({ kind, refId, readOnly }: { kind: ParcelKind; refId: string; readOnly: boolean }) {
  const { data: models = [], isLoading } = useParcelModels(kind, refId);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["parcel_models", kind, refId] });
  }

  async function onFile(list: FileList | null): Promise<void> {
    const file = (list ?? [])[0];
    if (!file || busy) return;
    setBusy(true);
    const res = await uploadParcelModel(kind, refId, file, { scale: 1, rotationDeg: 0, elevationM: 0 }, { existingCount: models.length });
    setBusy(false);
    if (res.ok) {
      toast.success("رُفِع المجسّم — اضبط تموضعه ثم احفظ");
      invalidate();
    } else {
      toast.error(res.error);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onDelete(id: string, path: string): Promise<void> {
    if (!window.confirm("حذف هذا المجسّم؟")) return;
    const res = await deleteParcelModel(id, path);
    if (res.ok) {
      toast.success("حُذِف المجسّم");
      invalidate();
    } else {
      toast.error("تعذّر الحذف");
    }
  }

  return (
    <section className="rounded-xl border border-border/60 bg-background/40 p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-primary/80">
          <Boxes className="size-3.5" /> المجسّم ثلاثي الأبعاد
          <span className="rounded bg-secondary/60 px-1.5 text-[10px] text-secondary-foreground">{formatNumber(models.length)}</span>
        </h4>
        {!readOnly ? (
          <>
            <input ref={inputRef} type="file" accept=".glb,.gltf,.stl,model/gltf-binary,model/gltf+json" className="hidden" onChange={(e) => void onFile(e.target.files)} />
            <button
              type="button"
              disabled={busy || models.length >= MAX_PARCEL_MODELS}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-accent disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
              {busy ? "جارٍ الرفع…" : "رفع مجسّم"}
            </button>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">يُحمَّل المجسّم…</p>
      ) : models.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا مجسّم بعد{readOnly ? "" : " — ارفع نموذج glb أو STL (من سكتشب ويب). تُعرَض كتلة تصوّرية حتى يُرفع نموذجك."}.</p>
      ) : (
        <div className="space-y-2">
          {models.map((m) => (
            <ModelRow key={m.id} model={m} readOnly={readOnly} onSaved={invalidate} onDelete={() => void onDelete(m.id, m.path)} />
          ))}
          {!readOnly ? <p className="pt-0.5 text-[10px] text-muted-foreground">يُعرَض النموذج بوصفه «تصوّراً تصميمياً مبدئياً». اضبط المقياس/الدوران/الارتفاع ثم احفظ.</p> : null}
        </div>
      )}
    </section>
  );
}

function ModelRow({ model, readOnly, onSaved, onDelete }: { model: ParcelModel; readOnly: boolean; onSaved: () => void; onDelete: () => void }) {
  const t = model.transform ?? {};
  const [scale, setScale] = useState(String(t.scale ?? 1));
  const [rot, setRot] = useState(String(t.rotationDeg ?? 0));
  const [elev, setElev] = useState(String(t.elevationM ?? 0));
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    setSaving(true);
    const transform: ModelTransform = { scale: Number(scale) || 1, rotationDeg: Number(rot) || 0, elevationM: Number(elev) || 0 };
    const res = await updateParcelModel(model.id, { transform });
    setSaving(false);
    if (res.ok) {
      toast.success("حُفِظ تموضع المجسّم");
      onSaved();
    } else {
      toast.error(res.error ?? "تعذّر الحفظ");
    }
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-foreground/90">{model.title || "نموذج المشروع"}</span>
        <span className="shrink-0 rounded bg-secondary/60 px-1.5 text-[10px] uppercase text-secondary-foreground">{model.format}</span>
      </div>
      {readOnly ? (
        <p className="text-[10px] text-muted-foreground">تصوّر تصميمي مبدئي</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="مقياس" value={scale} onChange={setScale} step="0.1" />
          <Field label="دوران°" value={rot} onChange={setRot} step="5" />
          <Field label="ارتفاع م" value={elev} onChange={setElev} step="1" />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-primary/90 px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            حفظ التموضع
          </button>
          <button type="button" onClick={onDelete} aria-label="حذف المجسّم" title="حذف" className="grid size-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition hover:bg-[rgba(181,97,106,0.12)] hover:text-[#e2a9b0]">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step: string }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
