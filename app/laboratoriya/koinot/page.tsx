import LabShell from "@/components/laboratoriya/LabShell";
import KoinotLab from "@/components/laboratoriya/koinot/KoinotLab";

export const metadata = {
  title: "Quyosh tizimi 3D · Laboratoriya · Scorpius",
  description:
    "Sayyoralar Quyosh atrofida — 3D koʻrinishda aylantiring, masshtab va tezlikni oʻzgartiring.",
};

export default function KoinotPage() {
  return (
    <LabShell
      title="Quyosh tizimi"
      subtitle="3D — sayyoralarni aylantiring va oʻrganing"
      accent="#6366f1"
      askTopic="Astronomiya — Quyosh tizimi, sayyoralar va orbitalar"
      askStarters={[
        "Nega Merkuriy eng tez aylanadi?",
        "Saturnning halqasi nimadan iborat?",
        "Sayyora yulduzdan nimasi bilan farq qiladi?",
      ]}
    >
      <KoinotLab />
    </LabShell>
  );
}
