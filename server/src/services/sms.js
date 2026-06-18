// Twilio SMS — used for artist booking confirmations when a phone number is on
// file. Gracefully disabled when TWILIO_* vars are absent; the rest of the
// confirm flow (email draft, push) still runs.
import { config } from "../config.js";

export const smsEnabled = () =>
  !!(config.twilio.accountSid && config.twilio.authToken && config.twilio.fromNumber);

function cleanPhone(raw) {
  // Strip everything except digits and leading +. If no country code, assume +1 (Canada/US).
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export async function sendSms(toRaw, body) {
  if (!smsEnabled()) return { ok: false, skipped: true, reason: "SMS not configured" };
  const to = cleanPhone(toRaw);
  if (!to) return { ok: false, skipped: true, reason: "No valid phone number" };

  const { accountSid, authToken, fromNumber } = config.twilio;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const creds = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const form = new URLSearchParams({ To: to, From: fromNumber, Body: body });
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return { ok: false, error: `Twilio error ${res.status}`, detail: detail.message || "" };
  }
  return { ok: true };
}

export function confirmSmsBody(name, date, slotTime, infoEmail) {
  const slot = slotTime ? ` at ${slotTime}` : "";
  return `Hi ${name}, you're confirmed at The Bunker for ${date}${slot}. Full details coming by email. Questions: ${infoEmail}`;
}
