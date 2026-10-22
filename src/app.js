"use strict";
/* UI: builds pages from PAGES, runs queries with the engine, marks tasks, and shows the HSC / SQLite
   translation panel after a query runs. */
var ENG = SQLEngine.create(PRACTICE_DB);
var STORE_KEY = "se-hsc-sql-practice-v1";
var STATE = {};
try { STATE = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {}; } catch (e) { STATE = {}; }
function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(STATE)); } catch (e) { /* storage blocked in some iframes */ } }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* ---------- fullscreen ---------- */
(function () {
  var btn = document.getElementById("fullscreen-btn");
  var enter = btn.innerHTML;
  var exit = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"></path><path d="M16 3v3a2 2 0 0 0 2 2h3"></path><path d="M8 21v-3a2 2 0 0 0-2-2H3"></path><path d="M16 21v-3a2 2 0 0 1 2-2h3"></path></svg>';
  btn.addEventListener("click", function () {
    if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
    else if (document.exitFullscreen) document.exitFullscreen();
  });
  document.addEventListener("fullscreenchange", function () { btn.innerHTML = document.fullscreenElement ? exit : enter; });
})();

/* ---------- helpers ---------- */
function pageTasks(p) {
  var t = [].concat(p.tasks || []);
  (p.blocks || []).forEach(function (b) { if (b.task) t.push(b.task); });
  return t;
}
function pageMcqs(p) {
  var m = [].concat(p.checks || []);
  (p.blocks || []).forEach(function (b) { if (b.checks) m = m.concat(b.checks); });
  return m;
}
function pageKeys(p) { return pageTasks(p).filter(function (t) { return !t.optional; }).map(function (t) { return t.key; }).concat(pageMcqs(p).filter(function (m) { return !m.optional; }).map(function (m) { return m.key; })); }
function markDone(key) { STATE[key] = true; saveState(); refreshProgress(); }

function tableHtml(tname) {
  var t = PRACTICE_DB[tname], h = '<div class="tblname">' + esc(tname) + " <small>(" + t.rows.length + " rows)</small></div><div class='tablewrap'><table class='data'><thead><tr>";
  t.cols.forEach(function (c) { h += "<th>" + esc(c.name) + (c.key ? '<span class="key">' + c.key + "</span>" : "") + "</th>"; });
  h += "</tr></thead><tbody>";
  t.rows.forEach(function (r) {
    h += "<tr>";
    t.cols.forEach(function (c) { h += "<td" + (c.type === "num" ? ' class="num"' : "") + ">" + esc(r[c.name]) + "</td>"; });
    h += "</tr>";
  });
  return h + "</tbody></table></div>";
}
function allTablesHtml() { return ["Games", "Publishers", "Developers"].map(tableHtml).join(""); }

function renderResult(el, res) {
  var h = "";
  res.notes.forEach(function (n) { h += '<div class="feedback note" role="note">💡 ' + esc(n) + "</div>"; });
  if (!res.rows.length) h += '<div class="rowcount">No rows matched: 0 rows.</div>';
  else {
    h += '<div class="results"><table class="data"><thead><tr>';
    res.cols.forEach(function (c) { h += "<th>" + esc(c) + "</th>"; });
    h += "</tr></thead><tbody>";
    res.rows.forEach(function (row) {
      h += "<tr>";
      row.forEach(function (v) { h += "<td" + (typeof v === "number" ? ' class="num"' : "") + ">" + esc(ENG.fmt(v)) + "</td>"; });
      h += "</tr>";
    });
    h += "</tbody></table></div>";
    h += '<div class="rowcount">' + res.rows.length + " row" + (res.rows.length === 1 ? "" : "s") + " returned</div>";
  }
  el.innerHTML = h;
}

