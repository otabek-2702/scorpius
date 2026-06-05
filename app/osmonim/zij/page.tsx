import type { Metadata } from "next";
import { ZijView } from "@/components/zij/ZijView";

export const metadata: Metadata = {
  title: "Shaxsiy zij · Scorpius",
  description:
    "Sizning yulduz katalogingiz — har bir o'rganilgan mavzu, sana va daraja bilan. 1437-yil Samarqand zijiga ishora bilan tuzilgan.",
};

export default function ZijPage() {
  return <ZijView />;
}
