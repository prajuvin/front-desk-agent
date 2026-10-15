const test = require("node:test");
const assert = require("node:assert");
const FD = require("../public/rules.js");
const { respond } = require("../api/chat.js");

const profile = FD.validateProfile({ name: "Test Salon", hours: "Mon to Fri, 9 to 5", services: [{ name: "Pedicure", price: "$55" }] });

test("detects each launch language from one message", () => {
  const cases = {
    en: "What are your hours?",
    zh: "你们几点开门？",
    yue: "修腳幾錢呀？",
    tl: "Magkano po ang pedicure?",
    es: "¿Puedo reservar para el sábado?",
    ta: "நீங்கள் எத்தனை மணிக்கு திறப்பீர்கள்?",
    pt: "Vocês fazem unhas para casamento?",
  };
  for (const [lang, msg] of Object.entries(cases)) assert.strictEqual(FD.detectLanguage(msg), lang, msg);
});

test("Spanish and Portuguese are told apart", () => {
  assert.strictEqual(FD.detectLanguage("Quanto custa a manicure?"), "pt");
  assert.strictEqual(FD.detectLanguage("¿Cuánto cuesta la manicura?"), "es");
  assert.strictEqual(FD.detectLanguage("Quiero una cita mañana"), "es");
  assert.strictEqual(FD.detectLanguage("Posso marcar amanhã?"), "pt");
});

test("rules answer in the customer's language, with an English summary for the owner", () => {
  const es = FD.rulesReply(profile, "¿Puedo reservar para el sábado?");
  assert.strictEqual(es.language, "es");
  assert.strictEqual(es.outcome, "booking");
  assert.match(es.reply, /cita/);
  assert.match(es.summary_en, /Wants to book.*\(in Spanish\)/);

  const ta = FD.rulesReply(profile, "நீங்கள் எத்தனை மணிக்கு திறப்பீர்கள்? நேரம்?");
  assert.strictEqual(ta.language, "ta");
  assert.strictEqual(ta.outcome, "answered");
  assert.match(ta.reply, /Mon to Fri, 9 to 5/, "business details are kept exactly as written");

  const zh = FD.rulesReply(profile, "修脚多少钱？");
  assert.strictEqual(zh.language, "zh");
  assert.match(zh.reply, /\$55/);

  const tl = FD.rulesReply(profile, "Pwede po ba kayo sa kasal?");
  assert.strictEqual(tl.language, "tl");
  assert.strictEqual(tl.outcome, "needs_owner");
  assert.match(tl.reply, /ipinasa/);
});

test("prompt tells the AI the customer's language and asks for an English summary", () => {
  const s = FD.buildSystemPrompt(profile, "ta");
  assert.match(s, /looks like Tamil/);
  assert.match(s, /keep every price, time and number exactly as written/);
  assert.match(s, /summary_en/);
  assert.match(FD.buildSystemPrompt(profile, "xx"), /looks like English/, "unknown codes fall back to English");
});

test("parseModelReply keeps a valid language and summary, drops invented ones", () => {
  const ok = FD.parseModelReply('{"reply":"Hola","outcome":"answered","language":"es","summary_en":"Asked about hours."}');
  assert.strictEqual(ok.language, "es");
  assert.strictEqual(ok.summary_en, "Asked about hours.");
  const bad = FD.parseModelReply('{"reply":"Hi","outcome":"answered","language":"klingon"}');
  assert.strictEqual(bad.language, undefined);
});

test("API returns the language and summary, and the owner's webhook gets them in English", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    if (url.includes("hooks")) return { ok: true, status: 200, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: '{"reply":"¿Qué hora le conviene el sábado?","outcome":"booking","language":"es","summary_en":"Wants a pedicure on Saturday."}' }] }) };
  };
  const out = await respond({ message: "¿Puedo reservar una pedicura el sábado?" }, { ANTHROPIC_API_KEY: "k", OWNER_WEBHOOK_URL: "https://hooks.example.com/x" }, fetchImpl);
  assert.strictEqual(out.json.language, "es");
  assert.strictEqual(out.json.languageName, "Spanish");
  assert.strictEqual(out.json.summaryEn, "Wants a pedicure on Saturday.");
  assert.match(calls[0].body.system, /looks like Spanish/);
  const hook = calls.find((c) => c.url.includes("hooks")).body;
  assert.strictEqual(hook.summaryEn, "Wants a pedicure on Saturday.");
  assert.strictEqual(hook.languageName, "Spanish");
});

test("without a key, the API still answers in the customer's language", async () => {
  const out = await respond({ message: "Magkano po ang pedicure?" }, {}, async () => { throw new Error("no network"); });
  assert.strictEqual(out.json.mode, "rules");
  assert.strictEqual(out.json.language, "tl");
  assert.match(out.json.reply, /Ito po/);
  assert.match(out.json.summaryEn, /\(in Tagalog\)/);
});
