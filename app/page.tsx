import { FindParcelForm } from "@/components/find-parcel-form";
import {
  AboutSection,
  HeroSection,
  HowItWorksSection,
  TrustSourcesSection,
} from "@/components/landing-sections";

export const maxDuration = 120;

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <HeroSection />
      <FindParcelForm />
      <div className="mt-16 space-y-16">
        <HowItWorksSection />
        <AboutSection />
        <TrustSourcesSection />
      </div>
    </main>
  );
}
