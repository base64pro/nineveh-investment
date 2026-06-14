import { Landmark, LockKeyhole, Mail } from "lucide-react";
import { login } from "./actions";

// شاشة الدخول (م7.6) — بوابة هولوكرامية كحلية: شبكة زمكان + شفق ضوئي + بطاقة زجاجية بإطار متدرّج.
// مكوّن خادمي خالص؛ الحركة كلّها CSS (login-* في globals.css). دلالات النموذج كما هي (§أ: مستخدم واحد).

const INPUT =
  "w-full rounded-xl bg-white/[0.045] px-3.5 py-2.5 text-sm text-foreground outline-none ring-1 ring-inset ring-white/12 transition placeholder:text-foreground/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-[rgba(159,192,232,0.65)] focus:shadow-[0_0_18px_-4px_rgba(159,192,232,0.5)]";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#070d18] p-6">
      {/* شبكة الزمكان الرقيقة — تتمايل ببطء مائي */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [animation:login-grid-sway_14s_ease-in-out_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(196,219,247,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(196,219,247,0.07) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 35%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black 35%, transparent 100%)",
        }}
      />
      {/* شفق ضوئي مزدوج (ثلجي + بنفسجي) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -start-32 -top-32 size-[480px] rounded-full blur-3xl [animation:login-aurora_16s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, rgba(87,117,168,0.32), transparent 65%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 -end-32 size-[520px] rounded-full blur-3xl [animation:login-aurora-b_19s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, rgba(139,111,176,0.26), transparent 65%)" }}
      />

      {/* البطاقة — إطار متدرّج p-px حول جسم زجاجي */}
      <div className="relative w-full max-w-sm rounded-3xl p-px shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9),0_0_45px_-10px_rgba(148,175,209,0.45)] [background:linear-gradient(155deg,rgba(148,175,209,0.6),rgba(139,111,176,0.35),rgba(148,175,209,0.18))]">
        <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-[hsl(221_40%_9%/0.94)] px-8 pb-8 pt-9 backdrop-blur-2xl">
          {/* خط مسح ضوئي خافت ينساب على البطاقة */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-[rgba(148,175,209,0.07)] to-transparent [animation:login-scan_7s_linear_infinite]"
          />
          <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(207,227,255,0.8)] to-transparent" />

          {/* الشعار — صرح داخل حلقة متوهّجة */}
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="relative grid size-16 place-items-center rounded-2xl bg-[linear-gradient(160deg,rgba(148,175,209,0.22),rgba(139,111,176,0.12))] ring-1 ring-inset ring-[rgba(159,192,232,0.5)] shadow-[0_0_30px_-6px_rgba(159,192,232,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <Landmark className="size-8 text-[#cfe3ff] drop-shadow-[0_0_10px_rgba(159,192,232,0.9)]" strokeWidth={1.6} />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold leading-snug tracking-tight text-foreground">
                نظام إدارة الاستثمار في نينوى
              </h1>
              <p className="text-[11px] tracking-[0.14em] text-[#9fc0e8]/80">
                هيئة استثمار نينوى · مكتب المدير العام
              </p>
            </div>
          </div>

          <form action={login} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                <Mail className="size-3.5 text-[#9fc0e8]" />
                اسم المستخدم أو البريد
              </label>
              <input id="email" name="email" type="text" required autoComplete="username" dir="ltr" className={INPUT} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                <LockKeyhole className="size-3.5 text-[#9fc0e8]" />
                كلمة المرور
              </label>
              <input id="password" name="password" type="password" required autoComplete="current-password" className={INPUT} />
            </div>

            {error ? (
              <p className="rounded-xl bg-[rgba(181,97,106,0.14)] px-3.5 py-2.5 text-xs font-medium text-[#e2a9b0] ring-1 ring-inset ring-[rgba(181,97,106,0.4)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="group relative mt-1 w-full overflow-hidden rounded-xl bg-[linear-gradient(135deg,#41618f,#56789c_55%,#6d5a96)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_28px_-10px_rgba(87,117,168,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-inset ring-white/15 transition hover:brightness-110 active:scale-[0.985]"
            >
              {/* لمعة ضوئية تعبر الزر دورياً */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 start-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent [animation:login-sheen_4.5s_ease-in-out_infinite]"
              />
              دخول إلى النظام
            </button>
          </form>

          <p className="mt-6 text-center text-[10px] tracking-[0.18em] text-foreground/35">
            دخول مخوَّل · جلسة آمنة
          </p>
        </div>
      </div>
    </main>
  );
}
