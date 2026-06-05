import type { Metadata } from "next";
import { ConnectEmaktabView } from "@/components/parent/ConnectEmaktabView";

export const metadata: Metadata = {
  title: "emaktab.uz bog'lash · Scorpius",
  description:
    "emaktab.uz hisobingizni Scorpius bilan bog'lang — farzandingizning baholari, kundalik vazifalari va o'rganish dinamikasi avtomatik tortiladi.",
};

export default function ConnectEmaktabPage() {
  return <ConnectEmaktabView />;
}
