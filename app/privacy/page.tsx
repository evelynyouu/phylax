import LegalPage from "@/components/LegalPage";
import { legalDoc } from "@/lib/markdown";

export const metadata = { title: "Privacy Policy | Subwatch" };

// Static: docs/legal/PRIVACY_POLICY.md is read and rendered at build time.
export default function PrivacyPage() {
  return <LegalPage>{legalDoc("PRIVACY_POLICY.md")}</LegalPage>;
}
