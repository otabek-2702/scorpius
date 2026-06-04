import { Suspense } from "react";
import { SkyView } from "@/components/sky/SkyView";

export const metadata = {
  title: "Osmoningiz · Scorpius",
};

export default function LearnPage() {
  // SkyView reads `?subject=physics` via useSearchParams, which Next 16 requires
  // to be inside a Suspense boundary so the rest of the page can prerender.
  return (
    <Suspense fallback={null}>
      <SkyView />
    </Suspense>
  );
}