/* ---------- HSC / SQLite translation panel ---------- */
function changeList(list) {
  if (!list.length) return "";
  return "<ul>" + list.map(function (c) { return "<li><code>" + esc(c.from) + "</code> becomes <code>" + esc(c.to) + "</code></li>"; }).join("") + "</ul>";
}
function xlateHtml(res) {
  var a = ENG.analyse(res.ast), out = "", extras = a.extras.length ? '<div class="extra">⚠ ' + a.extras.map(esc).join("<br>⚠ ") + "</div>" : "";
  var showHsc = a.toHsc.length > 0, showSq = a.toSqlite.length > 0;
  var used = [];
  if (a.usesWords) used.push("<strong>HSC operator words</strong> (" + a.words.map(esc).join(", ") + ")");
  if (a.usesSymbols) used.push("<strong>SQLite symbols</strong> (" + a.symbols.map(esc).join(", ") + ")");
  if (a.usesJoinOn) used.push("<strong>JOIN ... ON</strong>");
  var badge = used.length ? '<div class="badges">Syntax you used: ' + used.join(" and ") + "</div>" : "";
  if (showHsc) {
    out += '<div class="xlate">' + "<h4>📘 With the Specifications' operator words, your query reads like this</h4>" + badge +
      '<pre class="code">' + esc(ENG.print(res.ast, "hsc")) + "</pre>" + changeList(a.toHsc) +
      '<div class="fine">The Course Specifications list the relational operators as words (EQUALS, GREATER THAN, CONTAINS ...). Their own worked examples also use = >= and <= , so both forms appear in the Specifications. Practise reading and writing both.</div></div>';
  }
  if (showSq) {
    out += '<div class="xlate sq">' + "<h4>💻 In a real SQLite database (your Codespace), this is the version that runs</h4>" + (showHsc ? "" : badge) +
      '<pre class="code">' + esc(ENG.print(res.ast, "sqlite")) + "</pre>" + changeList(a.toSqlite) +
      '<div class="fine">This site understands the operator words from the Specifications, but SQLite itself gives a syntax error on words like EQUALS, GREATER THAN and CONTAINS.</div></div>';
  }
  if (!showHsc && !showSq && !a.extras.length) {
    out += '<div class="xlate both"><h4>✅ Same in both styles</h4><div>This query has no operator words or symbols to translate, so it is already valid in the Specifications\' syntax <em>and</em> valid SQLite.</div></div>';
  }
  if (extras) out += '<div class="xlate both" style="margin-top:8px">' + extras + "</div>";
  return out;
}

/* ---------- runner ---------- */
var EDCOUNT = 0;
function buildRunner(root, cfg) {
  root.innerHTML =
    (cfg.text ? '<p class="taskp"><span class="tasklabel' + (cfg.exam ? " exam" : "") + (cfg.optional ? " opt" : "") + '">' + (cfg.label || "Task") + "</span> " + cfg.text + "</p>" : "") +
    "<label for=\"" + (cfg.eid = "ed" + (++EDCOUNT)) + "\">SQL editor (operator words and SQLite symbols both work)</label>" +
    '<textarea id="' + cfg.eid + '" rows="' + Math.max(3, (cfg.q || "").split("\n").length + 1) + '" spellcheck="false" autocapitalize="off" aria-label="SQL editor: ' + esc((cfg.label || "worked example") + (cfg.key ? " (" + cfg.key + ")" : "")) + '">' + esc(cfg.q || "") + "</textarea>" +
    '<div class="bar"><button type="button" class="btn run">▶ Run</button>' +
    (cfg.hint ? '<button type="button" class="btn ghost hintbtn">💡 Hint</button>' : "") +
    '<button type="button" class="btn ghost tblbtn">Show tables</button>' +
    (cfg.key ? '<span class="status" role="status">Task not done yet</span>' : "") + "</div>" +
    (cfg.hint ? '<div class="hintbox">💡 ' + cfg.hint + "</div>" : "") +
    '<div class="tblbox" style="display:none"></div>' +
    '<div class="feedback" aria-live="polite"></div><div class="output"></div><div class="xl-wrap"></div>';
  var ta = root.querySelector("textarea"), fb = root.querySelector(".feedback"), out = root.querySelector(".output"),
    xw = root.querySelector(".xl-wrap"), status = root.querySelector(".status");
  function setStatus(done) { if (!status) return; status.textContent = done ? "✓ Task done" : "Task not done yet"; status.classList.toggle("done", !!done); }
  if (cfg.key && STATE[cfg.key]) setStatus(true);
  root.querySelector(".tblbtn").addEventListener("click", function () {
    var b = root.querySelector(".tblbox");
    if (b.style.display === "none") { b.innerHTML = allTablesHtml(); b.style.display = "block"; this.textContent = "Hide tables"; }
    else { b.style.display = "none"; this.textContent = "Show tables"; }
  });
  function run() {
    fb.className = "feedback"; fb.textContent = ""; out.innerHTML = ""; xw.innerHTML = "";
    var res;
    try { res = ENG.run(ta.value); }
    catch (err) {
      fb.className = "feedback bad";
      fb.textContent = "⚠ " + (err.friendly ? err.message : "Something went wrong. Check your query.");
      return;
    }
    renderResult(out, res);
    var isTask = !!cfg.key, verdict = null;
    if (isTask) {
      verdict = SQLMarking.check(ENG, cfg, ta.value, res);
      if (!verdict.ok && cfg.hintIf && res.rows.length === ENG.run(cfg.sol).rows.length) { var hh = cfg.hintIf(ta.value); if (hh && verdict.msg.indexOf(hh) === -1) verdict.msg += " " + hh; }
      fb.className = "feedback " + (verdict.ok ? "ok" : "bad");
      fb.textContent = (verdict.ok ? "✔ " : "✖ ") + verdict.msg;
      if (verdict.ok) { setStatus(true); markDone(cfg.key); }
    }
    var xh = xlateHtml(res);
    if (isTask && verdict.ok) xw.innerHTML = xh;
    else if (!isTask) xw.innerHTML = '<details class="xl"><summary>See this query in the other syntax</summary>' + xh + "</details>";
  }
  root.querySelector(".btn.run").addEventListener("click", run);
  ta.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); } });
  var hb = root.querySelector(".hintbtn");
  if (hb) hb.addEventListener("click", function () { root.querySelector(".hintbox").classList.toggle("show"); });
}

