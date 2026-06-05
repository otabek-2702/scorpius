import LabShell from "@/components/laboratoriya/LabShell";
import FizikaLab from "@/components/laboratoriya/fizika/FizikaLab";

export const metadata = {
  title: "Fizika laboratoriyasi · Scorpius",
  description:
    "Ikki shar toʻqnashadi — impuls va kinetik energiya jonli. Qoʻlda qurilgan aniq fizika va matter-js dvigateli yonma-yon.",
};

export default function FizikaPage() {
  return (
    <LabShell
      title="Fizika laboratoriyasi"
      subtitle="Toʻqnashuvlar — impuls va energiya jonli"
      accent="#2dd4bf"
      askTopic="Fizika — sharlar toʻqnashuvi, impuls va kinetik energiya"
      askStarters={[
        "Nega birinchi shar toʻxtaydi?",
        "Impuls nima?",
        "Elastik va noelastik toʻqnashuv farqi?",
      ]}
    >
      <FizikaLab />
    </LabShell>
  );
}
