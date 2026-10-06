import { describe, it, expect } from "vitest";
import { renderEmail, type EmailPayload } from "./emailTemplates";

describe("renderEmail", () => {
  it("researcher-verify-email: subject is specific, verifyUrl appears in both text and html", () => {
    const rendered = renderEmail({
      template: "researcher-verify-email",
      name: "Asha",
      verifyUrl: "https://meeronbi.org/verify/abc123",
    });
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.subject).toMatch(/verify/i);
    expect(rendered.text).toContain("https://meeronbi.org/verify/abc123");
    expect(rendered.html).toContain("https://meeronbi.org/verify/abc123");
  });

  it("researcher-request-submitted: reviewUrl appears in both, purpose carried through", () => {
    const rendered = renderEmail({
      template: "researcher-request-submitted",
      researcherName: "Dr. Rao",
      researcherEmail: "rao@univ.edu",
      institution: "Example University",
      purpose: "Studying maternal health outcomes",
      reviewUrl: "https://meeronbi.org/admin/researchers/1",
    });
    expect(rendered.subject).toMatch(/researcher/i);
    expect(rendered.text).toContain("https://meeronbi.org/admin/researchers/1");
    expect(rendered.html).toContain("https://meeronbi.org/admin/researchers/1");
    expect(rendered.text).toContain("Studying maternal health outcomes");
    expect(rendered.html).toContain("Studying maternal health outcomes");
  });

  it("researcher-approved: signInUrl appears in both", () => {
    const rendered = renderEmail({
      template: "researcher-approved",
      name: "Dr. Rao",
      signInUrl: "https://meeronbi.org/signin",
    });
    expect(rendered.subject).toMatch(/approved/i);
    expect(rendered.text).toContain("https://meeronbi.org/signin");
    expect(rendered.html).toContain("https://meeronbi.org/signin");
  });

  it("researcher-rejected: with a reviewNote, the note appears in both", () => {
    const rendered = renderEmail({
      template: "researcher-rejected",
      name: "Dr. Rao",
      reviewNote: "Purpose did not match an approved research category.",
    });
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.text).toContain("Purpose did not match an approved research category.");
    expect(rendered.html).toContain("Purpose did not match an approved research category.");
  });

  it("researcher-rejected: without a reviewNote, the body doesn't render the literal string 'undefined'", () => {
    const rendered = renderEmail({ template: "researcher-rejected", name: "Dr. Rao" });
    expect(rendered.text).not.toContain("undefined");
    expect(rendered.html).not.toContain("undefined");
  });

  it("facility-admin-invite: setPasswordUrl appears in both", () => {
    const rendered = renderEmail({
      template: "facility-admin-invite",
      name: "Priya",
      facilityName: "RIMS Imphal",
      setPasswordUrl: "https://meeronbi.org/set-password/tok",
      expiresInDays: 7,
    });
    expect(rendered.subject).toMatch(/invited/i);
    expect(rendered.text).toContain("https://meeronbi.org/set-password/tok");
    expect(rendered.html).toContain("https://meeronbi.org/set-password/tok");
  });

  it("patient-portal-invite: setPasswordUrl appears in both", () => {
    const rendered = renderEmail({
      template: "patient-portal-invite",
      name: "Tombi",
      facilityName: "RIMS Imphal",
      setPasswordUrl: "https://meeronbi.org/set-password/tok2",
      expiresInDays: 14,
    });
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.text).toContain("https://meeronbi.org/set-password/tok2");
    expect(rendered.html).toContain("https://meeronbi.org/set-password/tok2");
  });

  it("password-reset: resetUrl appears in both", () => {
    const rendered = renderEmail({
      template: "password-reset",
      name: "Priya",
      resetUrl: "https://meeronbi.org/reset/tok3",
      expiresInMinutes: 30,
    });
    expect(rendered.subject).toMatch(/reset/i);
    expect(rendered.text).toContain("https://meeronbi.org/reset/tok3");
    expect(rendered.html).toContain("https://meeronbi.org/reset/tok3");
  });

  it("password-changed: supportHint appears in both", () => {
    const rendered = renderEmail({
      template: "password-changed",
      name: "Priya",
      supportHint: "contact your facility admin immediately.",
    });
    expect(rendered.subject).toMatch(/password/i);
    expect(rendered.text).toContain("contact your facility admin immediately.");
    expect(rendered.html).toContain("contact your facility admin immediately.");
  });

  it("google-account-linked: googleEmail appears in both", () => {
    const rendered = renderEmail({
      template: "google-account-linked",
      name: "Priya",
      googleEmail: "priya@gmail.com",
      supportHint: "contact your facility admin immediately.",
    });
    expect(rendered.subject).toMatch(/google/i);
    expect(rendered.text).toContain("priya@gmail.com");
    expect(rendered.html).toContain("priya@gmail.com");
  });

  it("escapes a script-tag purpose so it never appears raw in html", () => {
    const payload: EmailPayload = {
      template: "researcher-request-submitted",
      researcherName: "Attacker",
      researcherEmail: "a@b.com",
      institution: "N/A",
      purpose: "<script>alert(1)</script>",
      reviewUrl: "https://meeronbi.org/x",
    };
    const rendered = renderEmail(payload);
    expect(rendered.html).not.toContain("<script>alert(1)</script>");
    expect(rendered.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes & exactly once — a name with & becomes &amp;, never &amp;amp;", () => {
    const rendered = renderEmail({
      template: "researcher-approved",
      name: "Smith & Jones",
      signInUrl: "https://meeronbi.org/signin",
    });
    expect(rendered.html).toContain("Smith &amp; Jones");
    expect(rendered.html).not.toContain("&amp;amp;");
  });
});
