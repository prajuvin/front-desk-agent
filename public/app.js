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
  function bubble(who, text, cls, note) {
    var d = el("div", "b " + cls);
    d.appendChild(el("span", "who", who));
    d.appendChild(el("span", null, text));
    if (note) d.appendChild(el("span", "note", note));
    $("chat").appendChild(d); $("chat").scrollTop = $("chat").scrollHeight;
  }
  function greet() {
    bubble("Automated helper", "Hi! I'm the automated helper for " + (FD.validateProfile(profile()).name) + ". Ask me about hours, prices, or booking.", "bot");
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
    var btn = $("send"); btn.setAttribute("aria-busy", "true"); btn.disabled = true;
    var p = profile();
    var done = function (r, mode) {
      btn.removeAttribute("aria-busy"); btn.disabled = false;
      var note = r.outcome === "booking" ? (r.ownerNotified ? "Sent to the owner." : "Booking request noted.") :
                 r.outcome === "needs_owner" ? (r.ownerNotified ? "Passed to the owner." : "Flagged for the owner.") : "";
      bubble("Automated helper", r.reply, "bot", note);
      history.push({ role: "user", content: q }, { role: "assistant", content: r.reply });
      log.unshift({ q: q, outcome: r.outcome, at: new Date() });
      setMode(mode);
    };
    var offline = function () { done(FD.rulesReply(FD.validateProfile(p), q), "offline"); };
    if (online === false) return offline();
    fetch("api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: q, history: history, profile: p }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        online = true;
        if (!x.ok) { btn.removeAttribute("aria-busy"); btn.disabled = false; $("err").textContent = x.j.error || "Something went wrong. Try again."; $("err").hidden = false; return; }
        done(x.j, x.j.mode);
      })
      .catch(function () { online = false; offline(); });
  }
  ["What are your hours?", "How much is a pedicure?", "Can I book for Saturday?", "Do you do nails for a wedding party?"].forEach(function (q) {
    var b = el("button", "chip", q); b.type = "button";
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
      d.appendChild(el("span", "time", m.at.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })));
      var q = el("p", null, "“" + m.q + "”"); q.style.margin = "6px 0 0"; d.appendChild(q);
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
