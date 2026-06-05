// components/laboratoriya/TajribaViewer.tsx
/**
 * TajribaViewer — renders one of the project's existing interactive sims
 * (from the lesson SIM_REGISTRY) as a standalone laboratory experiment.
 *
 * The lab hub links to /laboratoriya/tajriba/[key]; the route looks the key up
 * here. Each sim is self-contained (SimProps onComplete/config are optional),
 * so we render it inside a framed card and let it run on its own rAF loop.
 */
"use client";

import { SIM_REGISTRY } from "@/components/learn/sims";

export default function TajribaViewer({ simKey }: { simKey: string }) {
  const Sim = SIM_REGISTRY[simKey];

  if (!Sim) {
    return (
      <div className="rounded-[22px] border border-void-500 bg-void-800 p-8 text-center">
        <p className="text-[15px] font-semibold text-void-100">Tajriba topilmadi.</p>
        <p className="mt-1.5 text-[13px] text-void-300">
          Bu tajriba hali mavjud emas — laboratoriyaga qaytib boshqasini tanlang.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] rounded-[22px] border border-void-600 bg-void-900 p-4 shadow-[0_8px_40px_-16px_rgba(20,18,14,0.18)] sm:p-6">
      <Sim />
    </div>
  );
}
