"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Role = "student" | "parent";

interface Submit {
  state: "idle" | "submitting" | "ok" | "error";
  message?: string;
}

export function WaitlistForm() {
  const [phone, setPhone] = useState("+998 ");
  const [grade, setGrade] = useState<number | "">("");
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [submit, setSubmit] = useState<Submit>({ state: "idle" });
  const [count, setCount] = useState<number | null>(null);

  // Live counter — polls every 3s so judges see signups tick during the pitch.
  useEffect(() => {
    let alive = true;
    async function fetchCount() {
      try {
        const r = await fetch("/api/waitlist", { cache: "no-store" });
        if (!r.ok) return;
        const { count } = (await r.json()) as { count: number };
        if (alive) setCount(count);
      } catch {
        /* silent — counter is decorative */
      }
    }
    fetchCount();
    const id = setInterval(fetchCount, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const digits = phone.replace(/\D/g, "");
  const canSubmit =
    digits.length >= 9 && (role === "parent" || (grade !== "" && grade >= 1));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submit.state === "submitting") return;
    setSubmit({ state: "submitting" });
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          grade: grade === "" ? undefined : Number(grade),
          role,
          name: name.trim() || undefined,
          referrer: "gdg-pitch",
        }),
      });
      const data = (await r.json()) as { ok?: boolean; count?: number; error?: string };
      if (!r.ok || !data.ok) {
        setSubmit({ state: "error", message: data.error ?? "Xato — qayta urinib ko'ring." });
        return;
      }
      if (typeof data.count === "number") setCount(data.count);
      setSubmit({ state: "ok" });
    } catch (err) {
      setSubmit({
        state: "error",
        message: err instanceof Error ? err.message : "Xato",
      });
    }
  }

  // Success view — confirmation + share nudge
  if (submit.state === "ok") {
    return (
      <div className="rise-in flex flex-col items-center text-center">
        <CheckCircle2 className="mb-5 h-14 w-14 text-signal-correct" />
        <h2 className="font-serif text-[2.1rem] font-medium leading-[1.1] text-void-100">
          Siz ro&apos;yxatdasiz.
        </h2>
        <p className="mt-4 max-w-[24rem] text-[1.02rem] leading-[1.55] text-void-200">
          Tez orada Telegram orqali yozamiz — beta havola va{" "}
          <em className="font-semibold not-italic text-void-100">50% chegirma</em>{" "}
          bilan.
        </p>
        {count !== null && (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-void-300">
            Siz <span className="font-semibold text-antares-700">#{count}</span> raqamli
            foydalanuvchi
          </p>
        )}
        <p className="mt-8 max-w-[24rem] text-sm leading-relaxed text-void-300">
          Do&apos;stlaringizga ham yuboring — birinchi 100 kishi umrbod chegirma oladi.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {count !== null && (
        <div className="rise-in mb-2 flex items-baseline justify-between border-b border-void-500/60 pb-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-void-300">
            Hozirgacha
          </span>
          <span className="text-[15px] text-void-200">
            <span className="font-mono font-semibold text-antares-700 tabular-nums">
              {count}
            </span>
            <span className="text-void-300"> / 100</span>{" "}
            <span className="text-void-300">kishi ro&apos;yxatda</span>
          </span>
        </div>
      )}

      {/* Role toggle — student vs parent */}
      <div className="flex gap-2" role="radiogroup" aria-label="Kim ekanligingiz">
        {(
          [
            { v: "student", label: "O'quvchiman" },
            { v: "parent", label: "Ota-onaman" },
          ] as { v: Role; label: string }[]
        ).map((opt) => {
          const active = role === opt.v;
          return (
            <button
              type="button"
              key={opt.v}
              role="radio"
              aria-checked={active}
              onClick={() => setRole(opt.v)}
              className={
                active
                  ? "flex-1 rounded-full bg-void-100 px-4 py-3 text-sm font-semibold text-void-950 transition"
                  : "flex-1 rounded-full border border-void-500 bg-void-900 px-4 py-3 text-sm font-medium text-void-200 transition hover:border-void-600"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
          Telefon raqamingiz
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998 90 123 45 67"
          className="rounded-2xl border border-void-500 bg-void-900 px-4 py-3 text-[1rem] text-void-100 outline-none transition focus:border-antares-500 focus:ring-2 focus:ring-antares-500/15"
        />
      </label>

      {role === "student" && (
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
            Sinfingiz
          </span>
          <select
            required
            value={grade === "" ? "" : String(grade)}
            onChange={(e) =>
              setGrade(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="appearance-none rounded-2xl border border-void-500 bg-void-900 px-4 py-3 text-[1rem] text-void-100 outline-none transition focus:border-antares-500 focus:ring-2 focus:ring-antares-500/15"
          >
            <option value="">— tanlang —</option>
            {[5, 6, 7, 8, 9, 10, 11].map((g) => (
              <option key={g} value={g}>
                {g}-sinf
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-void-300">
          Ismingiz <span className="lowercase tracking-normal">(ixtiyoriy)</span>
        </span>
        <input
          type="text"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Murodjon"
          maxLength={80}
          className="rounded-2xl border border-void-500 bg-void-900 px-4 py-3 text-[1rem] text-void-100 outline-none transition focus:border-antares-500 focus:ring-2 focus:ring-antares-500/15"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit || submit.state === "submitting"}
        className={
          canSubmit && submit.state !== "submitting"
            ? "mt-2 inline-flex h-[54px] items-center justify-center rounded-full bg-antares-500 px-9 text-[1.05rem] font-semibold text-void-100 transition hover:bg-antares-300 active:scale-[0.97]"
            : "mt-2 inline-flex h-[54px] items-center justify-center rounded-full bg-antares-500/55 px-9 text-[1.05rem] font-semibold text-void-100/80"
        }
      >
        {submit.state === "submitting"
          ? "Saqlanmoqda…"
          : "Ro'yxatdan o'tish — 50% chegirma"}
      </button>

      {submit.state === "error" && (
        <p className="text-sm text-signal-error">{submit.message}</p>
      )}

      <p className="text-center text-[12px] leading-relaxed text-void-300">
        Maxfiy. Faqat erta kirish havolasini yuborish uchun foydalanamiz.
      </p>
    </form>
  );
}
