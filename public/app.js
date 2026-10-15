(function () {
  var $ = function (id) { return document.getElementById(id); };
  var FD = window.FrontDesk;
  var EXAMPLE = {
    name: "Sunrise Nails (example)",
    hours: "Tuesday to Saturday, 10am to 6pm. Closed Sunday and Monday.",
    services: "Gel manicure - $45\nPedicure - $55\nNail repair - $10 per nail",
    policies: "Please arrive 5 minutes early. Cancel at least 24 hours ahead."
  };
  var LABEL = { answered: "Answered", booking: "Wants to book", needs_owner: "Needs you" };
  var history = [], log = [], online = null;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ---------- setup form ----------
  ["name", "hours", "services", "policies"].forEach(function (k) {
    $(k).value = store("fd-" + k) || EXAMPLE[k];
    $(k).addEventListener("input", function () { store("fd-" + k, $(k).value); });
  });
  function profile() {
    return {
      name: $("name").value, hours: $("hours").value, policies: $("policies").value,
      services: $("services").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
        var m = l.split(/\s+[-–:]\s+/); return { name: m[0], price: m.slice(1).join(" - ") };
      })
    };
  }

  // ---------- steps ----------
  function show(id) {
    ["p1", "p2", "p3"].forEach(function (p) { $(p).hidden = p !== id; });
    document.querySelectorAll(".step").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.p === id ? "true" : "false"); });
    if (id === "p2" && !$("chat").children.length) greet();
    if (id === "p3") renderLog();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".step").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.p); }); });
  $("to2").addEventListener("click", function () { show("p2"); });

  // ---------- chat ----------
  var BCP = { en: "en", zh: "zh-Hans", yue: "yue-Hant", tl: "tl", es: "es", ta: "ta", pt: "pt" };
  function bubble(who, text, cls, note, lang, owner) {
    var d = el("div", "b " + cls);
    d.appendChild(el("span", "who", who));
    var t = el("span", null, text);
    if (lang && BCP[lang]) t.lang = BCP[lang];
    d.appendChild(t);
    if (note) d.appendChild(el("span", "note", note));
    if (owner) {
      var o = el("span", "owner");
      o.appendChild(el("b", null, "What you see, in English: "));
      o.appendChild(document.createTextNode(owner));
      d.appendChild(o);
    }
    $("chat").appendChild(d); $("chat").scrollTop = $("chat").scrollHeight;
  }
  function typing(on) {
    var t = $("typing");
    if (t) t.remove();
    if (!on) return;
    t = el("div", "b typing"); t.id = "typing";
    t.appendChild(el("span", "sr", "The helper is typing"));
    for (var i = 0; i < 3; i++) t.appendChild(el("i"));
    $("chat").appendChild(t); $("chat").scrollTop = $("chat").scrollHeight;
  }
  function greet() {
    bubble("Automated helper", "Hi! I'm the automated helper for " + (FD.validateProfile(profile()).name) + ". Ask me about hours, prices, or booking, in English, 中文, 粵語, Tagalog, Español, தமிழ் or Português.", "bot");
  }
  function setMode(m) {
    var box = $("mode");
    if (m === "ai") { box.className = "mode ai"; box.textContent = "Live: answers come from AI, using only your business details."; }
    else if (m === "ai_fallback") { box.className = "mode ai"; box.textContent = "Live, with a safety net: the AI couldn't answer that one safely, so a simple rule answered and the owner was told."; }
    else if (m === "rules") { box.className = "mode"; box.textContent = "Simple mode: no AI key is set up yet, so it answers with basic keyword rules."; }
    else { box.className = "mode"; box.textContent = "Offline practice mode: nothing is sent anywhere. Answers use basic keyword rules."; }
  }

  function ask(q) {
    q = (q || "").trim();
    if (!q) { $("err").textContent = "Type a question first."; $("err").hidden = false; return; }
    $("err").hidden = true;
    bubble("You", q, "me");
    var btn = $("send"); btn.setAttribute("aria-busy", "true"); btn.disabled = true; typing(true);
    var p = profile();
    var done = function (r, mode) {
      typing(false);
      btn.removeAttribute("aria-busy"); btn.disabled = false;
      var note = r.outcome === "booking" ? (r.ownerNotified ? "Sent to the owner." : "Booking request noted.") :
                 r.outcome === "needs_owner" ? (r.ownerNotified ? "Passed to the owner." : "Flagged for the owner.") : "";
      var lang = r.language || "en", summary = r.summaryEn || r.summary_en || "";
      bubble("Automated helper", r.reply, "bot", note, lang, !summary ? "" : summary.indexOf("(in ") > -1 || lang === "en" ? summary : FD.langName(lang) + ". " + summary);
      history.push({ role: "user", content: q }, { role: "assistant", content: r.reply });
      log.unshift({ q: q, outcome: r.outcome, at: new Date(), lang: lang, summary: summary });
      setMode(mode);
    };
    var offline = function () { done(FD.rulesReply(FD.validateProfile(p), q), "offline"); };
    if (online === false) return offline();
    fetch("api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, history: history, profile: p }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        online = true;
        if (!x.ok) { typing(false); btn.removeAttribute("aria-busy"); btn.disabled = false; $("err").textContent = x.j.error || "Something went wrong. Try again."; $("err").hidden = false; return; }
        done(x.j, x.j.mode);
      })
      .catch(function () { online = false; offline(); });
  }
  [["What are your hours?", "en"], ["你们几点开门？", "zh"], ["修腳幾錢呀？", "yue"], ["Magkano po ang pedicure?", "tl"], ["¿Puedo reservar para el sábado?", "es"], ["நீங்கள் எத்தனை மணிக்கு திறப்பீர்கள்?", "ta"], ["Vocês fazem unhas para casamento?", "pt"]].forEach(function (pair) {
    var q = pair[0];
    var b = el("button", "chip", q); b.type = "button"; b.lang = BCP[pair[1]];
    b.addEventListener("click", function () { ask(q); });
    $("chips").appendChild(b);
  });
  $("form").addEventListener("submit", function (e) { e.preventDefault(); var v = $("say").value; $("say").value = ""; ask(v); });

  // ---------- messages ----------
  function renderLog() {
    var c = { answered: 0, booking: 0, needs_owner: 0 }, box = $("log");
    box.textContent = "";
    if (!log.length) { box.appendChild(el("p", null, "No messages yet. Try it out in step 2.")); }
    log.forEach(function (m) {
      c[m.outcome]++;
      var d = el("div", "msg");
      d.appendChild(el("span", "pill p-" + m.outcome, LABEL[m.outcome]));
      if (m.lang) d.appendChild(el("span", "pill p-lang", FD.langName(m.lang)));
      d.appendChild(el("span", "time", m.at.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })));
      var q = el("p", null, "“" + m.q + "”"); q.style.margin = "6px 0 0"; if (m.lang) q.lang = BCP[m.lang]; d.appendChild(q);
      if (m.summary) { var en = el("p", "owner", m.summary); en.style.margin = "4px 0 0"; d.appendChild(en); }
      box.appendChild(d);
    });
    $("cA").textContent = c.answered; $("cB").textContent = c.booking; $("cN").textContent = c.needs_owner;
  }

  // Detect whether the real endpoint is reachable (it is on Vercel or `node server.js`; not when opened as a file)
  if (location.protocol === "file:") { online = false; setMode("offline"); }
  else fetch("api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
    .then(function (r) { online = r.status === 400; setMode(online ? "ready" : "offline"); if (online) $("mode").textContent = "Connected. Ask a question to see which mode it's in."; })
    .catch(function () { online = false; setMode("offline"); });
})();
