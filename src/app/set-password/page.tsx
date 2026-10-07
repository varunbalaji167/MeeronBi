import Link from "next/link";
import { peekToken } from "@/server/auth/credentialTokens";
import SetPasswordForm from "./SetPasswordForm";
import AuthShell from "@/components/layout/AuthShell";

export const metadata = { title: "Set your password" };

const ALLOWED_PURPOSES = ["ACCOUNT_INVITE", "PASSWORD_RESET"] as const;

function ExpiredOrInvalidState({ heading, body, resendHref }: { heading: string; body: string; resendHref: string }) {
  return (
    <AuthShell>
      <div className="panel text-center">
        <h1 className="font-display text-2xl italic text-ink">{heading}</h1>
        <p className="mt-2 text-sm text-ink-soft">{body}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href={resendHref} className="btn-primary">
            Request a new link
          </Link>
          <Link href="/login" className="text-sm font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default async function SetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token;

  if (!token) {
    return (
      <ExpiredOrInvalidState
        heading="Link not found"
        body="This page needs a link from your email — check your inbox, or request a new one below."
        resendHref="/forgot-password"
      />
    );
  }

  const result = await peekToken(token, [...ALLOWED_PURPOSES]);

  if (result.status === "expired") {
    return (
      <ExpiredOrInvalidState
        heading="This link has expired"
        body="For your security, set-up and reset links only stay valid for a limited time. Request a new one below."
        resendHref="/forgot-password"
      />
    );
  }

  if (result.status === "invalid") {
    return (
      <ExpiredOrInvalidState
        heading="This link isn't valid"
        body="It may have already been used, or the link may be incomplete. Request a new one below."
        resendHref="/forgot-password"
      />
    );
  }

  const isInvite = result.purpose === "ACCOUNT_INVITE";
  return (
    <SetPasswordForm
      token={token}
      heading={isInvite ? "Set up your MeeronBi account" : "Choose a new password"}
      body={
        isInvite
          ? "Welcome — set a password to finish setting up your account."
          : "Choose a new password for your account."
      }
      banner={
        isInvite
          ? {
              eyebrow: "Welcome",
              heading: "Set up your account.",
              body: "Choose a password to complete your MeeronBi setup.",
              bullets: [
                "Your account was created by the MeeronBi team",
                "Choose a strong password — at least 6 characters",
                "You’ll be able to sign in straight away",
              ],
            }
          : {
              eyebrow: "Password Reset",
              heading: "Choose a new password.",
              body: "Pick a strong password for your MeeronBi account.",
              bullets: [
                "Your old password will stop working immediately",
                "Choose a strong password — at least 6 characters",
                "You’ll be taken to sign in once it’s set",
              ],
            }
      }
    />
  );
}
