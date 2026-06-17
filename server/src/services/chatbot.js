// Chatbot (§8): server-side Claude call. Knowledge = CORE_FACTS + venue-editable
// block. The bot answers only from knowledge; anything uncovered escalates.
// Server-side fixes the mobile failure seen in the prototype (no browser CORS/key issues).
import { config } from "../config.js";
import { CORE_FACTS, INFO_EMAIL } from "../lib/knowledge.js";
import { getKb, addEscalation } from "./store.js";

export async function chat({ history, contact }) {
  // Accept either {text} or {content} from the client so a field-name mismatch
  // can't silently blank the conversation.
  history = (history || []).map((m) => ({ role: m.role, text: m.text ?? m.content ?? "" }));
  const q = history[history.length - 1]?.text || "";
  const kb = await getKb();
  const convo = history.map((m) => `${m.role === "user" ? "ARTIST" : "ASSISTANT"}: ${m.text}`).join("\n");
  const prompt = `You are the booking assistant for The Bunker Performance Lounge. Answer the artist's latest question using ONLY the knowledge below. Be friendly and brief (2 to 4 sentences). Never use em dashes. Never guess or invent details that are not in the knowledge.

If the knowledge does not clearly cover the question, respond with exactly this on the first line: [ESCALATE]
Then one short sentence telling the artist a human from the venue will follow up by email.

=== KNOWLEDGE: CORE FACTS ===
${CORE_FACTS}

=== KNOWLEDGE: EXTRA VENUE NOTES ===
${kb}

=== CONVERSATION ===
${convo}

Respond to the last ARTIST message now.`;

  const escalate = async (replyText, errorDetail) => {
    const summary = history.slice(-6).map((m) => `${m.role}: ${m.text}`).join("\n") +
      (errorDetail ? `\n\n[technical: ${errorDetail}]` : "");
    await addEscalation({ question: q, contact: contact || "guest (no contact captured in chat)", summary });
    const mailBody = encodeURIComponent(`Unanswered artist question from the Bunker Fridays app\n\nQuestion: ${q}\nContact: ${contact || "guest"}\n\nRecent conversation:\n${summary}`);
    return {
      text: replyText,
      escalated: true,
      mailto: `mailto:${INFO_EMAIL}?subject=${encodeURIComponent("Artist question needs a human: " + q.slice(0, 60))}&body=${mailBody}`,
    };
  };

  if (!config.anthropicKey) {
    return escalate("The assistant isn't configured yet, so I've logged your question for a human from the venue to follow up by email.", "ANTHROPIC_API_KEY missing");
  }

  const callApi = async () => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": config.anthropicKey,
      },
      body: JSON.stringify({ model: config.anthropicModel, max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { res, data };
  };

  try {
    let { res, data } = await callApi();
    if (!res.ok || !data || data.error) {
      await new Promise((r) => setTimeout(r, 800)); // one retry for transient failures
      ({ res, data } = await callApi());
    }
    if (!res.ok || !data || data.error) {
      const detail = data?.error?.message || data?.error?.type || `HTTP ${res.status}`;
      return escalate("I'm having trouble reaching the assistant right now, so I've logged your question for a human from the venue to follow up by email. You can also email us directly below.", detail);
    }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) return escalate("I couldn't process that one, so a human from the venue will follow up by email.");
    if (text.startsWith("[ESCALATE]")) {
      const reply = text.replace("[ESCALATE]", "").trim() || "Good question. I don't have a reliable answer for that, so a human from the venue will follow up with you by email.";
      return escalate(reply);
    }
    return { text, escalated: false };
  } catch (e) {
    return escalate("I couldn't reach the assistant. Your question is logged, and you can email the venue directly below.", String(e?.message || e));
  }
}
