// Cloudflare Turnstile verification (§2). When no secret is configured the
// check is skipped (local dev / soft launch behind a private URL).
import { config } from "../config.js";

export async function verifyTurnstile(token, ip) {
  if (!config.turnstileSecret) return { ok: true, skipped: true };
  if (!token) return { ok: false };
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: config.turnstileSecret, response: token, remoteip: ip || "" }),
    });
    const data = await res.json();
    return { ok: !!data.success };
  } catch {
    return { ok: false };
  }
}