/* ---------- multiple choice ---------- */
function buildChecks(container, list) {
  list.forEach(function (cfg, qi) {
    var fs = document.createElement("fieldset");
    var lg = document.createElement("legend");
    lg.innerHTML = (cfg.optional ? '<span class="tasklabel opt">Optional</span> ' : "") + (qi + 1) + ". " + cfg.legend;
    fs.appendChild(lg);
    cfg.options.forEach(function (o, i) {
      var lab = document.createElement("label");
      lab.className = "opt";
      lab.innerHTML = '<input type="radio" name="' + cfg.key + '" value="' + i + '"><span>' + o.t + "</span>";
      fs.appendChild(lab);
    });
    var bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = '<button type="button" class="btn run">Check answer</button><span class="status" role="status">' + (STATE[cfg.key] ? "✓ Done" : "Not answered yet") + "</span>";
    var fb = document.createElement("div");
    fb.className = "feedback"; fb.setAttribute("aria-live", "polite");
    fs.appendChild(bar); fs.appendChild(fb);
    container.appendChild(fs);
    if (STATE[cfg.key]) bar.querySelector(".status").classList.add("done");
    bar.querySelector(".btn").addEventListener("click", function () {
      var sel = fs.querySelector("input:checked");
      if (!sel) { fb.className = "feedback bad"; fb.textContent = "Pick an answer first."; return; }
      var o = cfg.options[Number(sel.value)];
      fb.className = "feedback " + (o.ok ? "ok" : "bad");
      fb.textContent = (o.ok ? "✔ " : "✖ ") + o.fb;
      if (o.ok) { var st = bar.querySelector(".status"); st.textContent = "✓ Done"; st.classList.add("done"); markDone(cfg.key); }
    });
  });
}

/* ---------- page assembly ---------- */
var main = document.getElementById("main"), stepper = document.getElementById("stepper");
function card(h, html) { return '<div class="card"><h2>' + (h.indexOf(":") > -1 ? '<span class="stepno">' + h.split(":")[0] + ":</span>" + h.slice(h.indexOf(":") + 1) : h) + "</h2>" + html + "</div>"; }

