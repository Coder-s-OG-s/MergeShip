import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "MergeShip — Open Source Ecosystem & Organisation Management",
  description: "The platform that trains contributors to be ready before they submit, and gives maintainers a smart command center.",
};

export default function HomePage() {
  return <LandingPage />;
}
