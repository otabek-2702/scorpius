import type { Metadata } from "next";
import { HumoView } from "@/components/humo/HumoView";

export const metadata: Metadata = {
  title: "Humo · Scorpius",
  description:
    "Humo AI — Scorpius'ning Khanmigo darajasidagi chat o'qituvchisi. Nyutondan, Aynshteyndan, Al-Xorazmiyga — istalganidan so'rang.",
};

export default function HumoPage() {
  return <HumoView />;
}
