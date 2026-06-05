import LabShell from "@/components/laboratoriya/LabShell";
import KimyoLab from "@/components/laboratoriya/kimyo/KimyoLab";

export const metadata = {
  title: "Kimyo laboratoriyasi · Scorpius",
  description:
    "Elementlarni torting va qoʻshing — haqiqiy reaksiyalar jonli yigʻiladi (2H₂ + O₂ → 2H₂O). Qoʻlda qurilgan animatsiya va 3Dmol.js 3D koʻrinishi.",
};

export default function KimyoPage() {
  return (
    <LabShell
      title="Kimyo laboratoriyasi"
      subtitle="Elementlarni qoʻshing — reaksiyani koʻring"
      accent="#a855f7"
      askTopic="Kimyo — atomlar, elementlar, davriy jadval va reaksiyalar"
      askStarters={[
        "H va O nega suv hosil qiladi?",
        "Proton va neytron nima?",
        "Reaksiya turlari qanday boʻladi?",
      ]}
    >
      <KimyoLab />
    </LabShell>
  );
}
