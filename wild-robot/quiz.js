/* The Wild Robot – chapter quiz engine.
   Each chapter page defines window.CHAPTER = { number, title, pages, questions } and loads this file.
   Combined pages (several chapters on one page) also set:
     label – shown instead of "Chapter N", e.g. "Chapters 53 & 55–57"
     parts – [{ number, title, pages }] one entry per chapter
   and give each question `part: <chapter number>`, so its page buttons only show that chapter's pages.
   `number` stays a single number (the first chapter) so results save and group as before.

   Every question has a `type` key from TYPES below (the six comprehension skills, mapped to NSW English K–10 Stage 2).
   Formats:
     mc    – "Find it first" evidence step, then multiple choice. `find` = { clue, targets: [{ page, start }] }
             `start` is the first few words of an acceptable sentence; students type the first three words of the
             sentence they found in their book. Answers stay locked until the evidence is proved.
             `where` (position on the page) and `word` (a word in the sentence) feed the escalating clues.
     order – tap events into sequence
     sort  – put each item into a category
     write – extended written response, marked by the teacher (`lookFor` notes shown on the results screen) */
(function () {
  "use strict";

  var TYPES = {
    locate:  { name: "Locating directly stated information", code: "EN2-RECOM-01" },
    connect: { name: "Connecting ideas within and across paragraphs", code: "EN2-RECOM-01" },
    vocab:   { name: "Interpreting vocabulary in context", code: "EN2-VOCAB-01" },
    main:    { name: "Identifying the main idea or purpose", code: "EN2-RECOM-01" },
    infer:   { name: "Inferring character feelings or motives", code: "EN2-UARL-01" },
    analyse: { name: "Analysing text structure and language features", code: "EN2-RECOM-01" }
  };
  window.QUIZ_TYPES = TYPES;

  var C = window.CHAPTER;
  if (!C) return;
  var app = document.getElementById("app");
  var LETTERS = "ABCDEFGH";
  var MAX_FIND_TRIES = 2;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function pageLabel(p) { return "p. " + p; }

  /* ---------- Single chapter or combined page ---------- */
  var PARTS = C.parts || [];
  var LABEL = C.label || "Chapter " + C.number;
  function partOf(q) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].number === q.part) return PARTS[i];
    return null;
  }
  function pagesFor(q) { var pt = partOf(q); return pt ? pt.pages : C.pages; }
  function pageSpan(pages) { return pages[0] === pages[pages.length - 1] ? String(pages[0]) : pages[0] + "–" + pages[pages.length - 1]; }

  /* ---------- Matching typed sentence openings ---------- */
  function words(s) {
    return String(s).toLowerCase()
      .replace(/[‘’ʼ`']/g, "")      // drop apostrophes: didn't -> didnt
      .replace(/[^a-z0-9]+/g, " ")
      .trim().split(" ").filter(Boolean);
  }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function sameWord(typed, key) {
    if (typed === key) return true;
    return key.length >= 4 && lev(typed, key) <= 1;   // forgive one small spelling slip in longer words
  }
  function opensWith(typed, start) {
    var t = words(typed), k = words(start).slice(0, 3);
    if (t.length < k.length) return false;
    for (var i = 0; i < k.length; i++) if (!sameWord(t[i], k[i])) return false;
    return true;
  }

  function marksFor(q) {
    if (q.type === "mc") return 1 + (q.find ? 1 : 0);
    return q.marks || 1;
  }
  var autoTotal = 0, writtenTotal = 0;
  C.questions.forEach(function (q) {
    if (q.format === "write") writtenTotal += q.marks; else autoTotal += marksFor(qShape(q));
  });
  function qShape(q) { return { type: q.format, find: q.find, marks: q.marks }; }

  var CFG = window.QUIZ_CONFIG || {};
  var CLASS = (CFG.classList || []).filter(Boolean);

  function plain(html) { var d = document.createElement("div"); d.innerHTML = html; return d.textContent.trim(); }
  function uid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); }

  /* ---------- Saving results to the teacher's Google Sheet ---------- */
  function buildPayload(got, byType) {
    var skills = {};
    Object.keys(byType).forEach(function (k) { skills[TYPES[k].name] = byType[k]; });
    return {
      id: state.submitId,
      result: {
        chapter: C.number, chapterTitle: C.label ? C.label + ": " + C.title : C.title, student: state.name,
        autoScore: got, autoMax: autoTotal, writtenMax: writtenTotal, skills: skills,
        questions: state.results.map(function (r, k) {
          var q = r.q, o = { n: k + 1, skill: TYPES[q.type].name, format: q.format, prompt: plain(q.prompt), max: r.max };
          if (q.format === "write") { o.answer = r.given; o.lookFor = q.lookFor.map(plain); return o; }
          o.score = r.score; o.firstTry = r.correct; o.attempts = r.attempts;
          if (q.format === "mc") {
            o.firstAnswer = plain(r.given); o.correctAnswer = plain(r.correctText);
            if (q.find) { o.evidenceTries = r.tries; o.evidenceMark = r.findScore; }
          }
          return o;
        })
      }
    };
  }
  function sendResults(payload, statusEl, attempt) {
    if (!CFG.scriptUrl) {
      statusEl.className = "save-status";
      statusEl.textContent = "Show this screen to your teacher before you leave the page.";
      return;
    }
    statusEl.className = "save-status saving";
    statusEl.textContent = "Sending your results to your teacher\u2026";
    fetch(CFG.scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error((res && res.error) || "failed");
        statusEl.className = "save-status saved";
        statusEl.textContent = "\u2713 Your results have been sent to your teacher.";
      })
      .catch(function () {
        if ((attempt || 1) < 2) { setTimeout(function () { sendResults(payload, statusEl, 2); }, 1500); return; }
        statusEl.className = "save-status failed";
        statusEl.innerHTML = "Your results didn\u2019t send. Check the internet connection, then tap the button. ";
        var b = document.createElement("button");
        b.className = "btn"; b.type = "button"; b.textContent = "Send again";
        b.onclick = function () { sendResults(payload, statusEl, 1); };
        statusEl.appendChild(b);
      });
  }

  var state;
  function reset() {
    state = { name: state ? state.name : "", i: 0, results: [], submitId: uid() };
    C.questions.forEach(function (q) {
      if (q.format === "mc") q._order = shuffle(range(q.options.length));
      if (q.format === "order") q._order = shuffle(range(q.items.length));
    });
  }

  function setScreen(html) {
    app.innerHTML = html;
    window.scrollTo(0, 0);
    var h = app.querySelector("[data-focus]");
    if (h) h.focus({ preventScroll: true });
  }

  /* ---------- Start ---------- */
  function renderStart() {
    reset();
    setScreen(
      '<section class="sheet">' +
        '<h2 tabindex="-1" data-focus>Before you start</h2>' +
        '<div class="facts">' +
          (PARTS.length ? "<span><b>" + PARTS.length + "</b> chapters</span>" : "<span>Pages <b>" + pageSpan(C.pages) + "</b></span>") +
          "<span><b>" + C.questions.length + "</b> questions</span>" +
          "<span><b>" + (autoTotal + writtenTotal) + "</b> marks</span>" +
        "</div>" +
        (PARTS.length
          ? "<p>You will need your copy of <i>The Wild Robot</i>. Read all of these chapters first. Each question tells you which chapter it is about.</p>" +
            '<ul class="part-list">' + PARTS.map(function (pt) {
              return '<li><span class="mono">Ch ' + pt.number + "</span><span>" + esc(pt.title) + '</span><span class="mono muted">pp. ' + pageSpan(pt.pages) + "</span></li>";
            }).join("") + "</ul>"
          : "<p>You will need your copy of <i>The Wild Robot</i>, open at Chapter " + C.number + ". Read the whole chapter first.</p>") +
        '<div class="howto">' +
          '<h3>For each question</h3>' +
          "<ol>" +
            "<li><b>Find it first.</b> Read the clue, then find the sentence in your book that helps you answer.</li>" +
            "<li><b>Prove it.</b> Choose the page, then type the first three words of that sentence.</li>" +
            "<li><b>Answer.</b> The answers unlock once you have proved your evidence. If you get stuck, you will get clues, but you must find the evidence yourself before you can move on.</li>" +
          "</ol>" +
        "</div>" +
        (CLASS.length
          ? '<div class="field"><label for="student-name">Choose your name</label>' +
            '<select id="student-name"><option value="">Choose\u2026</option>' +
            CLASS.map(function (n) { return '<option' + (n === state.name ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") +
            "</select></div>"
          : '<div class="field"><label for="student-name">Your first name</label>' +
            '<input type="text" id="student-name" autocomplete="off" maxlength="30" value="' + esc(state.name) + '"></div>') +
        '<div class="actions"><button class="btn" id="start-btn" disabled>Start ' + (PARTS.length ? "now" : "Chapter " + C.number) + "</button></div>" +
      "</section>"
    );
    var input = document.getElementById("student-name");
    var btn = document.getElementById("start-btn");
    function sync() { btn.disabled = input.value.trim().length < 2; }
    input.addEventListener("input", sync);
    input.addEventListener("change", sync);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !btn.disabled) btn.click(); });
    btn.addEventListener("click", function () { state.name = input.value.trim(); renderQuestion(); });
    sync();
  }

  /* ---------- Question shell ---------- */
  function shell(q, bodyHtml, marks) {
    var n = state.i + 1, total = C.questions.length, t = TYPES[q.type], pt = partOf(q);
    var where = pt ? "Chapter " + pt.number + ": " + pt.title : (q.parts || "");
    return (
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + state.i + '"><div style="width:' + (state.i / total) * 100 + '%"></div></div>' +
      '<div class="qmeta"><span>Question ' + n + " of " + total + (where ? ' &middot; <b class="q-part">' + esc(where) + "</b>" : "") +
        '</span><span class="tag">' + esc(t.name) + "</span></div>" +
      '<section class="sheet">' +
        '<div class="q-head"><h2 class="q-prompt" tabindex="-1" data-focus>' + q.prompt + '</h2><span class="marks" aria-label="' + marks + ' marks">/' + marks + "</span></div>" +
        bodyHtml +
        '<div class="feedback" id="feedback" role="status" hidden></div>' +
        '<div class="actions"><button class="btn" id="main-btn" disabled>' + (q.format === "write" ? "Save my answer" : "Check answer") + "</button></div>" +
      "</section>"
    );
  }
  function nextLabel() { return state.i + 1 < C.questions.length ? "Next question" : "See my results"; }
  function goNext() {
    state.i++;
    if (state.i < C.questions.length) renderQuestion(); else renderResults();
  }
  function showFeedback(kind, verdict, html) {
    var f = document.getElementById("feedback");
    f.className = "feedback " + kind;
    f.innerHTML = '<p class="verdict">' + verdict + "</p>" + html;
    f.hidden = false;
  }
  function becomeNext(btn) {
    btn.textContent = nextLabel();
    btn.disabled = false;
    btn.onclick = goNext;
    btn.focus({ preventScroll: true });
  }
  function clueFor(hints, attempt) {
    hints = hints || [];
    var h = hints[Math.min(attempt - 1, hints.length - 1)];
    return '<span class="try">Try ' + attempt + "</span> Clue: " + (h || "Go back to the evidence you found and reread it carefully.");
  }
  function ordinal(n) { return n === 1 ? "first try" : n + " tries"; }

  function renderQuestion() {
    var q = C.questions[state.i];
    ({ mc: renderMC, order: renderOrder, sort: renderSort, write: renderWrite })[q.format](q);
  }

  /* ---------- Find it first + multiple choice ---------- */
  function targetText(t) { return pageLabel(t.page) + ", the sentence beginning “" + esc(t.start) + "…”"; }

  function renderMC(q) {
    var marks = marksFor(qShape(q));
    var find = "";
    if (q.find) {
      find =
        '<div class="proof" id="find">' +
          '<div class="proof-head"><h3>Find it first</h3><span class="marks">/1</span></div>' +
          '<p class="clue">' + q.find.clue + "</p>" +
          '<div class="find-step"><span class="step-lbl">Which page is the sentence on?</span>' +
            '<div class="pages">' + pagesFor(q).map(function (p) {
              return '<button class="page-btn" type="button" aria-pressed="false" data-page="' + p + '">' + pageLabel(p) + "</button>";
            }).join("") + "</div></div>" +
          '<div class="find-step"><label class="step-lbl" for="opening-' + state.i + '">Type the first three words of that sentence.</label>' +
            '<div class="find-row"><input type="text" id="opening-' + state.i + '" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60">' +
            '<button class="btn proof-btn" type="button" id="find-btn" disabled>Check my evidence</button></div></div>' +
          '<p class="find-msg" id="find-msg" role="status" hidden></p>' +
        "</div>";
    }
    var opts = q._order.map(function (orig, k) {
      return '<button class="opt" type="button" aria-pressed="false" data-orig="' + orig + '"' + (q.find ? " disabled" : "") + '><span class="letter">' + LETTERS[k] + "</span><span>" + q.options[orig] + "</span></button>";
    }).join("");
    setScreen(shell(q,
      find +
      '<div class="answer-zone' + (q.find ? " locked" : "") + '" id="answer-zone">' +
        (q.find ? '<p class="lock-note" id="lock-note">The answers unlock once you have found the evidence.</p>' : "") +
        '<div class="options">' + opts + "</div>" +
      "</div>", marks));

    var choice = null, page = null, tries = 0, found = !q.find, findScore = 0, foundTarget = null;
    var btn = document.getElementById("main-btn");
    var optBtns = app.querySelectorAll(".opt");
    function ready() { btn.disabled = !found || choice === null; }

    optBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        choice = +b.dataset.orig;
        optBtns.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        ready();
      });
    });

    function unlock() {
      found = true;
      var zone = document.getElementById("answer-zone");
      zone.classList.remove("locked");
      var note = document.getElementById("lock-note");
      if (note) note.hidden = true;
      optBtns.forEach(function (o) { o.disabled = false; });
      app.querySelectorAll(".page-btn").forEach(function (o) { o.disabled = true; });
      var inp = document.getElementById("opening-" + state.i);
      inp.readOnly = true;
      document.getElementById("find-btn").hidden = true;
      optBtns[0].focus({ preventScroll: true });
      ready();
    }

    if (q.find) {
      var pageBtns = app.querySelectorAll(".page-btn");
      var inp = document.getElementById("opening-" + state.i);
      var findBtn = document.getElementById("find-btn");
      var msg = document.getElementById("find-msg");
      var box = document.getElementById("find");
      function findReady() { findBtn.disabled = page === null || words(inp.value).length < 1; }
      pageBtns.forEach(function (b) {
        b.addEventListener("click", function () {
          page = +b.dataset.page;
          pageBtns.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
          findReady();
        });
      });
      inp.addEventListener("input", findReady);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !findBtn.disabled) findBtn.click(); });
      findBtn.addEventListener("click", function () {
        tries++;
        var hit = null, sentenceElsewhere = false;
        q.find.targets.forEach(function (t) {
          if (opensWith(inp.value, t.start)) { if (t.page === page) hit = hit || t; else sentenceElsewhere = true; }
        });
        msg.hidden = false;
        if (hit) {
          findScore = tries <= MAX_FIND_TRIES ? 1 : 0;   // the evidence mark is earned before any page clue is given
          foundTarget = hit;
          box.classList.add("is-done");
          msg.className = "find-msg good";
          msg.innerHTML = "Evidence found: " + targetText(hit) + "." +
            (findScore ? "" : " You needed clues this time, so this mark goes to 0. You still found it!") + " Now choose your answer.";
          unlock();
          return;
        }
        // Not found yet: students cannot move on. Each wrong try adds a stronger clue, but never the sentence itself.
        msg.className = "find-msg bad";
        var t0 = q.find.targets[0];
        var onRightPage = q.find.targets.some(function (t) { return t.page === page; });
        var first = words(t0.start)[0].charAt(0).toUpperCase();
        var tip;
        if (sentenceElsewhere) tip = "You found a good sentence, but check the page number.";
        else if (tries === 1) tip = onRightPage
          ? "Right page! Reread the sentences on it. Which one matches the clue? Check you typed its first three words."
          : "The evidence isn’t on that page. Skim the other pages and look for words from the clue.";
        else if (tries === 2) tip = "Clue: the evidence is on " + pageLabel(t0.page) + ". Read that page slowly, one sentence at a time.";
        else if (tries === 3) tip = "Clue: look " + q.find.where + " of " + pageLabel(t0.page) + ".";
        else if (q.find.last) tip = "Clue: look " + q.find.where + " of " + pageLabel(t0.page) + ". " + q.find.last;
        else tip = "Clue: look " + q.find.where + " of " + pageLabel(t0.page) + " for a sentence that begins with the letter “" + first + "” and uses the word “" + esc(q.find.word) + "”.";
        msg.innerHTML = '<span class="try">Try ' + tries + "</span> " + tip + " Keep looking. You can’t move on until you find it.";
        inp.select();
        inp.focus();
      });
    }

    // Wrong answers get a clue, never the answer. The student keeps choosing until correct;
    // the answer mark is only earned on the first attempt.
    var attempts = 0, firstGiven = null;
    btn.onclick = function () {
      attempts++;
      if (firstGiven === null) firstGiven = choice;
      if (choice !== q.answer) {
        optBtns.forEach(function (o) {
          if (+o.dataset.orig === choice) { o.classList.add("is-wrong"); o.disabled = true; }
          o.setAttribute("aria-pressed", "false");
        });
        choice = null;
        ready();
        showFeedback("bad", "Not quite. Try again.", "<p>" + clueFor(q.hints, attempts) + "</p>");
        return;
      }
      optBtns.forEach(function (o) {
        o.disabled = true;
        if (+o.dataset.orig === q.answer) o.classList.add("is-right");
      });
      showFeedback("good", attempts === 1 ? "Correct!" : "You got there!", "<p>" + q.explain + "</p>");
      state.results.push({
        q: q, score: (attempts === 1 ? 1 : 0) + findScore, max: marks,
        given: q.options[firstGiven], correct: attempts === 1, correctText: q.options[q.answer], attempts: attempts,
        findScore: findScore, foundTarget: foundTarget, tries: tries
      });
      becomeNext(btn);
    };
  }

  /* ---------- Sequencing ---------- */
  // Wrong tries: events already in the right place lock green; the student reorders the rest with a clue.
  function renderOrder(q) {
    var n = q.items.length;
    var items = q._order.map(function (orig) {
      return '<button class="opt order-item" type="button" aria-pressed="false" data-orig="' + orig + '"><span class="letter"></span><span>' + q.items[orig] + "</span></button>";
    }).join("");
    setScreen(shell(q,
      (q.clue ? '<p class="muted">' + q.clue + "</p>" : "") +
      '<div class="order-tools"><span>Tap the events in the order they happened. Tap again to undo.</span><button class="linkish" type="button" id="clear">Start again</button></div>' +
      '<div class="order-list">' + items + "</div>", q.marks));
    var slots = [], locked = [], attempts = 0, firstInPlace = null;
    for (var i = 0; i < n; i++) { slots.push(null); locked.push(false); }
    var btn = document.getElementById("main-btn");
    var itemBtns = app.querySelectorAll(".order-item");
    function paint() {
      itemBtns.forEach(function (b) {
        var pos = slots.indexOf(+b.dataset.orig);
        b.querySelector(".letter").textContent = pos === -1 ? "" : pos + 1;
        b.setAttribute("aria-pressed", pos === -1 ? "false" : "true");
      });
      btn.disabled = slots.indexOf(null) !== -1;
    }
    itemBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var o = +b.dataset.orig, pos = slots.indexOf(o);
        if (pos !== -1) { if (!locked[pos]) slots[pos] = null; }
        else { var free = slots.indexOf(null); if (free !== -1) slots[free] = o; }
        paint();
      });
    });
    document.getElementById("clear").onclick = function () {
      for (var k = 0; k < n; k++) if (!locked[k]) slots[k] = null;
      paint();
    };
    btn.onclick = function () {
      attempts++;
      var inPlace = 0;
      slots.forEach(function (o, pos) { if (o === pos) inPlace++; });
      if (firstInPlace === null) firstInPlace = inPlace;
      itemBtns.forEach(function (b) {
        var o = +b.dataset.orig;
        if (slots.indexOf(o) === o) { b.classList.add("is-right"); b.disabled = true; locked[o] = true; }
      });
      if (inPlace < n) {
        for (var k = 0; k < n; k++) if (!locked[k]) slots[k] = null;
        paint();
        showFeedback("bad", inPlace + " of " + n + " events are in the right place.",
          "<p>The green events are locked in. Tap the others again in the right order.</p><p>" + clueFor(q.hints, attempts) + "</p>");
        return;
      }
      document.getElementById("clear").hidden = true;
      var score = firstInPlace === n ? q.marks : firstInPlace >= n - 2 ? 1 : 0;
      showFeedback("good", attempts === 1 ? "Correct! Every event is in the right place." : "You got there!", "<p>" + q.explain + "</p>");
      state.results.push({ q: q, score: score, max: q.marks, correct: attempts === 1, attempts: attempts });
      becomeNext(btn);
    };
  }

  /* ---------- Sorting ---------- */
  // Wrong tries: correct rows lock green; wrong rows are cleared (without showing the right group) and get a clue.
  function renderSort(q) {
    var rows = q.items.map(function (it, k) {
      return '<div class="sort-row" data-k="' + k + '"><span class="sort-name">' + it.text + '</span><div class="seg" role="group" aria-label="' + esc(it.text) + '">' +
        q.categories.map(function (c, ci) {
          return '<button type="button" aria-pressed="false" data-c="' + ci + '">' + c + "</button>";
        }).join("") + "</div></div>";
    }).join("");
    setScreen(shell(q, (q.clue ? '<p class="muted">' + q.clue + "</p>" : "") + '<div class="sort-table">' + rows + "</div>", q.marks));
    var picks = q.items.map(function () { return null; });
    var attempts = 0, firstWrong = null;
    var btn = document.getElementById("main-btn");
    var rowEls = app.querySelectorAll(".sort-row");
    rowEls.forEach(function (row) {
      var k = +row.dataset.k;
      row.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          picks[k] = +b.dataset.c;
          row.classList.remove("is-wrong");
          row.querySelectorAll("button").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
          btn.disabled = picks.indexOf(null) !== -1;
        });
      });
    });
    btn.onclick = function () {
      attempts++;
      var wrong = 0;
      rowEls.forEach(function (row) {
        var k = +row.dataset.k;
        if (row.classList.contains("is-right")) return;
        if (picks[k] === q.items[k].cat) {
          row.classList.add("is-right");
          row.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
        } else {
          wrong++;
          row.classList.add("is-wrong");
          picks[k] = null;
          row.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        }
      });
      if (firstWrong === null) firstWrong = wrong;
      if (wrong) {
        btn.disabled = true;
        var noun = q.itemWord || ["animal", "animals"];
        showFeedback("bad", wrong + " " + (wrong === 1 ? noun[0] + " is" : noun[1] + " are") + " in the wrong group.",
          "<p>The red rows need a new group. The green rows are locked in.</p><p>" + clueFor(q.hints, attempts) + "</p>");
        return;
      }
      var score = firstWrong === 0 ? q.marks : firstWrong === 1 ? 1 : 0;
      showFeedback("good", attempts === 1 ? "Correct! All sorted." : "You got there!", "<p>" + q.explain + "</p>");
      state.results.push({ q: q, score: score, max: q.marks, correct: attempts === 1, attempts: attempts, wrongCount: firstWrong });
      becomeNext(btn);
    };
  }

  /* ---------- Written response ---------- */
  function renderWrite(q) {
    var MIN = 25;
    var crit = q.criteria.map(function (c, k) {
      return '<label><input type="checkbox" id="crit-' + state.i + "-" + k + '"><span>' + c + "</span></label>";
    }).join("");
    setScreen(shell(q,
      '<div class="proof"><div class="proof-head"><h3>Find it first</h3></div><p class="clue">' + q.clue + "</p></div>" +
      '<div class="field"><label for="answer-' + state.i + '">Your answer</label>' +
      '<textarea id="answer-' + state.i + '" spellcheck="true"></textarea>' +
      '<span class="counter">Write at least a few full sentences.</span></div>' +
      '<div class="criteria"><h3>Check your answer before you save it</h3>' + crit + "</div>", q.marks));
    var ta = app.querySelector("textarea");
    var btn = document.getElementById("main-btn");
    ta.addEventListener("input", function () { btn.disabled = ta.value.trim().length < MIN; });
    btn.onclick = function () {
      ta.readOnly = true;
      app.querySelectorAll(".criteria input").forEach(function (c) { c.disabled = true; });
      showFeedback("", "Answer saved.", "<p>Your teacher will mark this answer out of " + q.marks + ".</p>");
      state.results.push({ q: q, score: null, max: q.marks, given: ta.value.trim() });
      becomeNext(btn);
    };
  }

  /* ---------- Results ---------- */
  function renderResults() {
    var got = 0, byType = {};
    state.results.forEach(function (r) {
      if (r.score === null) return;
      got += r.score;
      var t = byType[r.q.type] || (byType[r.q.type] = { got: 0, max: 0 });
      t.got += r.score; t.max += r.max;
    });
    var date = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    var skills = Object.keys(TYPES).filter(function (k) { return byType[k]; }).map(function (k) {
      var t = byType[k];
      return '<li><span>' + TYPES[k].name + '</span><span class="mono">' + t.got + "/" + t.max + "</span></li>";
    }).join("");

    var items = state.results.map(function (r, k) {
      var q = r.q, detail = "", mark;
      var typeLine = '<span class="r-type">' + TYPES[q.type].name + " · " + TYPES[q.type].code + "</span>";
      if (q.format === "write") {
        mark = "__/" + r.max;
        detail = '<div class="r-text">' + esc(r.given) + "</div>" +
          "<details><summary>What your teacher looks for</summary><ul>" +
          q.lookFor.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></details>";
      } else {
        mark = r.score + "/" + r.max;
        if (q.format === "mc") {
          if (q.find) {
            var triesTxt = r.tries === 1 ? "first try" : r.tries + " tries";
            detail += r.findScore
              ? '<span class="r-good">Evidence found (' + triesTxt + "): " + targetText(r.foundTarget) + "</span>"
              : '<span class="r-bad">Evidence found with clues (' + triesTxt + "): " + targetText(r.foundTarget) + "</span>";
          }
          detail += r.correct
            ? '<span class="r-good">Correct on the first try: ' + r.correctText + "</span>"
            : '<span class="r-bad">First answer: ' + r.given + "</span><span>Correct on " + ordinal(r.attempts) + ": " + r.correctText + "</span>";
        } else if (q.format === "order") {
          detail = '<span class="' + (r.correct ? "r-good" : "r-bad") + '">' + (r.correct ? "All events in order on the first try." : "All events in order after " + ordinal(r.attempts) + ".") + "</span>";
        } else if (q.format === "sort") {
          detail = '<span class="' + (r.correct ? "r-good" : "r-bad") + '">' + (r.correct ? "All sorted on the first try." : r.wrongCount + " in the wrong group at first; all sorted after " + ordinal(r.attempts) + ".") + "</span>";
        }
      }
      return '<li><span class="r-q">' + (k + 1) + ". " + (partOf(q) ? '<span class="r-part">Ch ' + q.part + "</span> " : "") + q.prompt + '</span><span class="r-mark">' + mark + '</span><div class="r-detail">' + typeLine + detail + "</div></li>";
    }).join("");

    setScreen(
      '<div class="progress"><div style="width:100%"></div></div>' +
      '<section class="sheet">' +
        '<h2 tabindex="-1" data-focus>Well done, ' + esc(state.name) + "!</h2>" +
        '<p class="muted">' + esc(LABEL) + ": " + esc(C.title) + " · " + date + "</p>" +
        '<div class="score-row">' +
          '<div class="score"><span class="big">' + got + "/" + autoTotal + '</span><span class="lbl">Marked by the computer</span></div>' +
          (writtenTotal ? '<div class="score"><span class="big">__/' + writtenTotal + '</span><span class="lbl">Written answers, marked by your teacher</span></div>' : "") +
        "</div>" +
        '<div><h3 class="skills-h">By skill</h3><ul class="skills">' + skills + "</ul></div>" +
        '<p class="save-status" id="save-status" role="status"></p>' +
      "</section>" +
      '<section class="sheet"><h2>Your answers</h2><ol class="review">' + items + "</ol></section>" +
      '<div class="actions"><a class="btn ghost" href="index.html">All chapters</a><button class="btn" id="again">Try ' + (PARTS.length ? "these chapters" : "this chapter") + ' again</button></div>'
    );
    document.getElementById("again").onclick = renderStart;
    sendResults(buildPayload(got, byType), document.getElementById("save-status"));
  }

  renderStart();
})();
