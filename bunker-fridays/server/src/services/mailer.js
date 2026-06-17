// Transactional email via Resend. Two distinct uses:
//  1. AUTH emails (verification, password reset) — system-generated, sent automatically.
//  2. BOOKING drafts — NEVER sent automatically. Only the explicit
//     POST /api/admin/drafts/:id/send route (a venue click) reaches sendEmail
//     for a draft. Non-negotiable per spec §2.
import { config } from "../config.js";

export const mailerEnabled = () => !!config.resendKey;

export async function sendEmail({ to, subject, text, html }) {
  if (!config.resendKey) {
    return { ok: false, error: "Email sending is not configured (RESEND_API_KEY). Use the mailto link or copy the draft." };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.resendKey}` },
    body: JSON.stringify({ from: config.fromEmail, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: `Email provider error (${res.status})`, detail: detail.slice(0, 300) };
  }
  return { ok: true };
}

export async function sendAuthEmail(to, subject, lines) {
  return sendEmail({ to, subject, text: lines.join("\n") });
}
