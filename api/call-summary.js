/* POST /api/call-summary  <- ElevenLabs "post-call transcription" webhook
   Turns a finished phone call (in any launch language) into one English line for the owner,
   then forwards it to OWNER_WEBHOOK_URL (Zapier, Make, Slack, Discord, or a Twilio text flow).
   Env:
     OWNER_WEBHOOK_URL            where the English summary goes
     ELEVENLABS_WEBHOOK_SECRET    optional: if set, the ElevenLabs-Signature header must match
   Payload fields read (all optional): data.transcript[{role, message}], data.analysis.transcript_summary,
   data.metadata.phone_call.external_number, data.conversation_id */
const crypto = require("crypto");
const FD = require("../public/rules.js");
const lockedProfile = require("../business.json");

const MAX_AGE_SECONDS = 30 * 60;

function signatureOk(raw, header, secret, now) {
  if (!secret) return true;
  const parts = Object.fromEntries(String(header || "").split(",").map((p) => p.split("=").map((x) => x.trim())));
  const t = Number(parts.t), v0 = parts.v0;
  if (!t || !v0) return false;
  if (Math.abs((now || Date.now() / 1000) - t) > MAX_AGE_SECONDS) return false;
  const want = crypto.createHmac("sha256", secret).update(t + "." + raw).digest("hex");
  return v0.length === want.length && crypto.timingSafeEqual(Buffer.from(v0), Buffer.from(want));
}

function summarise(body) {
  const data = (body && body.data) || {};
  const turns = Array.isArray(data.transcript) ? data.transcript : [];
  const callerLines = turns.filter((t) => t && t.role === "user" && t.message).map((t) => String(t.message));
  const language = FD.detectLanguage(callerLines.join(" "));
  const given = String((data.analysis && data.analysis.transcript_summary) || "").replace(/\s+/g, " ").trim();
  const first = (callerLines[0] || "").slice(0, 160);
  const summaryEn = given
    ? given.slice(0, 400)
    : callerLines.length
      ? "Caller spoke " + FD.langName(language) + ". No AI summary was attached, so here is the first thing they said: \"" + first + "\""
      : "A call came in but the caller didn't say anything.";
  const caller = (data.metadata && data.metadata.phone_call && data.metadata.phone_call.external_number) || "unknown number";
  return { language, languageName: FD.langName(language), summaryEn, caller, conversationId: data.conversation_id || null, callerLines };
}

async function handle(raw, headers, env, fetchImpl, now) {
  if (!signatureOk(raw, headers["elevenlabs-signature"], env.ELEVENLABS_WEBHOOK_SECRET, now)) return { status: 401, json: { error: "Signature didn't match." } };
  let body;
  try { body = JSON.parse(raw || "{}"); } catch (e) { return { status: 400, json: { error: "Body must be JSON." } }; }
  const s = summarise(body);
  let notified = false;
  if (env.OWNER_WEBHOOK_URL) {
    try {
      const r = await fetchImpl(env.OWNER_WEBHOOK_URL, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ business: lockedProfile.name, channel: "phone", caller: s.caller, language: s.language, languageName: s.languageName, summaryEn: s.summaryEn, conversationId: s.conversationId, at: new Date().toISOString() }),
      });
      notified = r.ok;
    } catch (e) { notified = false; }
  }
  return { status: 200, json: { language: s.language, languageName: s.languageName, summaryEn: s.summaryEn, ownerNotified: notified } };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("allow", "POST"); return res.end(); }
  // Read the raw body ourselves (never req.body): the signature is computed over the exact bytes sent.
  const raw = typeof req.rawBody === "string" ? req.rawBody : await new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => { buf += c; if (buf.length > 200000) req.destroy(); });
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
  const out = await handle(raw, req.headers || {}, process.env, fetch);
  res.statusCode = out.status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(out.json));
};
module.exports.handle = handle;
module.exports.summarise = summarise;
module.exports.signatureOk = signatureOk;
