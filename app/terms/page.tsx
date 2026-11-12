import LegalPage from "@/components/LegalPage";
import { legalDoc } from "@/lib/markdown";

export const metadata = { title: "Terms of Use | Phylax" };

// Static: docs/legal/TERMS.md is read and rendered at build time.
export default function TermsPage() {
  return <LegalPage>{legalDoc("TERMS.md")}</LegalPage>;
}
