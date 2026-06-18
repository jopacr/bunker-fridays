// Central config. Everything optional degrades gracefully and is reported at boot.
const env = process.env;

export const config = {
  port: Number(env.PORT || 8080),
  databaseUrl: env.DATABASE_URL || "postgres://bunker:bunker@127.0.0.1:5432/bunker",
  baseUrl: (env.BASE_URL || "http://localhost:8080").replace(/\/$/, ""),
  cookieSecure: env.COOKIE_SECURE !== "false" && (env.BASE_URL || "").startsWith("https"),

  // Anthropic (chatbot, §8). Server-side only; never exposed to the client.
  anthropicKey: env.ANTHROPIC_API_KEY || "",
  anthropicModel: env.ANTHROPIC_MODEL || "claude-sonnet-4-6",

  // Resend (email drafts are NEVER auto-sent; this powers explicit-click send + auth emails)
  resendKey: env.RESEND_API_KEY || "",
  fromEmail: env.FROM_EMAIL || "The Bunker <bookings@bunkerstratford.com>",
  infoEmail: env.INFO_EMAIL || "info@bunkerstratford.com",

  // Twilio (SMS confirmations to artists with a phone number on file)
  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID || "",
    authToken: env.TWILIO_AUTH_TOKEN || "",
    fromNumber: env.TWILIO_FROM_NUMBER || "",
  },
  turnstileSecret: env.TURNSTILE_SECRET || "",
  turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",

  // Cloudflare R2 presigned uploads (§2 photos)
  r2: {
    accountId: env.R2_ACCOUNT_ID || "",
    accessKeyId: env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || "",
    bucket: env.R2_BUCKET || "bunker-photos",
    publicBase: (env.R2_PUBLIC_BASE || "").replace(/\/$/, ""), // e.g. https://photos.bunkerstratford.com
  },

  // Web Push VAPID (§2 push)
  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY || "",
    privateKey: env.VAPID_PRIVATE_KEY || "",
    subject: env.VAPID_SUBJECT || "mailto:info@bunkerstratford.com",
  },

  // Wix Automations webhook shared secret (§7)
  wixWebhookSecret: env.WIX_WEBHOOK_SECRET || "",

  sessionDays: { artist: 30, admin: 1 },
};

export function bootReport() {
  const off = [];
  if (!config.anthropicKey) off.push("chatbot (ANTHROPIC_API_KEY)");
  if (!config.resendKey) off.push("email sending (RESEND_API_KEY) — drafts still work, mailto/copy only");
  if (!config.twilio.accountSid) off.push("SMS (TWILIO_ACCOUNT_SID) — confirmations will be email/push only");
  if (!config.r2.accessKeyId) off.push("photo uploads (R2_*)");
  if (!config.vapid.publicKey) off.push("push notifications (VAPID_*)");
  if (!config.wixWebhookSecret) off.push("Wix webhook (WIX_WEBHOOK_SECRET)");
  return off;
}