function revealHtml(prompt, answer) {
  return "<p>" + prompt + '</p><textarea class="freetext" rows="3" aria-label="Your answer"></textarea>' +
    '<details class="reveal"><summary>Compare with a sample answer</summary><div class="inner">' + answer + "</div></details>";
}

PAGES.forEach(function (p) {
  var btn = document.createElement("button");
  btn.type = "button"; btn.setAttribute("data-goto", p.id); btn.setAttribute("aria-label", "Page " + p.id + ": " + p.label);
  btn.innerHTML = '<span class="pip">' + p.id + '</span><span class="lbl">' + esc(p.label) + "</span>";
  stepper.appendChild(btn);

  var sec = document.createElement("section");
  sec.className = "screen"; sec.setAttribute("data-screen", p.id); sec.setAttribute("aria-label", "Page " + p.id + ": " + p.title);
  var h = '<div class="li-banner"><span class="tag">Learning intention · Page ' + p.id + " of " + PAGES.length + "</span><p>" + p.li + '</p><p class="pace">⏱ ' + p.pace + "</p>" + (p.id <= 7 ? '<p class="pace">Tasks marked <span class="tasklabel opt">Optional</span> are extra practice for early finishers or homework. The page ticks when the core tasks are done.</p>' : "") + "</div>";
  (p.learn || []).forEach(function (c) { h += card(c.h, c.html); });
  h += '<details class="dataview"><summary>📋 Show the three tables</summary><div class="inner">' + allTablesHtml() + "</div></details>";
  var slots = [];
  function slot(cfg) { var id = "r" + slots.length + "_" + p.id; slots.push([id, cfg]); return '<div class="runner" id="' + id + '"' + (cfg.key ? ' data-key="' + cfg.key + '"' : "") + "></div>"; }
  var tcount = 0;
  function taskCard(t) { t.label = (t.optional ? "Optional task " : "Task ") + (++tcount); return slot(t); }
  if (p.blocks) {
    h += '<div class="card" id="blocks-' + p.id + '">';
    p.blocks.forEach(function (b, bi) {
      if (b.html) h += b.html;
      if (b.task) h += '<div style="margin:12px 0;padding-top:8px;border-top:1px dashed #dbe2ec">' + taskCard(b.task) + "</div>";
      if (b.checks) h += '<div class="check" id="chk-' + p.id + "-" + bi + '"></div>';
    });
    h += "</div>";
  } else {
    if (p.tasks && p.tasks.length) {
      h += '<div class="card"><h2><span class="stepno">Try it:</span> your turn</h2>';
      p.tasks.forEach(function (t) { h += '<div style="margin:12px 0;padding-top:8px;border-top:1px dashed #dbe2ec">' + taskCard(t) + "</div>"; });
      h += "</div>";
    }
    if (p.checks && p.checks.length) h += '<div class="card check" id="chk-' + p.id + '"><h2><span class="stepno">Check:</span> quick questions</h2></div>';
  }
  if (p.hpge) {
    h += '<details class="hpge"><summary><span class="badge">GO FURTHER 🚀</span> Optional extension</summary><div class="inner">';
    if (p.hpge.task) { h += '<div style="margin:6px 0">' + slot(Object.assign({}, p.hpge.task, { label: "Extension" })) + "</div>"; if (p.hpge.note) h += '<p class="annot">' + p.hpge.note + "</p>"; }
    else h += revealHtml(p.hpge.prompt, p.hpge.answer);
    h += "</div></details>";
  }
  h += '<div class="banner-done" id="done-' + p.id + '">🎉 ' + (p.id <= 7 ? "Core tasks for page " : "Page ") + p.id + " complete.</div>";
  h += '<div class="navbtns">' + (p.id > 1 ? '<button type="button" class="btn ghost" data-goto="' + (p.id - 1) + '">← Back</button>' : "<span></span>") +
    (p.id < PAGES.length ? '<button type="button" class="btn run" data-goto="' + (p.id + 1) + '">Next page →</button>' : "<span></span>") + "</div>";
  sec.innerHTML = h;
  main.appendChild(sec);
  slots.forEach(function (s) { buildRunner(document.getElementById(s[0]), Object.assign({}, p.runners && p.runners[s[1].runner] || {}, s[1])); });
  // worked-example runners (data-runner placeholders in the learn cards)
  sec.querySelectorAll("[data-runner]").forEach(function (el) { buildRunner(el, p.runners[el.getAttribute("data-runner")]); });
  if (p.blocks) p.blocks.forEach(function (b, bi) { if (b.checks) buildChecks(document.getElementById("chk-" + p.id + "-" + bi), b.checks); });
  else if (p.checks && p.checks.length) buildChecks(document.getElementById("chk-" + p.id), p.checks);
});

