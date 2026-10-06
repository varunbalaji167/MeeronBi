import Link from "next/link";
import { cookies } from "next/headers";
import { verifyResearcherSignupToken, GOOGLE_RESEARCHER_SIGNUP_COOKIE } from "@/server/auth/googleResearcherSignupToken";
import CompleteResearcherSignupForm from "./CompleteResearcherSignupForm";

function ExpiredState() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16">
      <div className="panel max-w-md text-center">
        <h1 className="font-display text-2xl italic text-ink">This link has expired</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Google sign-up links only stay valid for a few minutes. Start again from the researcher access page.
        </p>
        <Link href="/researcher-access" className="btn-primary mt-6 inline-flex">
          Back to researcher access
        </Link>
      </div>
    </main>
  );
}

export default async function CompleteResearcherSignupPage() {
  const token = cookies().get(GOOGLE_RESEARCHER_SIGNUP_COOKIE)?.value;
  if (!token) return <ExpiredState />;

  try {
    const claims = await verifyResearcherSignupToken(token);
    return <CompleteResearcherSignupForm email={claims.email} name={claims.name} />;
  } catch {
    return <ExpiredState />;
  }
}
