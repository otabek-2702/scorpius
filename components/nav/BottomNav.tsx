"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, MessageCircle, PencilLine, Sparkles, Users } from "lucide-react";

const TABS = [
  { href: "/learn", label: "Osmonim", icon: Sparkles },
  { href: "/laboratoriya", label: "Lab", icon: FlaskConical },
  { href: "/humo", label: "Humo", icon: MessageCircle },
  { href: "/homework", label: "Uy vazifasi", icon: PencilLine },
  { href: "/parent", label: "Ota-ona", icon: Users },
];

/** Frosted bottom tab bar — shown on the non-immersive app surfaces. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-void-500 bg-void-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-[480px] items-stretch justify-around">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors"
            >
              <Icon className={active ? "h-5 w-5 text-antares-500" : "h-5 w-5 text-void-300"} />
              <span
                className={
                  active
                    ? "text-[11px] font-semibold text-void-100"
                    : "text-[11px] font-medium text-void-300"
                }
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
