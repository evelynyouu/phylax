"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

/** "Forgot password?" on sign-in. Carries the typed email to the reset page so it need not be typed twice. */
export default function ForgotLink({ emailInputId }: { emailInputId: string }) {
  const router = useRouter();
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    const input = document.getElementById(emailInputId);
    const value = input instanceof HTMLInputElement ? input.value.trim() : "";
    if (!value.includes("@")) return;
    e.preventDefault();
    router.push(`/forgot-password?email=${encodeURIComponent(value)}`);
  }
  return (
    <Link href="/forgot-password" onClick={onClick}>
      Forgot password?
    </Link>
  );
}
