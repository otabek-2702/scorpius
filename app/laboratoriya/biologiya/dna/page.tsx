import LabShell from "@/components/laboratoriya/LabShell";
import DnaLab from "@/components/laboratoriya/biologiya/DnaLab";

export const metadata = {
  title: "DNK → Protein · Laboratoriya · Scorpius",
  description:
    "Markaziy dogma: DNKdan RNKga, RNKdan oqsilga — transkripsiya va translatsiya jonli animatsiyada.",
};

export default function DnaPage() {
  return (
    <LabShell
      title="DNK → Protein"
      subtitle="Markaziy dogma — transkripsiya va translatsiya"
      accent="#34d399"
      askTopic="Biologiya — DNK, RNK, transkripsiya, translatsiya va oqsil sintezi"
      askStarters={[
        "Transkripsiya nima?",
        "Kodon nima degani?",
        "DNK qanday oqsil yasaydi?",
      ]}
    >
      <DnaLab />
    </LabShell>
  );
}
