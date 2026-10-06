// Pure email rendering — no framework imports, no Node builtins, no Prisma types.

export type EmailPayload =
  | { template: "researcher-verify-email"; name: string; verifyUrl: string }
  | {
      template: "researcher-request-submitted";
      researcherName: string;
      researcherEmail: string;
      institution: string;
      purpose: string;
      reviewUrl: string;
    }
  | { template: "researcher-approved"; name: string; signInUrl: string }
  | { template: "researcher-rejected"; name: string; reviewNote?: string }
  | {
      template: "facility-admin-invite";
      name: string;
      facilityName: string;
      setPasswordUrl: string;
      expiresInDays: number;
    }
  | {
      template: "patient-portal-invite";
      name: string;
      facilityName: string;
      setPasswordUrl: string;
      expiresInDays: number;
    }
  | { template: "password-reset"; name: string; resetUrl: string; expiresInMinutes: number }
  | { template: "password-changed"; name: string; supportHint: string }
  | { template: "google-account-linked"; name: string; googleEmail: string; supportHint: string };

export type RenderedEmail = { subject: string; text: string; html: string };

const SIGN_OFF_TEXT = "The MeeronBi team";

// Matches tailwind.config.ts's palette so transactional mail doesn't look like a generic SaaS product.
const COLOR = {
  brandDark: "#083F37",
  brand: "#0E6B5C",
  ink: "#1B2420",
  inkSoft: "#3F473F",
  inkFaint: "#6B7268",
  paper: "#F6F6F2",
  line: "#E1E0D5",
};

// Escape `&` first or `<`/`>`/etc get double-escaped.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLOR.inkSoft};">${text}</p>`;
}

function fine(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${COLOR.inkFaint};">${text}</p>`;
}

