import "server-only";
import { Resend } from "resend";

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const FROM = process.env.MAIL_FROM ?? "Vision <vision@aashishkarki.com>";
const REPLY_TO = process.env.MAIL_REPLY_TO ?? undefined;
const NOTIFY_TO = process.env.MAIL_NOTIFY_TO ?? REPLY_TO;

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** The invite email with the one-time demo link. Sent to the person who signed up. */
export async function sendInviteEmail(to: string, name: string, link: string) {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#1a1a1a">
      <p>Hi ${esc(name || "there")},</p>
      <p>Thanks for your interest in <b>Vision</b> — my tool for seeing how AI answer engines
      (ChatGPT, Gemini, Perplexity, Google AI Overview & AI Mode) talk about your brand versus
      your competitors.</p>
      <p>Here's your personal demo link. It's a <b>one-time demo</b>: you can run up to
      <b>3 prompts</b> once, to see the idea in action.</p>
      <p style="margin:24px 0">
        <a href="${esc(link)}" style="background:#0b1f3a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open your Vision demo</a>
      </p>
      <p style="color:#666;font-size:13px">Or paste this into your browser:<br>${esc(link)}</p>
      <p>— Aashish</p>
    </div>`;
  return client().emails.send({
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject: "Your Vision demo link (3-prompt trial)",
    html,
  });
}

/** Optional heads-up to Aashish that someone requested a demo. */
export async function notifyNewInvite(input: { name: string; email: string; company: string }) {
  if (!NOTIFY_TO) return;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1a1a1a">
      <p><b>New Vision demo request</b></p>
      <ul>
        <li>Name: ${esc(input.name)}</li>
        <li>Email: ${esc(input.email)}</li>
        <li>Company: ${esc(input.company)}</li>
      </ul>
    </div>`;
  return client().emails.send({
    from: FROM,
    to: NOTIFY_TO,
    replyTo: input.email,
    subject: "New Vision demo request",
    html,
  });
}

/** The "Requested for Setup (Tried Demo)" lead — from the WhatsApp click or get-in-touch form. */
export async function sendLeadEmail(input: {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  source: string;
}) {
  if (!NOTIFY_TO) throw new Error("MAIL_NOTIFY_TO is not set");
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1a1a1a">
      <p><b>Someone who tried the demo wants a full setup.</b></p>
      <ul>
        <li>Name: ${esc(input.name ?? "-")}</li>
        <li>Email: ${esc(input.email ?? "-")}</li>
        <li>Company: ${esc(input.company ?? "-")}</li>
        <li>Phone: ${esc(input.phone ?? "-")}</li>
        <li>Via: ${esc(input.source)}</li>
      </ul>
    </div>`;
  return client().emails.send({
    from: FROM,
    to: NOTIFY_TO,
    replyTo: input.email || REPLY_TO,
    subject: "Requested for Setup (Tried Demo)",
    html,
  });
}
