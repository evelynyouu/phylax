import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionFromCookie, type SessionUser } from "./session";

/** For Server Components inside a Suspense boundary. Redirects to sign-in when there is no valid session. */
export async function getCurrentUser(): Promise<SessionUser> {
  const user = sessionFromCookie((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/signin");
  return user;
}

export async function getOptionalUser(): Promise<SessionUser | null> {
  return sessionFromCookie((await cookies()).get(SESSION_COOKIE)?.value);
}