// Table-based layout with every style inlined — the only markup pattern that renders consistently
// across Gmail, Outlook and Apple Mail, none of which reliably support a <style> block or flexbox.
function button(label: string, url: string): string {
  const safeUrl = escapeHtml(url);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
      <tr>
        <td style="border-radius:6px;background:${COLOR.brand};">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 28px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

// `linkFallback` is the same URL spelled out as plain text — every mail client that strips/alters
// the button (or a recipient who just prefers to see the raw link) still has a way through.
function shell(bodyHtml: string, linkFallback?: { label: string; url: string }): string {
  const fallback = linkFallback
    ? fine(
        `If the button above doesn't work, copy and paste this link into your browser:<br>` +
          `<a href="${escapeHtml(linkFallback.url)}" style="color:${COLOR.brand};word-break:break-all;">${escapeHtml(linkFallback.url)}</a>`
      )
    : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLOR.paper};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.paper};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border-radius:10px;border:1px solid ${COLOR.line};font-family:Georgia,'Times New Roman',serif;">
            <tr>
              <td style="background:${COLOR.brandDark};padding:20px 32px;border-radius:10px 10px 0 0;">
                <span style="font-size:20px;font-style:italic;color:#FFFFFF;">MeeronBi</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:${COLOR.ink};">
                ${bodyHtml}
                ${fallback}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid ${COLOR.line};">
                <p style="margin:0;font-size:12px;color:${COLOR.inkFaint};">
                  The MeeronBi team &middot; This is an automated message — please don't reply directly to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderEmail(payload: EmailPayload): RenderedEmail {
  switch (payload.template) {
    case "researcher-verify-email": {
      const { name, verifyUrl } = payload;
      return {
        subject: "Verify your email to continue your MeeronBi researcher request",
        text: `Hi ${name},\n\nThanks for requesting researcher access to MeeronBi. Please confirm your email address to continue your request:\n${verifyUrl}\n\nThis link is valid for 24 hours. If you didn't request this, you can safely ignore this email — no account will be created.\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p("Thanks for requesting researcher access to MeeronBi. Please confirm your email address to continue your request.") +
            button("Verify email address", verifyUrl) +
            fine("This link is valid for 24 hours. If you didn't request this, you can safely ignore this email — no account will be created."),
          { label: "Verify email address", url: verifyUrl }
        ),
      };
    }
    case "researcher-request-submitted": {
      const { researcherName, researcherEmail, institution, purpose, reviewUrl } = payload;
      return {
        subject: `New researcher access request — ${researcherName}`,
        text: `A new researcher access request needs review.\n\nName: ${researcherName}\nEmail: ${researcherEmail}\nInstitution: ${institution}\nPurpose: ${purpose}\n\nReview this request:\n${reviewUrl}\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p("A new researcher access request needs review.") +
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:14px;color:${COLOR.inkSoft};">` +
            `<tr><td style="padding:4px 0;width:110px;color:${COLOR.inkFaint};">Name</td><td style="padding:4px 0;">${escapeHtml(researcherName)}</td></tr>` +
            `<tr><td style="padding:4px 0;color:${COLOR.inkFaint};">Email</td><td style="padding:4px 0;">${escapeHtml(researcherEmail)}</td></tr>` +
            `<tr><td style="padding:4px 0;color:${COLOR.inkFaint};">Institution</td><td style="padding:4px 0;">${escapeHtml(institution)}</td></tr>` +
            `<tr><td style="padding:4px 0;vertical-align:top;color:${COLOR.inkFaint};">Purpose</td><td style="padding:4px 0;">${escapeHtml(purpose)}</td></tr>` +
            `</table>` +
            button("Review this request", reviewUrl),
          { label: "Review this request", url: reviewUrl }
        ),
      };
    }
    case "researcher-approved": {
      const { name, signInUrl } = payload;
      return {
        subject: "Your MeeronBi researcher access has been approved",
        text: `Hi ${name},\n\nGood news — your researcher access request has been approved. You can now sign in and start exploring de-identified, disclosure-controlled analytics:\n${signInUrl}\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p("Good news — your researcher access request has been approved. You can now sign in and start exploring de-identified, disclosure-controlled analytics.") +
            button("Sign in to MeeronBi", signInUrl),
          { label: "Sign in to MeeronBi", url: signInUrl }
        ),
      };
    }
    case "researcher-rejected": {
      const { name, reviewNote } = payload;
      const noteText = reviewNote ? `\n\nReviewer note: ${reviewNote}` : "";
      const noteHtml = reviewNote
        ? `<p style="margin:0 0 16px;padding:12px 16px;background:${COLOR.paper};border-radius:6px;font-size:14px;color:${COLOR.inkSoft};"><strong>Reviewer note:</strong> ${escapeHtml(reviewNote)}</p>`
        : "";
      return {
        subject: "An update on your MeeronBi researcher access request",
        text: `Hi ${name},\n\nAfter review, we're not able to approve your researcher access request at this time.${noteText}\n\nIf you have questions, feel free to reach out to the MeeronBi team.\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p("After review, we're not able to approve your researcher access request at this time.") +
            noteHtml +
            p("If you have questions, feel free to reach out to the MeeronBi team.")
        ),
      };
    }
    case "facility-admin-invite": {
      const { name, facilityName, setPasswordUrl, expiresInDays } = payload;
      return {
        subject: `You're invited to MeeronBi — set up your account for ${facilityName}`,
        text: `Hi ${name},\n\nYou've been added as an administrator for ${facilityName} on MeeronBi. Set up your password to get started:\n${setPasswordUrl}\n\nThis link expires in ${expiresInDays} days.\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p(`You've been added as an administrator for <strong>${escapeHtml(facilityName)}</strong> on MeeronBi. Set up your password to get started.`) +
            button("Set up your account", setPasswordUrl) +
            fine(`This link expires in ${expiresInDays} days.`),
          { label: "Set up your account", url: setPasswordUrl }
        ),
      };
    }
    case "patient-portal-invite": {
      const { name, facilityName, setPasswordUrl, expiresInDays } = payload;
      return {
        subject: `Access your antenatal care record online — ${facilityName}`,
        text: `Hi ${name},\n\n${facilityName} has set up online access to your antenatal care record. Set up your password to get started:\n${setPasswordUrl}\n\nThis link expires in ${expiresInDays} days.\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p(`<strong>${escapeHtml(facilityName)}</strong> has set up online access to your antenatal care record. Set up your password to get started.`) +
            button("Set up your access", setPasswordUrl) +
            fine(`This link expires in ${expiresInDays} days.`),
          { label: "Set up your access", url: setPasswordUrl }
        ),
      };
    }
    case "password-reset": {
      const { name, resetUrl, expiresInMinutes } = payload;
      return {
        subject: "Reset your MeeronBi password",
        text: `Hi ${name},\n\nWe received a request to reset your MeeronBi password. Choose a new one using the link below:\n${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p("We received a request to reset your MeeronBi password. Choose a new one using the button below.") +
            button("Reset password", resetUrl) +
            fine(`This link expires in ${expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.`),
          { label: "Reset password", url: resetUrl }
        ),
      };
    }
    case "password-changed": {
      const { name, supportHint } = payload;
      return {
        subject: "Your MeeronBi password was changed",
        text: `Hi ${name},\n\nThis confirms your MeeronBi password was just changed.\n\nIf this wasn't you, ${supportHint}\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p("This confirms your MeeronBi password was just changed.") +
            fine(`If this wasn't you, ${escapeHtml(supportHint)}`)
        ),
      };
    }
    case "google-account-linked": {
      const { name, googleEmail, supportHint } = payload;
      return {
        subject: "Your MeeronBi account is now linked to Google",
        text: `Hi ${name},\n\nYour MeeronBi account is now linked to the Google account ${googleEmail} for sign-in.\n\nIf this wasn't you, ${supportHint}\n\n${SIGN_OFF_TEXT}`,
        html: shell(
          p(`Hi ${escapeHtml(name)},`) +
            p(`Your MeeronBi account is now linked to the Google account <strong>${escapeHtml(googleEmail)}</strong> for sign-in.`) +
            fine(`If this wasn't you, ${escapeHtml(supportHint)}`)
        ),
      };
    }
  }
}
