import type { Metadata } from "next";
import { HumoView } from "@/components/humo/HumoView";
import { isPersonaId, PERSONAS, type PersonaId } from "@/lib/personas";

interface RouteProps {
  /** Next 16 App Router — async params per the project's stack note in
   *  AGENTS.md / CLAUDE.md. */
  params: Promise<{ personaId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { personaId } = await params;
  const persona = isPersonaId(personaId) ? PERSONAS[personaId] : null;
  if (!persona) return { title: "Humo · Scorpius" };
  return {
    title: `${persona.displayName} · Humo · Scorpius`,
    description: `${persona.displayName} uslubidagi AI yo'ldosh — ${persona.focusUz}.`,
  };
}

export default async function HumoPersonaPage({ params }: RouteProps) {
  const { personaId } = await params;
  const initial: PersonaId = isPersonaId(personaId) ? personaId : "scorpius";
  return <HumoView initialPersonaId={initial} />;
}