/* page 1: explorable Games table showing the foreign-key links */
(function () {
  var wrap = document.getElementById("explore-games"); if (!wrap) return;
  var t = PRACTICE_DB.Games, h = '<table class="data explore"><thead><tr>';
  t.cols.forEach(function (c) { h += "<th>" + esc(c.name) + (c.key ? '<span class="key">' + c.key + "</span>" : "") + "</th>"; });
  h += "</tr></thead><tbody>";
  t.rows.forEach(function (r) { h += '<tr tabindex="0" data-id="' + r.ID + '">' + t.cols.map(function (c) { return "<td>" + esc(r[c.name]) + "</td>"; }).join("") + "</tr>"; });
  wrap.innerHTML = h + "</tbody></table>";
  var info = document.getElementById("explore-info");
  function pick(tr) {
    wrap.querySelectorAll("tr.selrow").forEach(function (x) { x.classList.remove("selrow"); });
    tr.classList.add("selrow");
    var g = t.rows.filter(function (r) { return String(r.ID) === tr.getAttribute("data-id"); })[0];
    var pub = PRACTICE_DB.Publishers.rows.filter(function (r) { return r.Publisher_ID === g.Publisher_ID; })[0];
    var dev = PRACTICE_DB.Developers.rows.filter(function (r) { return r.Developer_ID === g.Developer_ID; })[0];
    info.innerHTML = "<strong>" + esc(g.Name) + "</strong> has <code>Publisher_ID " + g.Publisher_ID + "</code>, which is the Publishers row <strong>" + esc(pub.Name) +
      "</strong>, and <code>Developer_ID " + g.Developer_ID + "</code>, which is the Developers row <strong>" + esc(dev.First_name + " " + dev.Last_name) + "</strong>.";
  }
  wrap.querySelectorAll("tbody tr").forEach(function (tr) {
    tr.addEventListener("click", function () { pick(tr); });
    tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(tr); } });
  });
})();

/* ---------- progress and navigation ---------- */
function refreshProgress() {
  PAGES.forEach(function (p) {
    var keys = pageKeys(p), done = keys.length && keys.every(function (k) { return STATE[k]; });
    var b = stepper.querySelector('[data-goto="' + p.id + '"]');
    b.classList.toggle("done", !!done);
    b.querySelector(".pip").textContent = done ? "✓" : p.id;
    var banner = document.getElementById("done-" + p.id);
    if (banner) banner.classList.toggle("show", !!done);
  });
}
function showScreen(n) {
  document.querySelectorAll(".screen").forEach(function (s) { s.classList.toggle("active", s.getAttribute("data-screen") === String(n)); });
  stepper.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-current", b.getAttribute("data-goto") === String(n) ? "true" : "false"); });
  if (location.hash !== "#page-" + n) { try { history.replaceState(null, "", "#page-" + n); } catch (e) { location.hash = "page-" + n; } }
  window.scrollTo(0, 0);
}
document.addEventListener("click", function (e) {
  var g = e.target.closest && e.target.closest("[data-goto]");
  if (g) showScreen(g.getAttribute("data-goto"));
});
window.addEventListener("hashchange", function () { var m = location.hash.match(/^#page-(\d+)$/); if (m && Number(m[1]) <= PAGES.length) showScreen(m[1]); });
document.getElementById("ref-tables").innerHTML = allTablesHtml();
refreshProgress();
var m0 = location.hash.match(/^#page-(\d+)$/);
showScreen(m0 && Number(m0[1]) <= PAGES.length ? m0[1] : 1);
