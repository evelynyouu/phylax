import Landing from "@/components/landing/Landing";
import { isDemo } from "@/lib/session";
import "./landing.css";

// Marketing page, from the Home board of the "Phylax Mockup.html" design export.
// In demo mode the sample dashboard is open to anyone; otherwise "See a sample dashboard" scrolls to the preview tiles.
export default function Home() {
  return <Landing sampleHref={isDemo() ? "/app" : "#see"} />;
}
