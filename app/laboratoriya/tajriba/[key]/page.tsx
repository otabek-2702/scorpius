import type { Metadata } from "next";
import LabShell from "@/components/laboratoriya/LabShell";
import TajribaViewer from "@/components/laboratoriya/TajribaViewer";

/** Standalone "quick experiment" entries surfaced from the existing sim library. */
const TAJRIBA: Record<
  string,
  { title: string; subtitle: string; accent: string }
> = {
  "density-buoyancy-tank": {
    title: "Zichlik va suzish",
    subtitle: "Jismlarni suvga tashlang — suzadimi yoki choʻkadimi?",
    accent: "#3b7bd1",
  },
  prism: {
    title: "Prizma — kamalak",
    subtitle: "Oq nurni ranglarga ajrating (Nyuton kashfi)",
    accent: "#a855f7",
  },
  eclipse: {
    title: "Tutilish",
    subtitle: "Quyosh, Oy va Yer bir chiziqda",
    accent: "#e8a21a",
  },
  brownian: {
    title: "Broun harakati",
    subtitle: "Zarrachalarning tartibsiz issiqlik raqsi",
    accent: "#2dd4bf",
  },
  brachistochrone: {
    title: "Eng tez yoʻl",
    subtitle: "Qaysi egri chiziq eng tez? — Brakistoxrona",
    accent: "#e8a21a",
  },
};

export function generateStaticParams() {
  return Object.keys(TAJRIBA).map((key) => ({ key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const meta = TAJRIBA[key];
  return {
    title: `${meta?.title ?? "Tajriba"} · Laboratoriya · Scorpius`,
  };
}

export default async function TajribaPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const meta = TAJRIBA[key] ?? {
    title: "Tajriba",
    subtitle: "",
    accent: "#e8a21a",
  };
  return (
    <LabShell title={meta.title} subtitle={meta.subtitle} accent={meta.accent}>
      <TajribaViewer simKey={key} />
    </LabShell>
  );
}
