// Rewrites artist bios into a standardized 3-5 sentence format for the
// fully-booked lineup email, so all artists in the same email read uniformly
// regardless of how long or short their original bio was. Uses the same
// Claude API connection as the artist chatbot. Falls back to a plain
// mechanical trim (never invents anything, never fails the email) if the API
// key isn't configured, the call fails, or the response can't be parsed.
import { config } from "../config.js";
import { standardizeBio } from "../lib/drafts.js";

const PROMPT_HEADER = `You write standardized artist bios for The Bunker Performance Lounge's promotional emails to press and media contacts.

For each artist bio below, rewrite it as a polished, professional bio of 3 to 5 sentences, in the third person. Summarize if the original runs long. Expand tastefully if it runs short, using only what's stated in the source text — never invent shows, awards, influences, or any other detail not present in the original. Where the original mentions notable performances, awards, or musical influences/style, make sure those come through clearly in the rewrite. Never use em dashes. Keep a consistent tone and a similar length across every artist in this batch, since they'll appear together in the same email and should read uniformly.

Respond with ONLY a JSON array, in the same order given, of objects shaped exactly like {"name": "...", "bio": "..."}. No markdown formatting, no code fences, no commentary before or after the array.

Artists:
`;

export async function rewriteBiosForPromo(entries) {
  // entries: [{ name, bio }], only artists with a real source bio.
  const out = {};
  if (!entries.length) return out;

  if (!config.anthropicKey) {
    entries.forEach((e) => { out[e.name] = standardizeBio(e.bio); });
    return out;
  }

  try {
    const prompt = PROMPT_HEADER + entries.map((e, i) => `${i + 1}. ${e.name}: ${e.bio}`).join("\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": config.anthropicKey,
      },
      body: JSON.stringify({ model: config.anthropicModel, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const cleaned = text.replace(/^```(json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Unexpected response shape from bio rewrite.");
    parsed.forEach((item) => {
      if (item && item.name && item.bio) out[item.name] = String(item.bio).trim();
    });
  } catch (e) {
    console.error("Bio rewrite failed, falling back to a plain trim:", e?.message || e);
  }

  // Anything the AI didn't return (parse mismatch, a dropped entry, or the
  // whole call failing) still gets a bio via the mechanical fallback, so the
  // email is never left with a gap where a real bio was available.
  entries.forEach((e) => { if (!out[e.name]) out[e.name] = standardizeBio(e.bio); });
  return out;
}
