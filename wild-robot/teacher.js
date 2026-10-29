/* Wild Robot comprehension – teacher results page.
   Reads every saved result from the Google Sheet (via the Apps Script web app) using the teacher key,
   shows class tables per chapter, questions to re-teach, and lets the teacher enter written-answer marks. */
(function () {
  "use strict";
  var CFG = window.QUIZ_CONFIG || {};
  var app = document.getElementById("app");
  var KEY_STORE = "wildRobotTeacherKey";
  var SKILL_SHORT = {
    "Locating directly stated information": "Locate",
    "Connecting ideas within and across paragraphs": "Connect",
    "Interpreting vocabulary in context": "Vocab",
    "Identifying the main idea or purpose": "Main idea",
    "Inferring character feelings or motives": "Infer",
    "Analysing text structure and language features": "Analyse"
  };
  var SKILLS = Object.keys(SKILL_SHORT);

  var key = "", rows = [], chapter = null, selected = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function lvl(p) { return p >= 75 ? "lvl-hi" : p >= 50 ? "lvl-mid" : "lvl-lo"; }
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("en-AU", { day: "numeric", month: "short" }) + " " +
      d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }
  function writtenDone(r) {
    var need = r.questions.filter(function (q) { return q.format === "write"; }).length;
    var m = r.writtenMarks || [];
    return need > 0 && m.length === need && m.every(function (x) { return x !== null && x !== "" && !isNaN(x); });
  }
  function writtenSum(r) { return (r.writtenMarks || []).reduce(function (a, b) { return a + (Number(b) || 0); }, 0); }

  /* ---------- Key screen ---------- */
  function renderKey(message) {
    app.innerHTML =
      '<section class="sheet" style="max-width:32rem">' +
        "<h2>Open class results</h2>" +
        (CFG.scriptUrl ? "" : '<p class="msg bad">Results saving isn’t set up yet. Add your Apps Script web app URL to config.js (see SETUP.md).</p>') +
        '<div class="field"><label for="tkey">Teacher key</label><input type="text" id="tkey" autocomplete="off" spellcheck="false"></div>' +
        (message ? '<p class="msg bad">' + esc(message) + "</p>" : "") +
        '<div class="actions"><button class="btn" id="open">Open results</button></div>' +
      "</section>";
    var inp = document.getElementById("tkey"), btn = document.getElementById("open");
    btn.onclick = function () { key = inp.value.trim(); if (key) fetchRows(true); };
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") btn.click(); });
    inp.focus();
  }

  /* ---------- Data ---------- */
  function fetchRows(fromKeyScreen) {
    if (!CFG.scriptUrl) { renderKey("Results saving isn’t set up yet."); return; }
    if (!fromKeyScreen) setBusy("Loading results…");
    fetch(CFG.scriptUrl + "?action=results&key=" + encodeURIComponent(key))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) {
          store(KEY_STORE, null);
          renderKey(res.error === "wrong_key" ? "That teacher key doesn’t match. Check the TEACHER_KEY script property." : "Results couldn’t load. Try again.");
          return;
        }
        store(KEY_STORE, key);
        rows = res.rows || [];
        var chs = chapters();
        if (chapter === null || chs.indexOf(chapter) === -1) chapter = chs[chs.length - 1] || null;
        render();
      })
      .catch(function () { renderKey("Results couldn’t load. Check the internet connection and the script URL in config.js."); });
  }
  function setBusy(text) {
    var b = document.getElementById("refresh");
    if (b) { b.disabled = true; b.textContent = text; }
  }
  function chapters() {
    var seen = {};
    rows.forEach(function (r) { seen[r.chapter] = r.chapterTitle; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }
  /* Combined pages save their title as "Chapters 53 & 55–57: …", so the tab shows the full chapter range. */
  function chapterName(c) {
    var t = "";
    rows.forEach(function (r) { if (Number(r.chapter) === c) t = String(r.chapterTitle || ""); });
    return /^Chapters /.test(t) ? t.split(":")[0] : "Chapter " + c;
  }
  function chapterRows() {
    var list = rows.filter(function (r) { return Number(r.chapter) === chapter; });
    list.sort(function (a, b) {
      return String(a.student).localeCompare(String(b.student), undefined, { numeric: true }) || String(a.submitted).localeCompare(String(b.submitted));
    });
    var count = {};
    list.forEach(function (r) {
      var k = String(r.student).toLowerCase();
      count[k] = (count[k] || 0) + 1;
      r._try = count[k];
    });
    return list;
  }

  /* ---------- Main view ---------- */
  function render() {
    var chs = chapters();
    if (!chs.length) {
      app.innerHTML = '<section class="sheet"><h2>No results yet</h2><p>Results appear here as soon as a student finishes a chapter.</p>' +
        '<div class="actions"><button class="btn" id="refresh">Refresh</button></div></section>';
      document.getElementById("refresh").onclick = function () { fetchRows(); };
      return;
    }
    var list = chapterRows();
    var firsts = list.filter(function (r) { return r._try === 1; });
    var title = (list[0] && list[0].chapterTitle) || "";
    var avg = firsts.length ? Math.round(firsts.reduce(function (a, r) { return a + pct(r.autoScore, r.autoMax); }, 0) / firsts.length) : 0;
    var toMark = list.filter(function (r) { return !writtenDone(r); }).length;

    var skillAvg = SKILLS.map(function (s) {
      var g = 0, m = 0;
      firsts.forEach(function (r) { var k = r.skills[s]; if (k) { g += k.got; m += k.max; } });
      return m ? '<div class="score"><span class="big ' + lvl(pct(g, m)) + '" style="font-size:1.5rem">' + pct(g, m) + '%</span><span class="lbl">' + SKILL_SHORT[s] + "</span></div>" : "";
    }).join("");

    var head = "<tr><th>Student</th><th>Submitted</th><th class=num>Computer</th><th>Written</th><th class=num>Total</th>" +
      SKILLS.map(function (s) { return "<th class=num>" + SKILL_SHORT[s] + "</th>"; }).join("") + "</tr>";
    var body = list.map(function (r, i) {
      var done = writtenDone(r);
      return '<tr data-i="' + i + '" tabindex="0" aria-selected="' + (selected === r.id) + '">' +
        "<td><b>" + esc(r.student) + "</b>" + (r._try > 1 ? ' <span class="pill retry">Try ' + r._try + "</span>" : "") + "</td>" +
        "<td>" + when(r.submitted) + "</td>" +
        '<td class="num"><span class="' + lvl(pct(r.autoScore, r.autoMax)) + '">' + r.autoScore + "/" + r.autoMax + "</span></td>" +
        "<td>" + (done ? '<span class="pill done">' + writtenSum(r) + "/" + r.writtenMax + "</span>" : '<span class="pill todo">To mark</span>') + "</td>" +
        '<td class="num">' + (done ? (r.autoScore + writtenSum(r)) + "/" + (r.autoMax + r.writtenMax) : "–") + "</td>" +
        SKILLS.map(function (s) {
          var k = r.skills[s];
          return '<td class="num">' + (k ? '<span class="' + lvl(pct(k.got, k.max)) + '">' + k.got + "/" + k.max + "</span>" : "") + "</td>";
        }).join("") + "</tr>";
    }).join("");

    app.innerHTML =
      '<div class="row-between">' +
        '<div class="tabs" role="group" aria-label="Chapter">' + chs.map(function (c) {
          return '<button type="button" data-ch="' + c + '" aria-pressed="' + (c === chapter) + '">' + esc(chapterName(c)) + "</button>";
        }).join("") + "</div>" +
        '<div class="actions"><button class="btn ghost" id="forget">Lock</button><button class="btn" id="refresh">Refresh</button></div>' +
      "</div>" +
      '<section class="sheet">' +
        "<h2>" + (/^Chapters /.test(title) ? esc(title) : "Chapter " + chapter + ": " + esc(title)) + "</h2>" +
        '<div class="stats">' +
          '<div class="score"><span class="big">' + firsts.length + '</span><span class="lbl">Students finished</span></div>' +
          '<div class="score"><span class="big ' + lvl(avg) + '">' + avg + '%</span><span class="lbl">Average computer score (first try)</span></div>' +
          '<div class="score"><span class="big">' + toMark + '</span><span class="lbl">Written answers to mark</span></div>' +
        "</div>" +
        '<div><h3 class="skills-h">Class average by skill (first try)</h3><div class="stats">' + skillAvg + "</div></div>" +
      "</section>" +
      '<section class="sheet"><div class="row-between"><h2>Students</h2><span class="muted">Select a student to see their answers and mark written responses.</span></div>' +
        '<div class="table-scroll"><table><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div></section>" +
      '<div id="detail"></div>' +
      reteach(firsts);

    app.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () { chapter = +b.dataset.ch; selected = null; render(); };
    });
    document.getElementById("refresh").onclick = function () { fetchRows(); };
    document.getElementById("forget").onclick = function () { store(KEY_STORE, null); key = ""; rows = []; renderKey(); };
    app.querySelectorAll("tbody tr").forEach(function (tr) {
      function open() { var r = list[+tr.dataset.i]; selected = r.id; render(); }
      tr.onclick = open;
      tr.onkeydown = function (e) { if (e.key === "Enter") open(); };
    });
    var sel = list.filter(function (r) { return r.id === selected; })[0];
    if (sel) renderDetail(sel);
  }

  /* Questions most students got wrong on their first try */
  function reteach(firsts) {
    if (!firsts.length) return "";
    var stats = {};
    firsts.forEach(function (r) {
      r.questions.forEach(function (q) {
        if (q.format === "write") return;
        var s = stats[q.n] || (stats[q.n] = { q: q, right: 0, n: 0, clues: 0, ev: 0, wrong: {} });
        s.n++;
        if (q.firstTry) s.right++;
        else if (q.firstAnswer) s.wrong[q.firstAnswer] = (s.wrong[q.firstAnswer] || 0) + 1;
        if (q.evidenceTries !== undefined) { s.ev++; if (!q.evidenceMark) s.clues++; }
      });
    });
    var list = Object.keys(stats).map(function (k) { return stats[k]; })
      .sort(function (a, b) { return pct(a.right, a.n) - pct(b.right, b.n); }).slice(0, 5);
    return '<section class="sheet"><h2>Questions to re-teach</h2><p class="muted">The five questions with the fewest correct first answers.</p><ul class="reteach">' +
      list.map(function (s) {
        var p = pct(s.right, s.n);
        var common = Object.keys(s.wrong).sort(function (a, b) { return s.wrong[b] - s.wrong[a]; })[0];
        return '<li><span class="pct ' + lvl(p) + '">' + p + '%</span><div class="r-detail" style="display:grid;gap:.2rem">' +
          "<b>Q" + s.q.n + ". " + esc(s.q.prompt) + "</b>" +
          '<span class="r-type">' + esc(s.q.skill) + "</span>" +
          "<span>" + s.right + " of " + s.n + " correct first time." + (s.ev ? " " + s.clues + " needed clues to find the evidence." : "") + "</span>" +
          (common ? '<span class="muted">Most common wrong answer: ' + esc(common) + " (" + s.wrong[common] + ")</span>" : "") +
        "</div></li>";
      }).join("") + "</ul></section>";
  }

  /* ---------- One student's answers + written marking ---------- */
  function renderDetail(r) {
    var writes = r.questions.filter(function (q) { return q.format === "write"; });
    var marks = (r.writtenMarks || []).slice();
    var html = '<section class="sheet"><div class="row-between"><h2>' + esc(r.student) + (r._try > 1 ? " (try " + r._try + ")" : "") +
      '</h2><span class="muted">' + when(r.submitted) + "</span></div><ol class=\"q-list\">" +
      r.questions.map(function (q) {
        var d = '<span class="r-type">' + esc(q.skill) + "</span>", mark;
        if (q.format === "write") {
          var wi = writes.indexOf(q);
          mark = '<label class="mark-input"><input type="number" min="0" max="' + q.max + '" step="1" data-w="' + wi + '" value="' +
            (marks[wi] === null || marks[wi] === undefined ? "" : marks[wi]) + '" aria-label="Mark for question ' + q.n + '">/' + q.max + "</label>";
          d += '<div class="r-text">' + esc(q.answer) + "</div>" +
            "<details><summary>What to look for</summary><ul>" + (q.lookFor || []).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></details>";
        } else {
          mark = q.score + "/" + q.max;
          if (q.evidenceTries !== undefined) {
            d += '<span class="' + (q.evidenceMark ? "r-good" : "r-bad") + '">Evidence: found on ' +
              (q.evidenceTries === 1 ? "first try" : "try " + q.evidenceTries) + (q.evidenceMark ? "" : " (needed clues)") + "</span>";
          }
          if (q.format === "mc") {
            d += q.firstTry ? '<span class="r-good">Correct first try</span>'
              : '<span class="r-bad">First answer: ' + esc(q.firstAnswer) + "</span><span>Correct on try " + q.attempts + ": " + esc(q.correctAnswer) + "</span>";
          } else {
            d += '<span class="' + (q.firstTry ? "r-good" : "r-bad") + '">' + (q.firstTry ? "Correct first try" : "Correct after " + q.attempts + " tries") + "</span>";
          }
        }
        return "<li><b>" + q.n + ". " + esc(q.prompt) + '</b><span class="r-mark">' + mark + '</span><div class="r-detail">' + d + "</div></li>";
      }).join("") + "</ol>" +
      (writes.length ? '<div class="row-between"><p class="msg" id="mark-msg"></p><button class="btn" id="save-marks">Save written marks</button></div>' : "") +
      "</section>";
    var host = document.getElementById("detail");
    host.innerHTML = html;
    host.scrollIntoView({ behavior: "smooth", block: "start" });
    var saveBtn = document.getElementById("save-marks");
    if (!saveBtn) return;
    saveBtn.onclick = function () {
      var msg = document.getElementById("mark-msg");
      var vals = [], bad = false;
      host.querySelectorAll("input[data-w]").forEach(function (inp) {
        var v = inp.value.trim(), max = +inp.max;
        if (v === "") { vals[+inp.dataset.w] = null; return; }
        var n = Number(v);
        if (isNaN(n) || n < 0 || n > max || Math.round(n) !== n) bad = true;
        vals[+inp.dataset.w] = n;
      });
      if (bad) { msg.className = "msg bad"; msg.textContent = "Each mark must be a whole number from 0 up to the marks for that question."; return; }
      saveBtn.disabled = true; msg.className = "msg"; msg.textContent = "Saving…";
      fetch(CFG.scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "mark", key: key, id: r.id, marks: vals }) })
        .then(function (res) { return res.json(); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.error);
          r.writtenMarks = vals;
          render();
          var m = document.getElementById("mark-msg");
          if (m) { m.className = "msg good"; m.textContent = "Marks saved."; }
        })
        .catch(function () { saveBtn.disabled = false; msg.className = "msg bad"; msg.textContent = "Marks didn’t save. Check the connection and try again."; });
    };
  }

  key = load(KEY_STORE);
  if (key && CFG.scriptUrl) fetchRows(true); else renderKey();
})();
