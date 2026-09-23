/* POST /api/chat  { message, history?, profile? } -> { reply, outcome, mode }
   Runs as a Vercel serverless function, or through server.js locally.
   Env:
     ANTHROPIC_API_KEY   required for AI answers (without it, keyword rules answer)
     CLAUDE_MODEL        default "claude-haiku-4-5" (small, fast, cheap: right for a front desk)
     DEMO_MODE           "true" lets the page send its own business details (for the public demo)
     ANTHROPIC_API_URL   optional override (used by tests)
     OWNER_WEBHOOK_URL   optional: bookings and hand-offs are POSTed here (Zapier, Make, Slack, Discord...) */
const FD = require("../public/rules.js");
const lockedProfile = require("../business.json");

const API_URL = process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages";

async function askClaude({ apiKey, model, system, messages, fetchImpl }) {
  const res = await fetchImpl(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 400, system, messages }),
  });
  if (!res.ok) throw new Error("Claude API " + res.status);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return FD.parseModelReply(text);
}

async function notifyOwner({ url, fetchImpl, payload }) {
  if (!url) return false;
  try {
    const r = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return r.ok;
  } catch (e) { return false; }
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-FD.LIMITS.history)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, FD.LIMITS.reply) }));
}

async function respond(body, env, fetchImpl) {
  const message = String((body && body.message) || "").trim();
  if (!message) return { status: 400, json: { error: "Type a message first." } };
  if (message.length > FD.LIMITS.message) return { status: 400, json: { error: "That message is a bit long. Keep it under 500 characters." } };

  let profile;
  try {
    profile = FD.validateProfile(env.DEMO_MODE === "true" && body.profile ? body.profile : lockedProfile);
  } catch (e) {
    return { status: 400, json: { error: e.message } };
  }

  let result = null, mode = "rules";
  if (env.ANTHROPIC_API_KEY) {
    // Anthropic requires the conversation to start with a user turn.
    const history = cleanHistory(body.history);
    while (history.length && history[0].role !== "user") history.shift();
    const messages = history.concat([{ role: "user", content: message }]);
    try {
      result = await askClaude({ apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL || "claude-haiku-4-5", system: FD.buildSystemPrompt(profile), messages, fetchImpl });
      if (result) mode = "ai";
    } catch (e) {
      result = null; // fall through to the safe rules answer
    }
  }
  if (!result) {
    // No key: plain rules. Key set but the AI failed or broke the format: safe rules answer, labelled as such.
    if (env.ANTHROPIC_API_KEY) mode = "ai_fallback";
    result = FD.rulesReply(profile, message);
  }

  let notified = false;
  if (result.outcome !== "answered") {
    notified = await notifyOwner({
      url: env.OWNER_WEBHOOK_URL, fetchImpl,
      payload: { business: profile.name, outcome: result.outcome, customerMessage: message, reply: result.reply, at: new Date().toISOString() },
    });
  }
  return { status: 200, json: { reply: result.reply, outcome: result.outcome, mode, ownerNotified: notified } };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("allow", "POST"); return res.end(); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const out = await respond(body || {}, process.env, fetch);
  res.statusCode = out.status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(out.json));
};
module.exports.respond = respond;
