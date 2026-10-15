const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { handle, summarise, signatureOk } = require("../api/call-summary.js");

const call = (transcript, summary) => JSON.stringify({
  type: "post_call_transcription",
  data: { conversation_id: "c1", transcript, analysis: summary ? { transcript_summary: summary } : {}, metadata: { phone_call: { external_number: "+14165550100" } } },
});

test("uses the agent's English summary and spots the caller's language", () => {
  const s = summarise(JSON.parse(call([{ role: "agent", message: "Hello" }, { role: "user", message: "வணக்கம், நாளை நேரம் இருக்கிறதா?" }], "Caller wants an appointment tomorrow.")));
  assert.strictEqual(s.language, "ta");
  assert.strictEqual(s.summaryEn, "Caller wants an appointment tomorrow.");
  assert.strictEqual(s.caller, "+14165550100");
});

test("without a summary, falls back to the caller's first words", () => {
  const s = summarise(JSON.parse(call([{ role: "user", message: "Hola, ¿cuánto cuesta un cambio de aceite?" }])));
  assert.strictEqual(s.languageName, "Spanish");
  assert.match(s.summaryEn, /Caller spoke Spanish/);
  assert.match(s.summaryEn, /cambio de aceite/);
});

test("forwards the English line to the owner's webhook", async () => {
  const sent = [];
  const fetchImpl = async (url, opts) => { sent.push({ url, body: JSON.parse(opts.body) }); return { ok: true }; };
  const out = await handle(call([{ role: "user", message: "Magkano po ang pedicure?" }], "Asked the price of a pedicure."), {}, { OWNER_WEBHOOK_URL: "https://hooks.example.com/x" }, fetchImpl);
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.json.ownerNotified, true);
  assert.strictEqual(sent[0].body.channel, "phone");
  assert.strictEqual(sent[0].body.languageName, "Tagalog");
  assert.strictEqual(sent[0].body.summaryEn, "Asked the price of a pedicure.");
});

test("rejects calls whose signature doesn't match when a secret is set", async () => {
  const raw = call([{ role: "user", message: "hi" }], "Said hi.");
  const now = 1_800_000_000;
  const good = "t=" + now + ",v0=" + crypto.createHmac("sha256", "s3cret").update(now + "." + raw).digest("hex");
  assert.strictEqual(signatureOk(raw, good, "s3cret", now), true);
  assert.strictEqual(signatureOk(raw, good, "wrong", now), false);
  assert.strictEqual(signatureOk(raw, good, "s3cret", now + 3600), false, "old signatures are refused");
  assert.strictEqual((await handle(raw, { "elevenlabs-signature": "t=1,v0=abc" }, { ELEVENLABS_WEBHOOK_SECRET: "s3cret" }, async () => ({ ok: true }))).status, 401);
});

test("bad JSON is a clear 400", async () => {
  assert.strictEqual((await handle("not json", {}, {}, async () => ({ ok: true }))).status, 400);
});
